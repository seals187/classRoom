import { createHash, randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { getConfig } from './config.js';
import { deleteFilesIfUnused } from './assignment.js';
import { assertUsernameFree, canSeeStudent, claimOrphans, getDb, getGoalOwner, normalizeUsername } from './db.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'classroom_session';

/**
 * `isAdmin`: verwaltet Lehrkräfte und ordnet Schüler zu. `seesAll`: Lehrkraft sieht alle Schüler, nicht nur ihre.
 * @typedef {{
 *   id: number, username: string, role: 'teacher' | 'student', studentId: number | null, displayName: string,
 *   isAdmin: boolean, seesAll: boolean, actingAdmin: { id: number, username: string } | null
 * }} User
 * `actingAdmin`: Admin, der sich als diese Person angemeldet hat („Anmelden als …“), sonst null.
 */

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

/** @param {number} userId @param {number | null} [adminId] „Anmelden als …“: der Admin dahinter */
function createSession(userId, adminId = null) {
	const db = getDb();
	const token = randomBytes(32).toString('base64url');
	const expires = Date.now() + getConfig().sessionHours * 3_600_000;
	db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
	db.prepare('INSERT INTO sessions (id, user_id, expires_at, admin_id) VALUES (?, ?, ?, ?)').run(
		hashToken(token),
		userId,
		expires,
		adminId
	);
	return { token, expires: new Date(expires) };
}

/**
 * @param {string} token
 * @returns {User | null}
 */
export function validateSession(token) {
	const row = /** @type {(Omit<User, 'displayName' | 'isAdmin' | 'seesAll' | 'actingAdmin'> & { firstName: string | null, lastName: string | null, isAdmin: number, seesAll: number, adminId: number | null, adminName: string | null, adminIsAdmin: number | null }) | undefined} */ (
		getDb()
			.prepare(
				`SELECT u.id, u.username, u.role, u.student_id AS studentId, s.first_name AS firstName, s.last_name AS lastName,
				   u.is_admin AS isAdmin, u.sees_all AS seesAll,
				   se.admin_id AS adminId, a.username AS adminName, a.is_admin AS adminIsAdmin
				 FROM sessions se
				 JOIN users u ON u.id = se.user_id
				 LEFT JOIN students s ON s.id = u.student_id
				 LEFT JOIN users a ON a.id = se.admin_id
				 WHERE se.id = ? AND se.expires_at > ?`
			)
			.get(hashToken(token), Date.now())
	);
	if (!row) return null;
	const { firstName, lastName, isAdmin, seesAll, adminId, adminName, adminIsAdmin, ...user } = row;
	// Ist der Admin dahinter kein Admin mehr, endet auch die Anmeldung als andere Person.
	if (adminId && adminIsAdmin !== 1) return null;
	const teacher = user.role === 'teacher';
	return {
		...user,
		displayName: firstName ? `${firstName} ${lastName}` : user.username,
		isAdmin: teacher && isAdmin === 1,
		seesAll: teacher && seesAll === 1,
		actingAdmin: adminId && adminName ? { id: adminId, username: adminName } : null
	};
}

/**
 * „Anmelden als …“: Der Admin bekommt eine Sitzung als diese Lehrkraft bzw. dieser Schüler, mit allen
 * deren Rechten. Seine eigene Sitzung endet; „Zurück“ (returnToAdmin) meldet ihn wieder an.
 * @param {string} token aktuelle Sitzung des Admins
 * @param {User} admin
 * @param {{ teacherId?: unknown, studentId?: unknown }} target
 */
export function impersonate(token, admin, target) {
	if (admin.actingAdmin) error(400, 'Erst zurück zum eigenen Konto');
	const db = getDb();
	const row = /** @type {{ id: number } | undefined} */ (
		target.studentId !== undefined
			? db.prepare("SELECT id FROM users WHERE role = 'student' AND student_id = ?").get(Number(target.studentId))
			: db.prepare("SELECT id FROM users WHERE role = 'teacher' AND id = ?").get(Number(target.teacherId))
	);
	if (!row) error(404, target.studentId !== undefined ? 'Der Schüler hat keinen Zugang' : 'Lehrkraft nicht gefunden');
	if (row.id === admin.id) error(400, 'Das ist dein eigenes Konto');
	deleteSession(token);
	return createSession(row.id, admin.id);
}

/** Zurück zum Admin-Konto. @param {string} token @param {User} user */
export function returnToAdmin(token, user) {
	if (!user.actingAdmin) error(400, 'Nicht als andere Person angemeldet');
	deleteSession(token);
	return createSession(user.actingAdmin.id);
}

// --- Wessen Klasse gilt: Lehrkräfte sehen ihre eigene, Schüler die einer ihrer Lehrkräfte ---

export const TEACHER_COOKIE = 'classroom_teacher';
const RECENT_LESSON_MS = 12 * 3_600_000;

/**
 * Lehrkräfte eines Schülers, nach Name.
 * @param {number} studentId
 * @returns {{ id: number, username: string }[]}
 */
export function teachersOf(studentId) {
	return /** @type {{ id: number, username: string }[]} */ (
		getDb()
			.prepare(
				`SELECT u.id, u.username FROM student_teachers st JOIN users u ON u.id = st.teacher_id
				 WHERE st.student_id = ? ORDER BY u.username`
			)
			.all(studentId)
	);
}

/**
 * Lehrkraft, deren Auftrag, Stunde und Ziele gelten. Schüler: die im Menü gewählte, sonst die,
 * die zuletzt (in den letzten 12 h) eine Stunde gestartet hat, sonst die erste. 0 = keine.
 * @param {User} user
 * @param {number} chosen Wahl aus dem Cookie (0 = keine)
 */
export function resolveOwner(user, chosen) {
	if (user.role === 'teacher') return user.id;
	const list = teachersOf(/** @type {number} */ (user.studentId));
	if (list.some((t) => t.id === chosen)) return chosen;
	const started = /** @type {{ teacherId: number, at: string }[]} */ (
		getDb()
			.prepare("SELECT teacher_id AS teacherId, value AS at FROM teacher_settings WHERE key = 'lessonStartedAt'")
			.all()
	).filter((r) => list.some((t) => t.id === r.teacherId) && Date.now() - Number(r.at) < RECENT_LESSON_MS);
	started.sort((a, b) => Number(b.at) - Number(a.at));
	return started[0]?.teacherId ?? list[0]?.id ?? 0;
}

/**
 * Für die Datenbank-Abfragen: wessen Daten (`owner`) und ob alle Schüler sichtbar sind.
 * @param {App.Locals} locals
 * @returns {import('./db.js').Scope}
 */
export const scope = (locals) => ({ owner: locals.owner, all: !!locals.user?.seesAll });

/**
 * Wie `scope`, aber der Admin sieht beim Verwalten immer alle Schüler (um sie zuzuordnen).
 * @param {App.Locals} locals
 * @returns {import('./db.js').Scope}
 */
export const manageScope = (locals) => ({ owner: locals.owner, all: !!(locals.user?.seesAll || locals.user?.isAdmin) });

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

/** @param {App.Locals} locals */
export function requireAdmin(locals) {
	const user = requireTeacher(locals);
	if (!user.isAdmin) error(403, 'Nur für Admins');
	return user;
}

/**
 * Lehrkräfte nur Schüler, die sie sehen (zum Verwalten: Admin alle), Schüler nur sich selbst.
 * @param {App.Locals} locals
 * @param {number} studentId
 */
export function requireStudentAccess(locals, studentId) {
	const user = locals.user;
	if (user?.role === 'teacher') {
		if (!canSeeStudent(manageScope(locals), studentId)) error(404, 'Schüler nicht gefunden');
		return;
	}
	if (user?.role === 'student' && user.studentId === studentId) return;
	error(403, 'Du darfst nur deine eigenen Ziele bearbeiten');
}

/**
 * Ziele gehören einer Lehrkraft: bearbeiten nur in deren Klasse (Lehrkraft selbst bzw. ihr Schüler).
 * @param {App.Locals} locals
 * @param {number} goalId
 */
export function requireGoalAccess(locals, goalId) {
	const goal = getGoalOwner(goalId);
	if (goal.teacherId !== locals.owner) error(404, 'Ziel nicht gefunden');
	requireStudentAccess(locals, goal.studentId);
}

// --- Lehrkräfte ---

/** @param {unknown} value */
function validPassword(value) {
	const v = typeof value === 'string' ? value : '';
	if (v.length < 8) error(400, 'Passwort muss mindestens 8 Zeichen haben');
	if (v.length > 200) error(400, 'Passwort ist zu lang');
	return v;
}

/** @typedef {{ id: number, username: string, isAdmin: boolean, seesAll: boolean, students: number }} TeacherInfo */

/** @returns {TeacherInfo[]} */
export function listTeachers() {
	const rows = /** @type {{ id: number, username: string, isAdmin: number, seesAll: number, students: number }[]} */ (
		getDb()
			.prepare(
				`SELECT u.id, u.username, u.is_admin AS isAdmin, u.sees_all AS seesAll,
				   (SELECT COUNT(*) FROM student_teachers st WHERE st.teacher_id = u.id) AS students
				 FROM users u WHERE u.role = 'teacher' ORDER BY u.username`
			)
			.all()
	);
	return rows.map((r) => ({ ...r, isAdmin: r.isAdmin === 1, seesAll: r.seesAll === 1 }));
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
 * Admin-Rechte und „sieht alle Schüler“ setzen. Das eigene Admin-Recht kann man sich nicht nehmen.
 * @param {number} id
 * @param {Record<string, unknown>} input
 * @param {number} currentUserId
 */
export function setTeacherRights(id, input, currentUserId) {
	const db = getDb();
	if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'teacher'").get(id)) error(404, 'Lehrkraft nicht gefunden');
	if (input.isAdmin !== undefined) {
		if (id === currentUserId && input.isAdmin !== true) error(400, 'Du kannst dir das Admin-Recht nicht selbst nehmen');
		db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(input.isAdmin === true ? 1 : 0, id);
	}
	if (input.seesAll !== undefined) db.prepare('UPDATE users SET sees_all = ? WHERE id = ?').run(input.seesAll === true ? 1 : 0, id);
}

/**
 * Lehrkraft mit Auftrag, Zielen, Gruppen und Bildern löschen. Ihre Schüler ohne andere Lehrkraft gehen an den Admin.
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
	// Dateien merken, bevor Auftrag und Hintergrund-Bilder mit der Lehrkraft verschwinden.
	const assignment = /** @type {{ images: string } | undefined} */ (db.prepare('SELECT images FROM assignments WHERE teacher_id = ?').get(id));
	const backgrounds = /** @type {{ fileId: number }[]} */ (
		db.prepare('SELECT file_id AS fileId FROM backgrounds WHERE teacher_id = ?').all(id)
	);
	/** @type {number[]} */
	let images = [];
	try {
		images = JSON.parse(assignment?.images ?? '[]');
	} catch {
		// kaputte Liste → keine Bilder
	}
	const { changes } = db.prepare("DELETE FROM users WHERE id = ? AND role = 'teacher'").run(id);
	if (!changes) error(404, 'Lehrkraft nicht gefunden');
	deleteFilesIfUnused([...images, ...backgrounds.map((b) => b.fileId)]);
	claimOrphans();
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
	// Das Konto aus der .env ist immer Admin.
	if (!existing) {
		db.prepare("INSERT INTO users (username, password_hash, role, is_admin) VALUES (?, ?, 'teacher', 1)").run(
			username,
			hashPassword(password)
		);
		console.log(`[classRoom] Lehrerkonto „${username}“ (Admin) aus der .env angelegt.`);
	} else if (existing.role !== 'teacher') {
		console.warn(`[classRoom] TEACHER_USERNAME „${username}“ ist bereits ein Schülerkonto – bitte anderen Namen wählen.`);
	} else {
		db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
		if (!verifyPassword(password, existing.hash)) {
			db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), existing.id);
			console.log(`[classRoom] Passwort von „${username}“ auf den Wert aus der .env gesetzt.`);
		}
	}
}
