import { createClass } from './classes.js';
import { createStudents, getDb } from './db.js';

// Hilfen für Tests mit der Datenbank im Speicher (DATABASE_PATH=:memory:, siehe vite.config.js).

let n = 0;

/**
 * Lehrkraft anlegen und als Aufrufer (wie `locals`) zurückgeben.
 * @param {{ admin?: boolean }} [options]
 */
export function teacher({ admin = false } = {}) {
	const username = `lehrer${++n}`;
	const id = Number(
		getDb()
			.prepare("INSERT INTO users (username, password_hash, role, is_admin) VALUES (?, 'x', 'teacher', ?)")
			.run(username, admin ? 1 : 0).lastInsertRowid
	);
	/** @type {import('./auth.js').User} */
	const user = { id, username, role: 'teacher', studentId: null, displayName: username, isAdmin: admin, actingAdmin: null };
	return { user, owner: id };
}

/**
 * Klasse der Lehrkraft mit Schülern.
 * @param {ReturnType<typeof teacher>} actor
 * @param {string[]} names Vornamen
 */
export function classWith(actor, names) {
	const klass = createClass(actor.user, { name: `Klasse ${++n}` });
	const created = /** @type {{ student: { id: number } }[]} */ (
		createStudents(actor, { classId: klass.id, students: names.map((firstName) => ({ firstName, lastName: 'Test' })) })
	);
	return { classId: klass.id, studentIds: created.map((c) => c.student.id) };
}

/**
 * Schüler als Aufrufer (angemeldet, Lehrkraft `owner`).
 * @param {number} studentId
 * @param {number} owner
 */
export function studentActor(studentId, owner) {
	const row = /** @type {{ id: number, username: string }} */ (
		getDb().prepare('SELECT id, username FROM users WHERE student_id = ?').get(studentId)
	);
	/** @type {import('./auth.js').User} */
	const user = { id: row.id, username: row.username, role: 'student', studentId, displayName: row.username, isAdmin: false, actingAdmin: null };
	return { user, owner };
}

/** Fehler einer Funktion als HTTP-Status (SvelteKit `error()`), sonst null. @param {() => unknown} fn */
export function statusOf(fn) {
	try {
		fn();
		return null;
	} catch (err) {
		return /** @type {{ status?: number }} */ (err).status ?? 'kein HTTP-Fehler';
	}
}
