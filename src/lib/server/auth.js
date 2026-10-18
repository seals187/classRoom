import { createHash, randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { getConfig } from './config.js';
import { assertUsernameFree, getDb, normalizeUsername } from './db.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'classroom_session';

/** @typedef {{ id: number, username: string, role: 'teacher' | 'student', studentId: number | null, displayName: string }} User */

// Wird verglichen, wenn der Benutzer nicht existiert – damit die Antwortzeit nichts verrät.
const DUMMY_HASH = hashPassword('classroom-dummy');

// --- Schutz gegen Durchprobieren: 5 Fehlversuche pro Benutzername → 5 Minuten Sperre ---

const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60_000;
/** @type {Map<string, { count: number, last: number }>} */
const failures = new Map();

/** @param {string} key */
function isLocked(key) {
	const f = failures.get(key);
	return !!f && f.count >= MAX_FAILURES && Date.now() - f.last < LOCK_MS;
}

/** @param {string} key */
function recordFailure(key) {
	const f = failures.get(key);
	const fresh = !f || Date.now() - f.last >= LOCK_MS;
	failures.set(key, { count: fresh ? 1 : f.count + 1, last: Date.now() });
}

/** @param {string} token */
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * @param {string} username
 * @param {string} password
 * @returns {{ ok: true, token: string, expires: Date, role: User['role'] } | { ok: false, status: number, message: string }}
 */
export function login(username, password) {
	const key = username.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
	if (isLocked(key)) {
		return { ok: false, status: 429, message: 'Zu viele Fehlversuche – bitte in ein paar Minuten erneut versuchen.' };
	}
	const user = findLoginUser(key);
	const valid = verifyPassword(password, user?.hash ?? DUMMY_HASH);
	if (!user || !valid) {
		recordFailure(key);
		return { ok: false, status: 400, message: 'Benutzername oder Passwort ist falsch.' };
	}
	failures.delete(key);
	return { ok: true, ...createSession(user.id), role: user.role };
}

/**
 * Anmeldung mit Benutzername (Kürzel) oder – bei Schülern – mit „Vorname Nachname“.
 * Der Namensvergleich läuft in JavaScript, weil SQLites lower() keine Umlaute kennt.
 * Gibt es denselben Namen mehrfach, ist er nicht eindeutig → nur per Kürzel.
 * @param {string} key bereits normalisiert (getrimmt, klein, einfache Leerzeichen)
 */
function findLoginUser(key) {
	const db = getDb();
	const byUsername = /** @type {{ id: number, hash: string, role: User['role'] } | undefined} */ (
		db.prepare('SELECT id, password_hash AS hash, role FROM users WHERE username = ?').get(key)
	);
	if (byUsername || !key.includes(' ')) return byUsername;

	const students = /** @type {{ id: number, hash: string, role: User['role'], name: string }[]} */ (
		db
			.prepare(
				`SELECT u.id, u.password_hash AS hash, u.role, s.first_name || ' ' || s.last_name AS name
				 FROM users u JOIN students s ON s.id = u.student_id`
			)
			.all()
	);
	const matches = students.filter((s) => s.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de') === key);
	return matches.length === 1 ? matches[0] : undefined;
}

/** @param {number} userId */
function createSession(userId) {
	const db = getDb();
	const token = randomBytes(32).toString('base64url');
	const expires = Date.now() + getConfig().sessionHours * 3_600_000;
	db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
	db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, expires);
	return { token, expires: new Date(expires) };
}

/**
 * @param {string} token
 * @returns {User | null}
 */
export function validateSession(token) {
	const row = /** @type {(Omit<User, 'displayName'> & { firstName: string | null, lastName: string | null }) | undefined} */ (
		getDb()
			.prepare(
				`SELECT u.id, u.username, u.role, u.student_id AS studentId, s.first_name AS firstName, s.last_name AS lastName
				 FROM sessions se
				 JOIN users u ON u.id = se.user_id
				 LEFT JOIN students s ON s.id = u.student_id
				 WHERE se.id = ? AND se.expires_at > ?`
			)
			.get(hashToken(token), Date.now())
	);
	if (!row) return null;
	const { firstName, lastName, ...user } = row;
	return { ...user, displayName: firstName ? `${firstName} ${lastName}` : user.username };
}

/** @param {string} token */
export function deleteSession(token) {
	getDb().prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token));
}

/**
 * `secure` nur bei echtem HTTPS – sonst verwirft der Browser das Cookie im Schulnetz (http://IP:3000).
 * Ohne ORIGIN nimmt adapter-node immer https an, daher zählt das Origin des Browsers.
 * @param {Request} request
 * @param {URL} url
 */
