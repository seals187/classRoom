import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { error } from '@sveltejs/kit';
import { getConfig, TIME } from './config.js';
import { generatePassword, hashPassword } from './password.js';
import { suggestUsername as suggestFreeUsername } from '#lib/username.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
	id INTEGER PRIMARY KEY,
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS goals (
	id INTEGER PRIMARY KEY,
	student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
	text TEXT NOT NULL,
	done INTEGER NOT NULL DEFAULT 0,
	position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS goals_student ON goals(student_id);
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY,
	username TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
	student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS assignment (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	title TEXT NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	images TEXT NOT NULL DEFAULT '[]',
	format TEXT NOT NULL DEFAULT 'markdown',
	updated_at TEXT
);
CREATE TABLE IF NOT EXISTS files (
	id INTEGER PRIMARY KEY,
	mime TEXT NOT NULL,
	data BLOB NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

/** @param {import('better-sqlite3').Database} db */
function migrate(db) {
	const goalColumns = /** @type {{ name: string }[]} */ (db.prepare('PRAGMA table_info(goals)').all());
	if (!goalColumns.some((c) => c.name === 'kind')) {
		db.exec("ALTER TABLE goals ADD COLUMN kind TEXT NOT NULL DEFAULT 'self'");
	}
	db.exec('CREATE INDEX IF NOT EXISTS goals_student_kind ON goals(student_id, kind)');
	// Zeitpunkte (ms seit 1970) für „seit X min nichts abgehakt“ im Selbstlern-Modus.
	if (!goalColumns.some((c) => c.name === 'created_at')) {
		db.exec('ALTER TABLE goals ADD COLUMN created_at INTEGER');
	}
	const studentColumns = /** @type {{ name: string }[]} */ (db.prepare('PRAGMA table_info(students)').all());
	for (const kind of ['lesson', 'self']) {
		if (!studentColumns.some((c) => c.name === `last_check_${kind}`)) {
			db.exec(`ALTER TABLE students ADD COLUMN last_check_${kind} INTEGER`);
		}
	}

	const assignmentColumns = /** @type {{ name: string }[]} */ (db.prepare('PRAGMA table_info(assignment)').all());
	if (!assignmentColumns.some((c) => c.name === 'images')) {
		db.exec("ALTER TABLE assignment ADD COLUMN images TEXT NOT NULL DEFAULT '[]'");
		// Bilder standen früher als ![…](/api/files/N) im Text – in die eigene Bildliste verschieben.
		const row = /** @type {{ body: string } | undefined} */ (db.prepare('SELECT body FROM assignment WHERE id = 1').get());
		if (row) {
			const image = /!\[[^\]]*\]\(\/api\/files\/(\d+)\)/g;
			const ids = [...new Set([...row.body.matchAll(image)].map((m) => Number(m[1])))];
			const body = row.body.replace(image, '').replace(/\n{3,}/g, '\n\n').trim();
			db.prepare('UPDATE assignment SET body = ?, images = ? WHERE id = 1').run(body, JSON.stringify(ids));
		}
	}
	// Früher Markdown, jetzt bereinigtes HTML aus dem Editor. Alte Texte werden beim Lesen umgewandelt.
	if (!assignmentColumns.some((c) => c.name === 'format')) {
		db.exec("ALTER TABLE assignment ADD COLUMN format TEXT NOT NULL DEFAULT 'markdown'");
	}
}

/** Selbstlern-Ziele bleiben, Stundenziele werden mit „Neue Stunde“ geleert. */
export const GOAL_KINDS = /** @type {const} */ (['self', 'lesson']);

/** @param {unknown} value */
export function goalKind(value) {
	if (value === undefined) return 'self';
	if (!GOAL_KINDS.includes(/** @type {any} */ (value))) error(400, 'Unbekannte Zielart');
	return /** @type {(typeof GOAL_KINDS)[number]} */ (value);
}

/** @type {import('better-sqlite3').Database | undefined} */
let db;

// Lazy, damit beim Build (Route-Analyse) keine Datenbank angelegt wird.
export function getDb() {
	if (db) return db;
	const file = getConfig().databasePath;
	mkdirSync(dirname(file), { recursive: true });
	db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.exec(SCHEMA);
	migrate(db);
	return db;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} max
 */
export function requiredText(value, field, max) {
	const v = typeof value === 'string' ? value.trim() : '';
	if (!v) error(400, `${field} fehlt`);
	if (v.length > max) error(400, `${field} ist zu lang (max. ${max} Zeichen)`);
	return v;
}

/**
 * @param {unknown} value
 * @param {string} field
 */
function optionalTime(value, field) {
	const v = typeof value === 'string' ? value.trim() : '';
	if (v && !TIME.test(v)) error(400, `${field} ist keine gültige Uhrzeit`);
	return v;
}

const USERNAME = /^[a-z0-9._-]{3,40}$/;

/** @param {unknown} value */
export function normalizeUsername(value) {
	const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!USERNAME.test(v)) error(400, 'Benutzername: 3–40 Zeichen, nur a–z, 0–9, Punkt, Minus und Unterstrich');
	return v;
}

