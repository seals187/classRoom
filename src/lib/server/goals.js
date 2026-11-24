import { error } from '@sveltejs/kit';
import { classScope, requireStudentAccess, requireTeacher } from './auth.js';
import { getDb, goalKind, listStudents, requiredText } from './db.js';

// Ziele der Schüler (Stundenziele und Selbstlernen). Jede Funktion bekommt den Aufrufer (`actor`: angemeldete
// Person und Lehrkraft, deren Klasse gilt) und prüft die Rechte selbst – die API-Routen reichen nur durch.
// Hier liegt auch die Zeit des letzten Abhakens (student_teachers.last_check_*), die „seit X min“ speist.

/** @typedef {Pick<App.Locals, 'user' | 'owner'>} Actor */
/** @typedef {'self' | 'lesson'} GoalKind */
/** @typedef {{ done: number, total: number }} GoalCount */

const TEXT_MAX = 200;
const KEY = /^[a-z0-9]{1,16}$/;

/** @param {unknown} value @returns {string | null} */
const stepKeyOf = (value) => (typeof value === 'string' && KEY.test(value) ? value : null);

/**
 * Zeit des letzten Abhakens setzen bzw. löschen (null = die Zeit beginnt neu).
 * @param {GoalKind} kind
 * @param {number | null} at
 * @param {number} teacherId
 * @param {number} [studentId] ohne: alle Schüler der Lehrkraft
 */
function setLastCheck(kind, at, teacherId, studentId) {
	const column = kind === 'lesson' ? 'last_check_lesson' : 'last_check_self';
	const db = getDb();
	if (studentId === undefined) {
		db.prepare(`UPDATE student_teachers SET ${column} = ? WHERE teacher_id = ?`).run(at, teacherId);
	} else {
		db.prepare(`UPDATE student_teachers SET ${column} = ? WHERE student_id = ? AND teacher_id = ?`).run(at, studentId, teacherId);
	}
}

/**
 * @param {number} teacherId
 * @param {number} studentId
 * @param {string} text
 * @param {GoalKind} kind
 * @param {string | null} stepKey
 */
function insertGoal(teacherId, studentId, text, kind, stepKey) {
	const { lastInsertRowid } = getDb()
		.prepare(
			`INSERT INTO goals (student_id, teacher_id, text, kind, step_key, position, created_at)
			 VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM goals WHERE student_id = ? AND teacher_id = ?), ?)`
		)
		.run(studentId, teacherId, text, kind, stepKey, studentId, teacherId, Date.now());
	return Number(lastInsertRowid);
}

/**
 * Ein Ziel, das der Aufrufer bearbeiten darf: nur in der Klasse seiner Lehrkraft (Lehrkraft selbst bzw. ihr Schüler).
 * @param {Actor} actor
 * @param {number} id
 */
function ownGoal(actor, id) {
	const goal = /** @type {{ text: string, done: number, kind: GoalKind, studentId: number, teacherId: number } | undefined} */ (
		getDb()
			.prepare('SELECT text, done, kind, student_id AS studentId, teacher_id AS teacherId FROM goals WHERE id = ?')
			.get(id)
	);
	if (!goal || goal.teacherId !== actor.owner) error(404, 'Ziel nicht gefunden');
	requireStudentAccess(actor, goal.studentId);
	return goal;
}

/**
 * Erledigte/alle Ziele dieser Lehrkraft pro Schüler, getrennt nach Stundenzielen und Selbstlernen.
 * @param {number} owner
 * @returns {Record<number, { lesson: GoalCount, self: GoalCount }>}
 */
export function goalStats(owner) {
	const rows = /** @type {{ studentId: number, kind: GoalKind, total: number, done: number }[]} */ (
		getDb()
			.prepare(
				`SELECT student_id AS studentId, kind, COUNT(*) AS total, SUM(done) AS done FROM goals
				 WHERE teacher_id = ? GROUP BY student_id, kind`
			)
			.all(owner)
	);
	/** @type {Record<number, { lesson: GoalCount, self: GoalCount }>} */
	const stats = {};
	for (const r of rows) {
		stats[r.studentId] ??= { lesson: { done: 0, total: 0 }, self: { done: 0, total: 0 } };
		stats[r.studentId][r.kind] = { done: r.done, total: r.total };
	}
	return stats;
}

/**
 * Ein Ziel für einen Schüler (Lehrkraft für einen sichtbaren Schüler, Schüler für sich selbst).
 * @param {Actor} actor
 * @param {number} studentId
 * @param {Record<string, unknown>} input text, kind?
 * @returns {import('./db.js').Goal}
 */
export function addGoal(actor, studentId, input) {
	requireStudentAccess(actor, studentId);
	const text = requiredText(input.text, 'Ziel', TEXT_MAX);
	const kind = goalKind(input.kind);
	if (!getDb().prepare('SELECT 1 FROM students WHERE id = ?').get(studentId)) error(404, 'Schüler nicht gefunden');
	return { id: insertGoal(actor.owner, studentId, text, kind, null), text, done: false, stepKey: null };
}

