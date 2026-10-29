import { randomInt } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { activeAssignmentId, getAssignment, getFile } from './assignment.js';
import { getConfig } from './config.js';
import { getDb, getSettings, getWarnMinutes } from './db.js';

// Öffentlicher Link zu einem Auftrag (/a/<code>, QR-Code): ohne Anmeldung, nur lesen. Jeder Auftrag hat seinen eigenen.

/** Ohne Zeichen, die man verwechselt (0/o, 1/l/i) – der Link soll sich abtippen lassen. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 10;
export const CODE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;

/** @typedef {{ code: string, expiresAt: number }} Share */
/** @typedef {Share & { id: number, teacherId: number, username: string, title: string }} ShareEntry */

function newCode() {
	return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** @param {unknown} days */
function daysOf(days) {
	const n = days === undefined ? getConfig().shareDays : Math.round(Number(days));
	if (!Number.isFinite(n) || n < 1 || n > MAX_DAYS) error(400, `Gültigkeit 1 bis ${MAX_DAYS} Tage`);
	return n;
}

/** Abgelaufene Links vergessen – danach gilt der Auftrag als nicht geteilt. */
function dropExpired() {
	getDb()
		.prepare('UPDATE assignment_items SET share_code = NULL, share_expires = NULL WHERE share_expires <= ?')
		.run(Date.now());
}

/** @param {number | null} assignmentId @returns {Share | null} */
export function getShare(assignmentId) {
	if (!assignmentId) return null;
	dropExpired();
	const row = /** @type {{ code: string | null, expiresAt: number | null } | undefined} */ (
		getDb()
			.prepare('SELECT share_code AS code, share_expires AS expiresAt FROM assignment_items WHERE id = ?')
			.get(assignmentId)
	);
	return row?.code && row.expiresAt ? { code: row.code, expiresAt: row.expiresAt } : null;
}

/**
 * Welcher Auftrag geteilt wird: der angegebene, sonst der aktive (der eigenen bzw. – als Admin – der Lehrkraft
 * `teacher`). Fremde nur als Admin.
 * @param {{ id: number, isAdmin: boolean }} user
 * @param {{ assignment?: unknown, teacher?: unknown }} input
 */
export function shareTarget(user, input) {
	if (input.assignment !== undefined) {
		const row = /** @type {{ teacherId: number } | undefined} */ (
			getDb().prepare('SELECT teacher_id AS teacherId FROM assignment_items WHERE id = ?').get(Number(input.assignment))
		);
		if (!row) error(404, 'Auftrag nicht gefunden');
		if (row.teacherId !== user.id && !user.isAdmin) error(403, 'Nur eigene Aufträge');
		return Number(input.assignment);
	}
	const teacher = Number(input.teacher) || user.id;
	if (teacher !== user.id && !user.isAdmin) error(403, 'Nur eigene Aufträge');
	const id = activeAssignmentId(teacher);
	if (!id) error(404, 'Es gibt keinen Auftrag zum Teilen');
	return id;
}

/**
 * Geteilte Aufträge: die eigenen bzw. für den Admin alle.
 * @param {{ id: number, isAdmin: boolean }} user
 * @returns {ShareEntry[]}
 */
export function listShares(user) {
	dropExpired();
	return /** @type {ShareEntry[]} */ (
		getDb()
			.prepare(
				`SELECT a.id, a.teacher_id AS teacherId, u.username, a.title, a.share_code AS code, a.share_expires AS expiresAt
				 FROM assignment_items a JOIN users u ON u.id = a.teacher_id
				 WHERE a.share_code IS NOT NULL AND (? OR a.teacher_id = ?) ORDER BY u.username, a.id`
			)
			.all(user.isAdmin ? 1 : 0, user.id)
	);
}

/**
 * Teilen starten oder ändern. Ohne Link: neuer Code. `renew` = neuer Code (der alte gilt nicht mehr).
 * `days` = gültig ab jetzt so viele Tage (sonst bleibt der Ablauf bzw. gilt SHARE_DAYS).
 * @param {number} assignmentId
 * @param {{ days?: unknown, renew?: unknown }} input
 */
export function setShare(assignmentId, input) {
	const current = getShare(assignmentId);
	const code = !current || input.renew === true ? newCode() : current.code;
	const expiresAt = !current || input.days !== undefined ? Date.now() + daysOf(input.days) * DAY : current.expiresAt;
	getDb().prepare('UPDATE assignment_items SET share_code = ?, share_expires = ? WHERE id = ?').run(code, expiresAt, assignmentId);
	return /** @type {Share} */ (getShare(assignmentId));
}

/** @param {number} assignmentId */
export function endShare(assignmentId) {
	getDb().prepare('UPDATE assignment_items SET share_code = NULL, share_expires = NULL WHERE id = ?').run(assignmentId);
}

// --- Öffentliche Seite ---

/**
 * Ungültige Codes je Adresse – bremst das Durchprobieren. Großzügig, weil im Schulnetz oft alle Handys
 * unter derselben Adresse kommen; die Seite fragt nach einem beendeten Link nicht weiter nach.
 * @type {Map<string, { count: number, until: number }>}
 */
const misses = new Map();
const MISS_LIMIT = 300;
const MISS_WINDOW = 10 * 60 * 1000;

/** @param {string} ip */
function blocked(ip) {
	const entry = misses.get(ip);
	if (entry && entry.until < Date.now()) misses.delete(ip);
	return (misses.get(ip)?.count ?? 0) >= MISS_LIMIT;
}

/** @param {string} ip */
function miss(ip) {
	if (misses.size > 10_000) misses.clear();
	const entry = misses.get(ip) ?? { count: 0, until: Date.now() + MISS_WINDOW };
	entry.count++;
	misses.set(ip, entry);
}

/** @param {string} code @returns {{ id: number, teacherId: number } | null} geteilter Auftrag */
function sharedBy(code) {
	if (!CODE.test(code)) return null;
	const row = /** @type {{ id: number, teacherId: number } | undefined} */ (
		getDb()
			.prepare('SELECT id, teacher_id AS teacherId FROM assignment_items WHERE share_code = ? AND share_expires > ?')
			.get(code, Date.now())
	);
	return row ?? null;
}

/**
 * Was die öffentliche Seite zeigt: nur Titel, Text, Bilder und Links – keine Namen, Ziele oder Klasseninfos.
 * @param {string} code
 * @param {string} ip
 * @returns {{ state: 'ok', assignment: { title: string, html: string, images: number[] }, lesson: PublicLesson } | { state: 'gone' | 'blocked' }}
 */
export function publicAssignment(code, ip) {
	if (blocked(ip)) return { state: 'blocked' };
	const shared = sharedBy(code);
	if (!shared) {
		miss(ip);
		return { state: 'gone' };
	}
	const { title, html, images } = getAssignment(shared.teacherId, shared.id);
	return { state: 'ok', assignment: { title, html, images }, lesson: publicLesson(shared.teacherId) };
}

/**
 * Bild eines geteilten Auftrags – nur mit gültigem Code und nur Bilder dieses Auftrags.
 * @param {string} code
 * @param {number} id
 * @param {string} ip
 */
export function publicImage(code, id, ip) {
	if (blocked(ip)) error(429, 'Zu viele ungültige Versuche');
	const shared = sharedBy(code);
	if (!shared || !getAssignment(shared.teacherId, shared.id).images.includes(id)) {
		miss(ip);
		error(404, 'Bild nicht gefunden');
	}
	return getFile(id);
}

/**
 * Stunde für die geteilte Seite (Zeitbalken): nur Zeiten und Raum – keine Namen oder Klasseninfos.
 * @typedef {{ startTime: string, returnTime: string, roomName: string, roomChange: boolean, warnMinutes: number, goMinutes: number }} PublicLesson
 * @param {number} owner
 * @returns {PublicLesson}
 */
function publicLesson(owner) {
	const { startTime, returnTime, roomName, roomChange } = getSettings(owner);
	return { startTime, returnTime, roomName, roomChange, warnMinutes: getWarnMinutes(owner), goMinutes: getConfig().goMinutes };
}
