import { randomInt } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { getAssignment, getFile } from './assignment.js';
import { getConfig } from './config.js';
import { getDb } from './db.js';

// Öffentlicher Link zum Auftrag (/a/<code>, QR-Code): ohne Anmeldung, nur lesen.

/** Ohne Zeichen, die man verwechselt (0/o, 1/l/i) – der Link soll sich abtippen lassen. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 10;
export const CODE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;

/** @typedef {{ code: string, expiresAt: number }} Share */
/** @typedef {Share & { teacherId: number, username: string, title: string }} ShareEntry */

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
		.prepare('UPDATE assignments SET share_code = NULL, share_expires = NULL WHERE share_expires <= ?')
		.run(Date.now());
}

/** @param {number} teacherId @returns {Share | null} */
export function getShare(teacherId) {
	dropExpired();
	const row = /** @type {{ code: string | null, expiresAt: number | null } | undefined} */ (
		getDb()
			.prepare('SELECT share_code AS code, share_expires AS expiresAt FROM assignments WHERE teacher_id = ?')
			.get(teacherId)
	);
	return row?.code && row.expiresAt ? { code: row.code, expiresAt: row.expiresAt } : null;
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
				`SELECT a.teacher_id AS teacherId, u.username, a.title, a.share_code AS code, a.share_expires AS expiresAt
				 FROM assignments a JOIN users u ON u.id = a.teacher_id
				 WHERE a.share_code IS NOT NULL AND (? OR a.teacher_id = ?) ORDER BY u.username`
			)
			.all(user.isAdmin ? 1 : 0, user.id)
	);
}

/**
 * Teilen starten oder ändern. Ohne Link: neuer Code. `renew` = neuer Code (der alte gilt nicht mehr).
 * `days` = gültig ab jetzt so viele Tage (sonst bleibt der Ablauf bzw. gilt SHARE_DAYS).
 * @param {number} teacherId
 * @param {{ days?: unknown, renew?: unknown }} input
 */
export function setShare(teacherId, input) {
	const db = getDb();
	if (!db.prepare('SELECT 1 FROM assignments WHERE teacher_id = ?').get(teacherId)) error(404, 'Es gibt keinen Auftrag zum Teilen');
	const current = getShare(teacherId);
	const code = !current || input.renew === true ? newCode() : current.code;
	const expiresAt = !current || input.days !== undefined ? Date.now() + daysOf(input.days) * DAY : current.expiresAt;
	db.prepare('UPDATE assignments SET share_code = ?, share_expires = ? WHERE teacher_id = ?').run(code, expiresAt, teacherId);
	return /** @type {Share} */ (getShare(teacherId));
}

/** @param {number} teacherId */
export function endShare(teacherId) {
	getDb().prepare('UPDATE assignments SET share_code = NULL, share_expires = NULL WHERE teacher_id = ?').run(teacherId);
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

/** @param {string} code @returns {number | null} Lehrkraft */
function ownerOf(code) {
	if (!CODE.test(code)) return null;
	const row = /** @type {{ teacherId: number } | undefined} */ (
		getDb()
			.prepare('SELECT teacher_id AS teacherId FROM assignments WHERE share_code = ? AND share_expires > ?')
			.get(code, Date.now())
	);
	return row?.teacherId ?? null;
}

/**
 * Was die öffentliche Seite zeigt: nur Titel, Text, Bilder und Links – keine Namen, Ziele oder Klasseninfos.
 * @param {string} code
 * @param {string} ip
 * @returns {{ state: 'ok', assignment: import('./assignment.js').Assignment } | { state: 'gone' | 'blocked' }}
 */
export function publicAssignment(code, ip) {
	if (blocked(ip)) return { state: 'blocked' };
	const owner = ownerOf(code);
	if (!owner) {
		miss(ip);
		return { state: 'gone' };
	}
	const { title, html, images } = getAssignment(owner);
	return { state: 'ok', assignment: { title, html, images, updatedAt: null } };
}

/**
 * Bild eines geteilten Auftrags – nur mit gültigem Code und nur Bilder dieses Auftrags.
 * @param {string} code
 * @param {number} id
 * @param {string} ip
 */
export function publicImage(code, id, ip) {
	if (blocked(ip)) error(429, 'Zu viele ungültige Versuche');
	const owner = ownerOf(code);
	if (!owner || !getAssignment(owner).images.includes(id)) {
		miss(ip);
		error(404, 'Bild nicht gefunden');
	}
	return getFile(id);
}