/**
 * Dieselben Ziele allen Schülern der aktiven Klasse geben (z. B. die Schritte des Auftrags als Stundenziele).
 * Ein Ziel, das ein Schüler schon hat (gleicher Schritt bzw. ohne Schritt gleicher Text), wird übersprungen.
 * @param {Actor} actor
 * @param {{ goals?: unknown, texts?: unknown, kind?: unknown, replace?: unknown, studentIds?: unknown }} input
 *   goals: [{ text, stepKey? }] (oder texts: ['…'] wie früher) · replace: vorher alle Ziele dieser Art löschen
 *   (bei den gewählten Schülern) · studentIds: nur diese Schüler, sonst alle
 */
export function sendGoals(actor, input) {
	requireTeacher(actor);
	const raw = Array.isArray(input.goals) ? input.goals : Array.isArray(input.texts) ? input.texts.map((text) => ({ text })) : [];
	if (raw.length === 0 || raw.length > 30) error(400, 'Keine Ziele angegeben');
	/** @type {Map<string, { text: string, stepKey: string | null }>} */
	const unique = new Map();
	for (const g of raw) {
		const text = requiredText(g?.text, 'Ziel', TEXT_MAX);
		const stepKey = stepKeyOf(g?.stepKey);
		unique.set(stepKey ? `#${stepKey}` : text, { text, stepKey });
	}
	const kind = goalKind(input.kind);
	const scope = classScope(actor);
	const all = listStudents(scope);
	// Nur ausgewählte Schüler („Einzelne…“) – unbekannte IDs fallen weg.
	const wanted = Array.isArray(input.studentIds) ? input.studentIds : null;
	const students = wanted ? all.filter((s) => wanted.includes(s.id)) : all;
	if (students.length === 0) error(400, 'Keine Schüler ausgewählt');
	const db = getDb();
	const byKey = db.prepare('SELECT 1 FROM goals WHERE student_id = ? AND teacher_id = ? AND kind = ? AND step_key = ?');
	const byText = db.prepare(
		'SELECT 1 FROM goals WHERE student_id = ? AND teacher_id = ? AND kind = ? AND step_key IS NULL AND text = ?'
	);
	/** @type {number[]} */
	const goalIds = [];
	db.transaction(() => {
		for (const { id } of students) {
			// Nur bei diesen Schülern (der aktiven Klasse) ersetzen – Ziele in anderen Klassen bleiben.
			if (input.replace === true) {
				db.prepare('DELETE FROM goals WHERE student_id = ? AND teacher_id = ? AND kind = ?').run(id, actor.owner, kind);
				setLastCheck(kind, null, actor.owner, id);
			}
			for (const { text, stepKey } of unique.values()) {
				const exists = stepKey ? byKey.get(id, actor.owner, kind, stepKey) : byText.get(id, actor.owner, kind, text);
				if (!exists) goalIds.push(insertGoal(actor.owner, id, text, kind, stepKey));
			}
		}
	})();
	return { added: goalIds.length, students: students.length, goalIds };
}

/**
 * Mehrere eigene Ziele auf einmal löschen („Rückgängig“ nach dem Senden).
 * @param {Actor} actor
 * @param {unknown} ids
 */
export function deleteGoals(actor, ids) {
	requireTeacher(actor);
	if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) error(400, 'Ungültige Ziele');
	const db = getDb();
	const del = db.prepare('DELETE FROM goals WHERE id = ? AND teacher_id = ?');
	let deleted = 0;
	db.transaction(() => {
		for (const id of ids) deleted += del.run(id, actor.owner).changes;
	})();
	return { deleted };
}

/**
 * Alle eigenen Ziele einer Art löschen (z. B. Stundenziele für eine neue Stunde).
 * @param {Actor} actor
 * @param {unknown} kind
 */
export function clearGoals(actor, kind) {
	requireTeacher(actor);
	const db = getDb();
	const k = goalKind(kind);
	const { changes } = db.transaction(() => {
		// Neue Stunde → die Zeit seit dem letzten Abhaken beginnt neu.
		setLastCheck(k, null, actor.owner);
		return db.prepare('DELETE FROM goals WHERE kind = ? AND teacher_id = ?').run(k, actor.owner);
	})();
	return { deleted: changes };
}

/**
 * Text ändern bzw. abhaken.
 * @param {Actor} actor
 * @param {number} id
 * @param {Record<string, unknown>} input text?, done?
 */
export function updateGoal(actor, id, input) {
	const current = ownGoal(actor, id);
	const text = input.text === undefined ? current.text : requiredText(input.text, 'Ziel', TEXT_MAX);
	const done = input.done === undefined ? current.done === 1 : Boolean(input.done);
	const db = getDb();
	db.transaction(() => {
		db.prepare('UPDATE goals SET text = ?, done = ? WHERE id = ?').run(text, done ? 1 : 0, id);
		// Zeitpunkt des letzten Abhakens pro Schüler, Lehrkraft und Art merken.
		if (done && current.done !== 1) setLastCheck(current.kind, Date.now(), current.teacherId, current.studentId);
	})();
	return { id, text, done };
}

/** @param {Actor} actor @param {number} id */
export function deleteGoal(actor, id) {
	ownGoal(actor, id);
	getDb().prepare('DELETE FROM goals WHERE id = ?').run(id);
}