/**
 * @param {string} username
 * @param {number} [exceptUserId]
 */
export function assertUsernameFree(username, exceptUserId = 0) {
	if (getDb().prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, exceptUserId)) {
		error(409, `Benutzername „${username}“ ist schon vergeben`);
	}
}

/**
 * Freien Benutzernamen nach der gemeinsamen Regel vorschlagen (siehe #lib/username.js).
 * @param {string} firstName
 * @param {string} lastName
 */
function suggestUsername(firstName, lastName) {
	const taken = getDb().prepare('SELECT 1 FROM users WHERE username = ?');
	return suggestFreeUsername(firstName, lastName, (name) => !!taken.get(name));
}

/** Alle vergebenen Benutzernamen (Lehrkräfte und Schüler) – für den Vorschlag im Formular. */
export function listUsernames() {
	return /** @type {{ username: string }[]} */ (getDb().prepare('SELECT username FROM users').all()).map(
		(r) => r.username.toLowerCase()
	);
}

// --- Einstellungen: .env liefert die Standardwerte, gespeicherte Werte überschreiben sie ---

export function getSettings() {
	const { defaults } = getConfig();
	const rows = /** @type {{ key: string, value: string }[]} */ (
		getDb().prepare('SELECT key, value FROM settings').all()
	);
	const stored = Object.fromEntries(rows.filter((r) => r.key in defaults).map((r) => [r.key, r.value]));
	return { ...defaults, ...stored };
}

/** @param {Record<string, unknown>} input */
export function saveSettings(input) {
	const settings = {
		roomName: requiredText(input.roomName, 'Klassenraum', 60),
		startTime: optionalTime(input.startTime, 'Beginn'),
		returnTime: optionalTime(input.returnTime, 'Zurück um')
	};
	const upsert = getDb().prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	);
	getDb().transaction(() => {
		for (const [key, value] of Object.entries(settings)) upsert.run(key, value);
	})();
	return settings;
}

export function resetSettings() {
	getDb().prepare("DELETE FROM settings WHERE key IN ('roomName', 'startTime', 'returnTime')").run();
	return getSettings();
}

// --- Lautstärke-Ampel: .env liefert die Standardwerte, gespeicherte Werte überschreiben sie ---

/** @typedef {{ enabled: boolean, sensitivity: number, yellow: number, red: number }} NoiseSettings */

/** @returns {NoiseSettings} */
export function getNoiseSettings() {
	const defaults = getConfig().noise;
	const rows = /** @type {{ key: string, value: string }[]} */ (
		getDb().prepare("SELECT key, value FROM settings WHERE key LIKE 'noise.%'").all()
	);
	const stored = Object.fromEntries(rows.map((r) => [r.key.slice('noise.'.length), r.value]));
	return {
		enabled: stored.enabled === undefined ? defaults.enabled : stored.enabled === '1',
		sensitivity: stored.sensitivity === undefined ? defaults.sensitivity : Number(stored.sensitivity),
		yellow: stored.yellow === undefined ? defaults.yellow : Number(stored.yellow),
		red: stored.red === undefined ? defaults.red : Number(stored.red)
	};
}