function isSecure(request, url) {
	const origin = request.headers.get('origin');
	return origin ? origin.startsWith('https:') : url.protocol === 'https:';
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {Request} request
 * @param {URL} url
 * @param {string} token
 * @param {Date} expires
 */
export function setSessionCookie(cookies, request, url, token, expires) {
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: isSecure(request, url), expires });
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {Request} request
 * @param {URL} url
 */
export function clearSessionCookie(cookies, request, url) {
	cookies.delete(SESSION_COOKIE, { path: '/', secure: isSecure(request, url) });
}

// --- Berechtigungen für die API ---

/** @param {App.Locals} locals */
export function requireTeacher(locals) {
	if (locals.user?.role !== 'teacher') error(403, 'Nur für Lehrkräfte');
	return locals.user;
}

/**
 * Lehrkräfte dürfen alles, Schüler nur ihre eigenen Ziele.
 * @param {App.Locals} locals
 * @param {number} studentId
 */
export function requireStudentAccess(locals, studentId) {
	const user = locals.user;
	if (user?.role === 'teacher') return;
	if (user?.role === 'student' && user.studentId === studentId) return;
	error(403, 'Du darfst nur deine eigenen Ziele bearbeiten');
}

// --- Lehrkräfte ---

/** @param {unknown} value */
function validPassword(value) {
	const v = typeof value === 'string' ? value : '';
	if (v.length < 8) error(400, 'Passwort muss mindestens 8 Zeichen haben');
	if (v.length > 200) error(400, 'Passwort ist zu lang');
	return v;
}

export function listTeachers() {
	return /** @type {{ id: number, username: string }[]} */ (
		getDb().prepare("SELECT id, username FROM users WHERE role = 'teacher' ORDER BY username").all()
	);
}

/** @param {Record<string, unknown>} input */
export function addTeacher(input) {
	const username = normalizeUsername(input.username);
	const password = validPassword(input.password);
	assertUsernameFree(username);
	const { lastInsertRowid } = getDb()
		.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'teacher')")
		.run(username, hashPassword(password));
	return { id: Number(lastInsertRowid), username };
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} input
 */
export function setTeacherPassword(id, input) {
	const password = validPassword(input.password);
	const { changes } = getDb()
		.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'teacher'")
		.run(hashPassword(password), id);
	if (!changes) error(404, 'Lehrkraft nicht gefunden');
}

/**
 * @param {number} id
 * @param {number} currentUserId
 */
export function deleteTeacher(id, currentUserId) {
	if (id === currentUserId) error(400, 'Du kannst dein eigenes Konto nicht löschen');
	const db = getDb();
	const { count } = /** @type {{ count: number }} */ (
		db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'").get()
	);
	if (count <= 1) error(400, 'Die letzte Lehrkraft kann nicht gelöscht werden');
	const { changes } = db.prepare("DELETE FROM users WHERE id = ? AND role = 'teacher'").run(id);
	if (!changes) error(404, 'Lehrkraft nicht gefunden');
}

/**
 * Das Lehrerkonto aus der .env anlegen bzw. sein Passwort auf den .env-Wert setzen.
 * So kommt man über die .env immer wieder hinein, falls ein Passwort vergessen wurde.
 */
export function ensureEnvTeacher() {
	const { username, password } = getConfig().teacher;
	const db = getDb();
	if (!username || !password) {
		const { count } = /** @type {{ count: number }} */ (
			db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'").get()
		);
		if (!count) console.warn('[classRoom] Kein Lehrerkonto vorhanden – bitte TEACHER_USERNAME und TEACHER_PASSWORD in der .env setzen.');
		return;
	}
	const existing = /** @type {{ id: number, role: string, hash: string } | undefined} */ (
		db.prepare('SELECT id, role, password_hash AS hash FROM users WHERE username = ?').get(username)
	);
	if (!existing) {
		db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'teacher')").run(username, hashPassword(password));
		console.log(`[classRoom] Lehrerkonto „${username}“ aus der .env angelegt.`);
	} else if (existing.role !== 'teacher') {
		console.warn(`[classRoom] TEACHER_USERNAME „${username}“ ist bereits ein Schülerkonto – bitte anderen Namen wählen.`);
	} else if (!verifyPassword(password, existing.hash)) {
		db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), existing.id);
		console.log(`[classRoom] Passwort von „${username}“ auf den Wert aus der .env gesetzt.`);
	}
}