/** @param {Record<string, unknown>} input */
export function saveNoiseSettings(input) {
	/**
	 * @param {unknown} value
	 * @param {string} field
	 * @param {number} min
	 * @param {number} max
	 */
	const int = (value, field, min, max) => {
		const n = Number(value);
		if (!Number.isInteger(n) || n < min || n > max) error(400, `${field} muss zwischen ${min} und ${max} liegen`);
		return n;
	};
	const settings = {
		enabled: Boolean(input.enabled),
		sensitivity: int(input.sensitivity, 'Empfindlichkeit', 1, 10),
		yellow: int(input.yellow, 'Gelb', 1, 99),
		red: int(input.red, 'Rot', 2, 100)
	};
	if (settings.red <= settings.yellow) error(400, 'Rot muss höher liegen als Gelb');
	const upsert = getDb().prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	);
	getDb().transaction(() => {
		upsert.run('noise.enabled', settings.enabled ? '1' : '0');
		upsert.run('noise.sensitivity', String(settings.sensitivity));
		upsert.run('noise.yellow', String(settings.yellow));
		upsert.run('noise.red', String(settings.red));
	})();
	return settings;
}

// --- Test-Modus: Start und Ende als Zeitstempel (ms), ebenfalls in der settings-Tabelle ---

/** @typedef {{ start: number, end: number }} TestTimer */

/** @returns {TestTimer | null} */
export function getTest() {
	const rows = /** @type {{ key: string, value: string }[]} */ (
		getDb().prepare("SELECT key, value FROM settings WHERE key IN ('test.start', 'test.end')").all()
	);
	const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
	const start = map['test.start'];
	const end = map['test.end'];
	return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

/** @param {Record<string, unknown>} input */
export function saveTest(input) {
	const start = Number(input.start);
	const end = Number(input.end);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) error(400, 'Ungültige Testzeit');
	if (end - start > 8 * 3_600_000) error(400, 'Ein Test darf höchstens 8 Stunden dauern');
	const upsert = getDb().prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	);
	getDb().transaction(() => {
		upsert.run('test.start', String(Math.round(start)));
		upsert.run('test.end', String(Math.round(end)));
	})();
	return getTest();
}

export function clearTest() {
	getDb().prepare("DELETE FROM settings WHERE key IN ('test.start', 'test.end')").run();
}

// --- Schüler & Ziele ---

/** @typedef {{ id: number, text: string, done: boolean }} Goal */
/**
 * `activeAt`: letztes Abhaken dieser Zielart, sonst Zeitpunkt des ersten Ziels (ms) – für „seit X min“.
 * @typedef {{ id: number, firstName: string, lastName: string, username: string | null, goals: Goal[], activeAt: number | null }} Student
 */
/** @typedef {{ username: string, password: string }} Credentials */

/**
 * @param {'self' | 'lesson'} [kind] Welche Ziele mitgeladen werden
 * @returns {Student[]}
 */
export function listStudents(kind = 'self') {
	const db = getDb();
	const lastCheck = goalKind(kind) === 'lesson' ? 's.last_check_lesson' : 's.last_check_self';
	const students = /** @type {(Omit<Student, 'goals' | 'activeAt'> & { lastCheck: number | null })[]} */ (
		db
			.prepare(
				`SELECT s.id, s.first_name AS firstName, s.last_name AS lastName, u.username, ${lastCheck} AS lastCheck
				 FROM students s LEFT JOIN users u ON u.student_id = s.id
				 ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`
			)
			.all()
	);
	const goals = /** @type {{ id: number, studentId: number, text: string, done: number, createdAt: number | null }[]} */ (
		db
			.prepare(
				'SELECT id, student_id AS studentId, text, done, created_at AS createdAt FROM goals WHERE kind = ? ORDER BY position, id'
			)
			.all(kind)
	);
	/** @type {Map<number, Student>} */
	const byId = new Map(students.map(({ lastCheck, ...s }) => [s.id, { ...s, goals: [], activeAt: lastCheck }]));
	/** @type {Map<number, number>} frühestes Ziel je Schüler */
	const firstGoal = new Map();
	for (const g of goals) {
		byId.get(g.studentId)?.goals.push({ id: g.id, text: g.text, done: g.done === 1 });
		if (g.createdAt !== null) firstGoal.set(g.studentId, Math.min(firstGoal.get(g.studentId) ?? g.createdAt, g.createdAt));
	}
	// Noch nie abgehakt → ab dem ersten Ziel zählen.
	for (const s of byId.values()) s.activeAt ??= firstGoal.get(s.id) ?? null;
	return [...byId.values()];
}

/**
 * Legt den Schüler samt Login an. Das Klartext-Passwort wird nur hier einmal zurückgegeben.
 * @param {Record<string, unknown>} input
 * @returns {{ student: Student, credentials: Credentials }}
 */
export function addStudent(input) {
	const firstName = requiredText(input.firstName, 'Vorname', 60);
	const lastName = requiredText(input.lastName, 'Nachname', 60);
	const wanted = typeof input.username === 'string' && input.username.trim() ? normalizeUsername(input.username) : null;
	if (wanted) assertUsernameFree(wanted);

	const db = getDb();
	return db.transaction(() => {
		const id = Number(
			db.prepare('INSERT INTO students (first_name, last_name) VALUES (?, ?)').run(firstName, lastName).lastInsertRowid
		);
		const username = wanted ?? suggestUsername(firstName, lastName);
		const password = generatePassword();
		db.prepare("INSERT INTO users (username, password_hash, role, student_id) VALUES (?, ?, 'student', ?)").run(
			username,
			hashPassword(password),
			id
		);
		return { student: { id, firstName, lastName, username, goals: [], activeAt: null }, credentials: { username, password } };
	})();
}

/**
 * Neues Passwort setzen – oder ein Login anlegen, falls der Schüler noch keins hat.
 * @param {number} studentId
 * @returns {Credentials}
 */
export function resetStudentPassword(studentId) {
	const db = getDb();
	const student = /** @type {{ firstName: string, lastName: string } | undefined} */ (
		db.prepare('SELECT first_name AS firstName, last_name AS lastName FROM students WHERE id = ?').get(studentId)
	);
	if (!student) error(404, 'Schüler nicht gefunden');
	const password = generatePassword();
	const user = /** @type {{ id: number, username: string } | undefined} */ (
		db.prepare('SELECT id, username FROM users WHERE student_id = ?').get(studentId)
	);
	if (user) {
		db.transaction(() => {
			db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
			db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
		})();
		return { username: user.username, password };
	}
	const username = suggestUsername(student.firstName, student.lastName);
	db.prepare("INSERT INTO users (username, password_hash, role, student_id) VALUES (?, ?, 'student', ?)").run(
		username,
		hashPassword(password),
		studentId
	);
	return { username, password };
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} input
 */
export function updateStudent(id, input) {
	const db = getDb();
	const current = /** @type {{ firstName: string, lastName: string, userId: number | null } | undefined} */ (
		db
			.prepare(
				`SELECT s.first_name AS firstName, s.last_name AS lastName, u.id AS userId
				 FROM students s LEFT JOIN users u ON u.student_id = s.id WHERE s.id = ?`
			)
			.get(id)
	);
	if (!current) error(404, 'Schüler nicht gefunden');
	const firstName = input.firstName === undefined ? current.firstName : requiredText(input.firstName, 'Vorname', 60);
	const lastName = input.lastName === undefined ? current.lastName : requiredText(input.lastName, 'Nachname', 60);
	const username = input.username === undefined ? undefined : normalizeUsername(input.username);
	if (username !== undefined) {
		if (!current.userId) error(400, 'Schüler hat noch keinen Zugang');
		assertUsernameFree(username, current.userId);
	}
	db.transaction(() => {
		db.prepare('UPDATE students SET first_name = ?, last_name = ? WHERE id = ?').run(firstName, lastName, id);
		if (username !== undefined) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, current.userId);
	})();
	return { id, firstName, lastName };
}

/** @param {number} id */
export function deleteStudent(id) {
	const { changes } = getDb().prepare('DELETE FROM students WHERE id = ?').run(id);
	if (!changes) error(404, 'Schüler nicht gefunden');
}

/** @typedef {{ done: number, total: number }} GoalCount */

/**
 * Erledigte/alle Ziele pro Schüler, getrennt nach Stundenzielen und Selbstlernen.
 * @returns {Record<number, { lesson: GoalCount, self: GoalCount }>}
 */
export function goalStats() {
	const rows = /** @type {{ studentId: number, kind: 'self' | 'lesson', total: number, done: number }[]} */ (
		getDb()
			.prepare('SELECT student_id AS studentId, kind, COUNT(*) AS total, SUM(done) AS done FROM goals GROUP BY student_id, kind')
			.all()
	);
	/** @type {Record<number, { lesson: GoalCount, self: GoalCount }>} */
	const stats = {};
	for (const r of rows) {
		stats[r.studentId] ??= { lesson: { done: 0, total: 0 }, self: { done: 0, total: 0 } };
		stats[r.studentId][r.kind] = { done: r.done, total: r.total };
	}
	return stats;
}

/** @param {number} goalId */
export function getGoalStudentId(goalId) {
	const row = /** @type {{ studentId: number } | undefined} */ (
		getDb().prepare('SELECT student_id AS studentId FROM goals WHERE id = ?').get(goalId)
	);
	if (!row) error(404, 'Ziel nicht gefunden');
	return row.studentId;
}

/**
 * @param {number} studentId
 * @param {Record<string, unknown>} input
 * @returns {Goal}
 */
export function addGoal(studentId, input) {
	const text = requiredText(input.text, 'Ziel', 200);
	const kind = goalKind(input.kind);
	const db = getDb();
	if (!db.prepare('SELECT 1 FROM students WHERE id = ?').get(studentId)) error(404, 'Schüler nicht gefunden');
	const { lastInsertRowid } = db
		.prepare(
			`INSERT INTO goals (student_id, text, kind, position, created_at)
			 VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM goals WHERE student_id = ?), ?)`
		)
		.run(studentId, text, kind, studentId, Date.now());
	return { id: Number(lastInsertRowid), text, done: false };
}

/**
 * Alle Ziele einer Art löschen (z. B. Stundenziele für eine neue Stunde).
 * @param {unknown} kind
 */
export function clearGoals(kind) {
	const { changes } = getDb().prepare('DELETE FROM goals WHERE kind = ?').run(goalKind(kind));
	return { deleted: changes };
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} input
 * @returns {Goal}
 */
export function updateGoal(id, input) {
	const db = getDb();
	const current = /** @type {{ text: string, done: number, kind: string, studentId: number } | undefined} */ (
		db.prepare('SELECT text, done, kind, student_id AS studentId FROM goals WHERE id = ?').get(id)
	);
	if (!current) error(404, 'Ziel nicht gefunden');
	const text = input.text === undefined ? current.text : requiredText(input.text, 'Ziel', 200);
	const done = input.done === undefined ? current.done === 1 : Boolean(input.done);
	db.transaction(() => {
		db.prepare('UPDATE goals SET text = ?, done = ? WHERE id = ?').run(text, done ? 1 : 0, id);
		// Zeitpunkt des letzten Abhakens pro Schüler und Art merken.
		if (done && current.done !== 1) {
			const column = current.kind === 'lesson' ? 'last_check_lesson' : 'last_check_self';
			db.prepare(`UPDATE students SET ${column} = ? WHERE id = ?`).run(Date.now(), current.studentId);
		}
	})();
	return { id, text, done };
}

/** @param {number} id */
export function deleteGoal(id) {
	const { changes } = getDb().prepare('DELETE FROM goals WHERE id = ?').run(id);
	if (!changes) error(404, 'Ziel nicht gefunden');
}
