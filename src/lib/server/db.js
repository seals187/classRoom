import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { error } from '@sveltejs/kit';
import { getConfig, TIME } from './config.js';
import { generatePassword, hashPassword } from './password.js';
import { suggestUsername as suggestFreeUsername } from '#lib/username.js';
import { syncVisibility } from './classes.js';

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
CREATE TABLE IF NOT EXISTS student_groups (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	color TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS group_members (
	group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
	student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
	PRIMARY KEY (group_id, student_id)
);
CREATE TABLE IF NOT EXISTS backgrounds (
	id INTEGER PRIMARY KEY,
	file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
	student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Welche Lehrkraft welche Schüler hat (ein Schüler kann mehrere haben), mit „zuletzt abgehakt“ je Lehrkraft.
CREATE TABLE IF NOT EXISTS student_teachers (
	student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
	teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	last_check_lesson INTEGER,
	last_check_self INTEGER,
	PRIMARY KEY (student_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS student_teachers_teacher ON student_teachers(teacher_id);
-- Einstellungen pro Lehrkraft (Stunde, Räume, Wochenplan, Ampel, Test, Hintergrund).
CREATE TABLE IF NOT EXISTS teacher_settings (
	teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	key TEXT NOT NULL,
	value TEXT NOT NULL,
	PRIMARY KEY (teacher_id, key)
);
-- Klassen: Schüler und Lehrkräfte je in einer oder mehreren. Wer welche Schüler sieht (student_teachers)
-- wird daraus berechnet, siehe classes.js.
CREATE TABLE IF NOT EXISTS classes (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	color TEXT NOT NULL,
	archived INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS class_students (
	class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
	student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
	PRIMARY KEY (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS class_students_student ON class_students(student_id);
CREATE TABLE IF NOT EXISTS class_teachers (
	class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
	teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS class_teachers_teacher ON class_teachers(teacher_id);
CREATE TABLE IF NOT EXISTS assignments (
	teacher_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	images TEXT NOT NULL DEFAULT '[]',
	format TEXT NOT NULL DEFAULT 'html',
	updated_at TEXT
);
-- Beliebig viele Aufträge je Lehrkraft (löst „assignments“ mit einem Auftrag ab, siehe migrateAssignments).
-- planned_date: geplanter Tag (YYYY-MM-DD) oder leer; shown_at: zuletzt mit „Zeigen“ aktiv (ms), leer = Entwurf.
-- Der aktive Auftrag steht als teacher_settings.assignmentId.
CREATE TABLE IF NOT EXISTS assignment_items (
	id INTEGER PRIMARY KEY,
	teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT '',
	images TEXT NOT NULL DEFAULT '[]',
	format TEXT NOT NULL DEFAULT 'html',
	planned_date TEXT,
	archived INTEGER NOT NULL DEFAULT 0,
	shown_at INTEGER,
	share_code TEXT UNIQUE,
	share_expires INTEGER,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT
);
CREATE INDEX IF NOT EXISTS assignment_items_teacher ON assignment_items(teacher_id);
CREATE TABLE IF NOT EXISTS assignment_classes (
	assignment_id INTEGER NOT NULL REFERENCES assignment_items(id) ON DELETE CASCADE,
	class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
	PRIMARY KEY (assignment_id, class_id)
);
`;

/**
 * Spalte nachrüsten, falls sie fehlt.
 * @param {import('better-sqlite3').Database} db
 * @param {string} table
 * @param {string} column
 * @param {string} definition
 */
function addColumn(db, table, column, definition) {
	const columns = /** @type {{ name: string }[]} */ (db.prepare(`PRAGMA table_info(${table})`).all());
	if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

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
	// Selbst gewählter Hintergrund (siehe backgrounds.js), wenn die Lehrkraft das erlaubt.
	if (!studentColumns.some((c) => c.name === 'background')) {
		db.exec("ALTER TABLE students ADD COLUMN background TEXT NOT NULL DEFAULT ''");
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

	// Mehrere Lehrkräfte: Admin, „sieht alle Schüler“ und die Lehrkraft, der Ziele, Gruppen und Bilder gehören.
	addColumn(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
	addColumn(db, 'users', 'sees_all', 'INTEGER NOT NULL DEFAULT 0');
	addColumn(db, 'goals', 'teacher_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
	addColumn(db, 'student_groups', 'teacher_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
	addColumn(db, 'backgrounds', 'teacher_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
	db.exec('CREATE INDEX IF NOT EXISTS goals_teacher_kind ON goals(teacher_id, kind)');
	// Öffentlicher Link zum Auftrag (QR-Code): Code und Ablauf (ms seit 1970), leer = nicht geteilt.
	addColumn(db, 'assignments', 'share_code', 'TEXT');
	addColumn(db, 'assignments', 'share_expires', 'INTEGER');
	db.exec('CREATE UNIQUE INDEX IF NOT EXISTS assignments_share_code ON assignments(share_code)');
	// „Anmelden als …“: Admin, der gerade als diese Lehrkraft bzw. dieser Schüler angemeldet ist.
	addColumn(db, 'sessions', 'admin_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
	// Test-Schüler: sieht nur der Admin (zum Ausprobieren der Schüler-Sicht).
	addColumn(db, 'students', 'is_test', 'INTEGER NOT NULL DEFAULT 0');
}

/**
 * Alles ohne Lehrkraft dem Admin geben: beim Update von einer Version mit nur einer gemeinsamen Klasse
 * (Schüler, Ziele, Gruppen, Bilder, Auftrag) und wenn eine Lehrkraft gelöscht wurde (ihre Schüler).
 * Die früher gemeinsamen Einstellungen bekommt beim Update jede Lehrkraft als Kopie.
 */
export function claimOrphans() {
	const db = getDb();
	let admin = /** @type {{ id: number } | undefined} */ (
		db.prepare("SELECT id FROM users WHERE role = 'teacher' AND is_admin = 1 ORDER BY id LIMIT 1").get()
	);
	if (!admin) {
		admin = /** @type {{ id: number } | undefined} */ (
			db.prepare("SELECT id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1").get()
		);
		if (!admin) return;
		db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(admin.id);
	}
	const id = admin.id;
	db.transaction(() => {
		// Vor den Klassen: Schüler ohne Lehrkraft an den Admin. Danach bestimmen die Klassen, wer wen sieht.
		if (!db.prepare("SELECT 1 FROM settings WHERE key = 'migrated.classes'").get()) {
			db.prepare(
				`INSERT INTO student_teachers (student_id, teacher_id)
				 SELECT s.id, ? FROM students s WHERE NOT EXISTS (SELECT 1 FROM student_teachers st WHERE st.student_id = s.id)`
			).run(id);
		}
		db.prepare('UPDATE goals SET teacher_id = ? WHERE teacher_id IS NULL').run(id);
		db.prepare('UPDATE student_groups SET teacher_id = ? WHERE teacher_id IS NULL').run(id);
		db.prepare('UPDATE backgrounds SET teacher_id = ? WHERE teacher_id IS NULL AND student_id IS NULL').run(id);
		db.prepare(
			`INSERT OR IGNORE INTO assignments (teacher_id, title, body, images, format, updated_at)
			 SELECT ?, title, body, images, format, updated_at FROM assignment WHERE id = 1`
		).run(id);
		db.prepare('DELETE FROM assignment').run();
		if (!db.prepare("SELECT 1 FROM settings WHERE key = 'migrated.teacherSettings'").get()) {
			db.prepare(
				`INSERT OR IGNORE INTO teacher_settings (teacher_id, key, value)
				 SELECT u.id, s.key, s.value FROM users u, settings s WHERE u.role = 'teacher'`
			).run();
			db.prepare('DELETE FROM settings').run();
			db.prepare("INSERT INTO settings (key, value) VALUES ('migrated.teacherSettings', '1')").run();
		}
	})();
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

// --- Einstellungen pro Lehrkraft: .env liefert die Standardwerte, gespeicherte Werte überschreiben sie ---

/**
 * @param {number} owner Lehrkraft
 * @param {string[]} keys
 * @returns {Record<string, string>}
 */
export function readSettings(owner, keys) {
	const rows = /** @type {{ key: string, value: string }[]} */ (
		getDb()
			.prepare(`SELECT key, value FROM teacher_settings WHERE teacher_id = ? AND key IN (${keys.map(() => '?').join(', ')})`)
			.all(owner, ...keys)
	);
	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** @param {number} owner @param {Record<string, string>} entries */
export function writeSettings(owner, entries) {
	const db = getDb();
	const upsert = db.prepare(
		`INSERT INTO teacher_settings (teacher_id, key, value) VALUES (?, ?, ?)
		 ON CONFLICT(teacher_id, key) DO UPDATE SET value = excluded.value`
	);
	db.transaction(() => {
		for (const [key, value] of Object.entries(entries)) upsert.run(owner, key, value);
	})();
}

/** @param {number} owner @param {string[]} keys */
function deleteSettings(owner, keys) {
	getDb()
		.prepare(`DELETE FROM teacher_settings WHERE teacher_id = ? AND key IN (${keys.map(() => '?').join(', ')})`)
		.run(owner, ...keys);
}

/** @param {number} owner */
export function getSettings(owner) {
	const { defaults } = getConfig();
	const stored = readSettings(owner, Object.keys(defaults));
	const roomChange = 'roomChange' in stored ? stored.roomChange === '1' : defaults.roomChange;
	return { ...defaults, ...stored, roomChange };
}

/**
 * Raum und Raumwechsel sind optional – fehlen sie, bleiben die bisherigen Werte.
 * @param {number} owner
 * @param {Record<string, unknown>} input
 */
export function saveSettings(owner, input) {
	const current = getSettings(owner);
	const roomChange = input.roomChange === undefined ? current.roomChange : input.roomChange === true;
	const roomInput = typeof input.roomName === 'string' ? input.roomName.trim() : '';
	const settings = {
		// Den Raum braucht es nur mit Raumwechsel; ohne bleibt der bisherige stehen.
		roomName: roomChange ? requiredText(input.roomName ?? current.roomName, 'Raum', 60) : roomInput.slice(0, 60) || current.roomName,
		roomChange,
		startTime: optionalTime(input.startTime, 'Beginn'),
		returnTime: optionalTime(input.returnTime, 'Ende')
	};
	// Aufräumen ab … min vor Schluss: optional, sonst bleibt der bisherige Wert.
	const warnMinutes = input.warnMinutes === undefined ? null : Math.round(Number(input.warnMinutes));
	if (warnMinutes !== null && !(warnMinutes >= 0 && warnMinutes <= 60)) error(400, 'Aufräumen: 0 bis 60 Minuten');
	writeSettings(owner, {
		...Object.fromEntries(
			Object.entries(settings).map(([key, value]) => [key, typeof value === 'boolean' ? (value ? '1' : '0') : value])
		),
		...(warnMinutes !== null && { warnMinutes: String(warnMinutes) }),
		// Schüler mit mehreren Lehrkräften sehen die Lehrkraft, die zuletzt eine Stunde gestartet hat.
		...(settings.startTime && settings.startTime !== current.startTime && { lessonStartedAt: String(Date.now()) })
	});
	return settings;
}

/**
 * @param {string | undefined} json
 * @returns {unknown[] | null}
 */
function parseList(json) {
	if (json === undefined) return null;
	try {
		const list = JSON.parse(json);
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

/** Räume zur Auswahl im Menü; ohne gespeicherte Liste der aktuelle Raum. @param {number} owner @returns {string[]} */
export function getRooms(owner) {
	const list = parseList(readSettings(owner, ['rooms']).rooms);
	if (!list) return [getSettings(owner).roomName];
	return /** @type {string[]} */ (list.filter((v) => typeof v === 'string'));
}

/** @param {number} owner @param {unknown} input Liste der Räume (doppelte und leere fallen weg, höchstens 20) */
export function saveRooms(owner, input) {
	if (!Array.isArray(input)) error(400, 'Keine Raumliste angegeben');
	const list = [
		...new Set(input.map((v) => (typeof v === 'string' ? v.trim().slice(0, 60) : '')).filter(Boolean))
	].slice(0, 20);
	writeSettings(owner, { rooms: JSON.stringify(list) });
	return list;
}

/**
 * Wochenplan: geplante Stunden pro Wochentag (0 = Montag).
 * @param {number} owner
 * @returns {import('#lib/schedule.js').Slot[]}
 */
export function getSchedule(owner) {
	return /** @type {import('#lib/schedule.js').Slot[]} */ (parseList(readSettings(owner, ['schedule']).schedule) ?? []);
}

/** @param {number} owner @param {unknown} input Liste der Stunden (höchstens 100), sortiert nach Tag und Beginn gespeichert */
export function saveSchedule(owner, input) {
	if (!Array.isArray(input)) error(400, 'Kein Wochenplan angegeben');
	if (input.length > 100) error(400, 'Höchstens 100 Stunden im Wochenplan');
	const list = input.map((slot) => {
		const day = Number(slot?.day);
		if (!Number.isInteger(day) || day < 0 || day > 6) error(400, 'Ungültiger Wochentag');
		const start = optionalTime(slot.start, 'Beginn').slice(0, 5);
		const end = optionalTime(slot.end, 'Ende').slice(0, 5);
		if (!start || !end) error(400, 'Jede Stunde braucht Beginn und Ende');
		if (start === end) error(400, 'Beginn und Ende sind gleich');
		const room = typeof slot.room === 'string' ? slot.room.trim().slice(0, 60) : '';
		return { day, start, end, room };
	});
	list.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
	writeSettings(owner, { schedule: JSON.stringify(list) });
	return list;
}

/** Aufräumen ab … min vor Schluss: im Menü gespeichert, sonst WARN_MINUTES aus der .env. @param {number} owner */
export function getWarnMinutes(owner) {
	const { warnMinutes } = readSettings(owner, ['warnMinutes']);
	return warnMinutes === undefined ? getConfig().warnMinutes : Number(warnMinutes);
}

/** @param {number} owner */
export function resetSettings(owner) {
	deleteSettings(owner, ['startTime', 'returnTime']);
	return getSettings(owner);
}

// --- Lautstärke-Ampel: .env liefert die Standardwerte, gespeicherte Werte überschreiben sie ---

/** @typedef {{ enabled: boolean, sensitivity: number, yellow: number, red: number }} NoiseSettings */

const NOISE_KEYS = ['enabled', 'sensitivity', 'yellow', 'red'];

/** @param {number} owner @returns {NoiseSettings} */
export function getNoiseSettings(owner) {
	const defaults = getConfig().noise;
	const rows = readSettings(owner, NOISE_KEYS.map((k) => `noise.${k}`));
	const stored = Object.fromEntries(Object.entries(rows).map(([key, value]) => [key.slice('noise.'.length), value]));
	return {
		enabled: stored.enabled === undefined ? defaults.enabled : stored.enabled === '1',
		sensitivity: stored.sensitivity === undefined ? defaults.sensitivity : Number(stored.sensitivity),
		yellow: stored.yellow === undefined ? defaults.yellow : Number(stored.yellow),
		red: stored.red === undefined ? defaults.red : Number(stored.red)
	};
}

/** @param {number} owner @param {Record<string, unknown>} input */
export function saveNoiseSettings(owner, input) {
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
	writeSettings(owner, {
		'noise.enabled': settings.enabled ? '1' : '0',
		'noise.sensitivity': String(settings.sensitivity),
		'noise.yellow': String(settings.yellow),
		'noise.red': String(settings.red)
	});
	return settings;
}

// --- Test-Modus: Start und Ende als Zeitstempel (ms), ebenfalls bei den Einstellungen der Lehrkraft ---

/** @typedef {{ start: number, end: number }} TestTimer */

/** @param {number} owner @returns {TestTimer | null} */
export function getTest(owner) {
	const map = readSettings(owner, ['test.start', 'test.end']);
	const start = Number(map['test.start'] ?? NaN);
	const end = Number(map['test.end'] ?? NaN);
	return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

/** @param {number} owner @param {Record<string, unknown>} input */
export function saveTest(owner, input) {
	const start = Number(input.start);
	const end = Number(input.end);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) error(400, 'Ungültige Testzeit');
	if (end - start > 8 * 3_600_000) error(400, 'Ein Test darf höchstens 8 Stunden dauern');
	writeSettings(owner, { 'test.start': String(Math.round(start)), 'test.end': String(Math.round(end)) });
	return getTest(owner);
}

/** @param {number} owner */
export function clearTest(owner) {
	deleteSettings(owner, ['test.start', 'test.end']);
}

// --- Schüler & Ziele ---

/** @typedef {{ id: number, text: string, done: boolean }} Goal */
/**
 * `activeAt`: letztes Abhaken dieser Zielart, sonst Zeitpunkt des ersten Ziels (ms) – für „seit X min“.
 * `isTest`: Test-Schüler, nur für den Admin sichtbar.
 * @typedef {{ id: number, firstName: string, lastName: string, username: string | null, isTest: boolean, goals: Goal[], activeAt: number | null }} Student
 */
/** @typedef {{ username: string, password: string }} Credentials */
/**
 * Wessen Daten gelten (`owner`: Lehrkraft), ob alle Schüler sichtbar sind (Admin in der Verwaltung) oder nur
 * die der eigenen Klassen, und optional nur die Schüler einer Klasse (`classId`, die aktive Klasse der Stunde).
 * @typedef {{ owner: number, all: boolean, classId?: number | null }} Scope
 */

/**
 * Darf diese Lehrkraft den Schüler sehen (Schüler einer ihrer Klassen bzw. Admin)?
 * @param {Scope} scope
 * @param {number} studentId
 */
export function canSeeStudent(scope, studentId) {
	const db = getDb();
	if (scope.all) return !!db.prepare('SELECT 1 FROM students WHERE id = ?').get(studentId);
	return !!db.prepare('SELECT 1 FROM student_teachers WHERE student_id = ? AND teacher_id = ?').get(studentId, scope.owner);
}

/** Anzahl sichtbarer Schüler und aller Lehrkräfte – für die Zahlen im Menü. @param {Scope} scope */
export function countPeople(scope) {
	const db = getDb();
	const count = (/** @type {string} */ sql, /** @type {unknown[]} */ ...params) =>
		/** @type {{ n: number }} */ (db.prepare(sql).get(...params)).n;
	return {
		students: scope.all
			? count('SELECT COUNT(*) AS n FROM students')
			: count('SELECT COUNT(*) AS n FROM student_teachers WHERE teacher_id = ?', scope.owner),
		teachers: count("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher'"),
		classes: scope.all
			? count('SELECT COUNT(*) AS n FROM classes WHERE archived = 0')
			: count(
					`SELECT COUNT(*) AS n FROM classes c JOIN class_teachers ct ON ct.class_id = c.id
					 WHERE c.archived = 0 AND ct.teacher_id = ?`,
					scope.owner
				)
	};
}

/**
 * Sichtbare Schüler mit den Zielen dieser Lehrkraft.
 * @param {Scope} scope
 * @param {'self' | 'lesson'} [kind] Welche Ziele mitgeladen werden
 * @returns {Student[]}
 */
export function listStudents(scope, kind = 'self') {
	const db = getDb();
	const lastCheck = goalKind(kind) === 'lesson' ? 'st.last_check_lesson' : 'st.last_check_self';
	const rows = /** @type {(Omit<Student, 'goals' | 'activeAt' | 'isTest'> & { lastCheck: number | null, isTest: number })[]} */ (
		db
			.prepare(
				`SELECT s.id, s.first_name AS firstName, s.last_name AS lastName, u.username, s.is_test AS isTest,
				   ${lastCheck} AS lastCheck
				 FROM students s
				 LEFT JOIN users u ON u.student_id = s.id
				 LEFT JOIN student_teachers st ON st.student_id = s.id AND st.teacher_id = ?
				 WHERE CASE WHEN ? THEN s.id IN (SELECT student_id FROM class_students WHERE class_id = ?)
				     AND (s.is_test = 0 OR EXISTS (SELECT 1 FROM users a WHERE a.id = ? AND a.is_admin = 1))
				   ELSE ? OR st.teacher_id IS NOT NULL END
				 ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`
			)
			.all(scope.owner, scope.classId ? 1 : 0, scope.classId ?? 0, scope.owner, scope.all ? 1 : 0)
	);
	const students = rows.map((r) => ({ ...r, isTest: r.isTest === 1 }));
	const goals = /** @type {{ id: number, studentId: number, text: string, done: number, createdAt: number | null }[]} */ (
		db
			.prepare(
				`SELECT id, student_id AS studentId, text, done, created_at AS createdAt FROM goals
				 WHERE kind = ? AND teacher_id = ? ORDER BY position, id`
			)
			.all(kind, scope.owner)
	);
	/** @type {Map<number, Student>} */
	const byId = new Map(students.map(({ lastCheck, ...s }) => [s.id, { ...s, goals: [], activeAt: lastCheck }]));
	/** @type {Map<number, number>} frühestes Ziel je Schüler */
	const firstGoal = new Map();
	for (const g of goals) {
		byId.get(g.studentId)?.goals.push({ id: g.id, text: g.text, done: g.done === 1 });
		if (g.createdAt !== null) firstGoal.set(g.studentId, Math.min(firstGoal.get(g.studentId) ?? g.createdAt, g.createdAt));
	}
	// Ab dem letzten Abhaken zählen – noch nie (oder zuletzt vor den jetzigen Zielen) → ab dem ersten Ziel.
	for (const s of byId.values()) {
		const first = firstGoal.get(s.id) ?? null;
		s.activeAt = s.activeAt === null || (first !== null && first > s.activeAt) ? first : s.activeAt;
	}
	return [...byId.values()];
}

/**
 * Mehrere Schüler auf einmal in eine Klasse (z. B. aus einer eingefügten Liste). Alles oder nichts.
 * @param {number} classId
 * @param {unknown} list [{ firstName, lastName, username? }]
 */
export function addStudents(classId, list) {
	if (!Array.isArray(list) || list.length === 0) error(400, 'Keine Schüler angegeben');
	if (list.length > 200) error(400, 'Höchstens 200 Schüler auf einmal');
	return getDb().transaction(() => list.map((input) => addStudent(classId, input ?? {})))();
}

/**
 * Legt den Schüler samt Login in der Klasse an. Das Klartext-Passwort wird nur hier einmal zurückgegeben.
 * @param {number} classId
 * @param {Record<string, unknown>} input
 * @returns {{ student: Student, credentials: Credentials }}
 */
export function addStudent(classId, input) {
	const firstName = requiredText(input.firstName, 'Vorname', 60);
	const lastName = requiredText(input.lastName, 'Nachname', 60);
	// Test-Schüler (nur Admin, siehe API): sieht keine andere Lehrkraft.
	const isTest = input.isTest === true;
	const wanted = typeof input.username === 'string' && input.username.trim() ? normalizeUsername(input.username) : null;
	if (wanted) assertUsernameFree(wanted);

	const db = getDb();
	return db.transaction(() => {
		const id = Number(
			db.prepare('INSERT INTO students (first_name, last_name, is_test) VALUES (?, ?, ?)').run(firstName, lastName, isTest ? 1 : 0).lastInsertRowid
		);
		db.prepare('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)').run(classId, id);
		const username = wanted ?? suggestUsername(firstName, lastName);
		const password = generatePassword();
		db.prepare("INSERT INTO users (username, password_hash, role, student_id) VALUES (?, ?, 'student', ?)").run(
			username,
			hashPassword(password),
			id
		);
		syncVisibility();
		return { student: { id, firstName, lastName, username, isTest, goals: [], activeAt: null }, credentials: { username, password } };
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
		// Test-Schüler an/aus (nur Admin, siehe API) – ändert, welche Lehrkräfte ihn sehen.
		if (typeof input.isTest === 'boolean') {
			db.prepare('UPDATE students SET is_test = ? WHERE id = ?').run(input.isTest ? 1 : 0, id);
			syncVisibility();
		}
	})();
	return { id, firstName, lastName };
}

/**
 * Schüler ganz löschen. Ohne Admin-Recht nur, wenn er in keiner fremden Klasse ist – sonst nur aus der
 * eigenen Klasse entfernen.
 * @param {Scope} scope
 * @param {number} id
 */
export function deleteStudent(scope, id) {
	const db = getDb();
	if (!scope.all) {
		const foreign = /** @type {{ name: string } | undefined} */ (
			db
				.prepare(
					`SELECT c.name FROM class_students cs JOIN classes c ON c.id = cs.class_id WHERE cs.student_id = ?
					 AND NOT EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.teacher_id = ?)`
				)
				.get(id, scope.owner)
		);
		if (foreign) error(409, `Der Schüler ist auch in der Klasse „${foreign.name}“ – bitte nur aus deiner Klasse entfernen`);
	}
	const { changes } = db.prepare('DELETE FROM students WHERE id = ?').run(id);
	if (!changes) error(404, 'Schüler nicht gefunden');
	return { removed: 'student' };
}

/** @typedef {{ done: number, total: number }} GoalCount */

/**
 * Erledigte/alle Ziele dieser Lehrkraft pro Schüler, getrennt nach Stundenzielen und Selbstlernen.
 * @param {number} owner
 * @returns {Record<number, { lesson: GoalCount, self: GoalCount }>}
 */
export function goalStats(owner) {
	const rows = /** @type {{ studentId: number, kind: 'self' | 'lesson', total: number, done: number }[]} */ (
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

/** @param {number} goalId */
export function getGoalOwner(goalId) {
	const row = /** @type {{ studentId: number, teacherId: number } | undefined} */ (
		getDb().prepare('SELECT student_id AS studentId, teacher_id AS teacherId FROM goals WHERE id = ?').get(goalId)
	);
	if (!row) error(404, 'Ziel nicht gefunden');
	return row;
}

/**
 * @param {number} owner Lehrkraft, zu der das Ziel gehört
 * @param {number} studentId
 * @param {Record<string, unknown>} input
 * @returns {Goal}
 */
export function addGoal(owner, studentId, input) {
	const text = requiredText(input.text, 'Ziel', 200);
	const kind = goalKind(input.kind);
	const db = getDb();
	if (!db.prepare('SELECT 1 FROM students WHERE id = ?').get(studentId)) error(404, 'Schüler nicht gefunden');
	const { lastInsertRowid } = db
		.prepare(
			`INSERT INTO goals (student_id, teacher_id, text, kind, position, created_at)
			 VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM goals WHERE student_id = ? AND teacher_id = ?), ?)`
		)
		.run(studentId, owner, text, kind, studentId, owner, Date.now());
	return { id: Number(lastInsertRowid), text, done: false };
}

/**
 * Dieselben Ziele allen sichtbaren Schülern geben (z. B. die Schritte des Auftrags als Stundenziele).
 * Ziele, die ein Schüler mit gleichem Text schon hat, werden übersprungen.
 * @param {Scope} scope
 * @param {unknown} texts
 * @param {unknown} kind
 * @param {boolean} [replace] vorher alle Ziele dieser Art löschen (bei den gewählten Schülern)
 * @param {number[] | null} [studentIds] nur diese Schüler, sonst alle
 */
export function addGoalsToAll(scope, texts, kind, replace = false, studentIds = null) {
	if (!Array.isArray(texts) || texts.length === 0 || texts.length > 30) error(400, 'Keine Ziele angegeben');
	const list = [...new Set(texts.map((t) => requiredText(t, 'Ziel', 200)))];
	const k = goalKind(kind);
	const db = getDb();
	const all = listStudents(scope).map((s) => ({ id: s.id }));
	// Nur ausgewählte Schüler („Einzelne…“) – unbekannte IDs fallen weg.
	const students = Array.isArray(studentIds) ? all.filter((s) => studentIds.includes(s.id)) : all;
	if (students.length === 0) error(400, 'Keine Schüler ausgewählt');
	const exists = db.prepare('SELECT 1 FROM goals WHERE student_id = ? AND teacher_id = ? AND kind = ? AND text = ?');
	/** @type {number[]} */
	const goalIds = [];
	db.transaction(() => {
		// Nur bei diesen Schülern (der aktiven Klasse) ersetzen – Ziele in anderen Klassen bleiben.
		if (replace) {
			for (const { id } of students) {
				db.prepare('DELETE FROM goals WHERE student_id = ? AND teacher_id = ? AND kind = ?').run(id, scope.owner, k);
				db.prepare(`UPDATE student_teachers SET last_check_${k} = NULL WHERE student_id = ? AND teacher_id = ?`).run(
					id,
					scope.owner
				);
			}
		}
		for (const { id } of students) {
			for (const text of list) {
				if (exists.get(id, scope.owner, k, text)) continue;
				goalIds.push(addGoal(scope.owner, id, { text, kind: k }).id);
			}
		}
	})();
	return { added: goalIds.length, students: students.length, goalIds };
}

/**
 * Mehrere eigene Ziele auf einmal löschen („Rückgängig“ nach dem Senden).
 * @param {number} owner
 * @param {unknown} ids
 */
export function deleteGoals(owner, ids) {
	if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) error(400, 'Ungültige Ziele');
	const db = getDb();
	const del = db.prepare('DELETE FROM goals WHERE id = ? AND teacher_id = ?');
	let deleted = 0;
	db.transaction(() => {
		for (const id of ids) deleted += del.run(id, owner).changes;
	})();
	return { deleted };
}

/**
 * Alle eigenen Ziele einer Art löschen (z. B. Stundenziele für eine neue Stunde).
 * @param {number} owner
 * @param {unknown} kind
 */
export function clearGoals(owner, kind) {
	const db = getDb();
	const k = goalKind(kind);
	const { changes } = db.transaction(() => {
		// Neue Stunde → die Zeit seit dem letzten Abhaken beginnt neu.
		db.prepare(`UPDATE student_teachers SET last_check_${k} = NULL WHERE teacher_id = ?`).run(owner);
		return db.prepare('DELETE FROM goals WHERE kind = ? AND teacher_id = ?').run(k, owner);
	})();
	return { deleted: changes };
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} input
 * @returns {Goal}
 */
export function updateGoal(id, input) {
	const db = getDb();
	const current = /** @type {{ text: string, done: number, kind: string, studentId: number, teacherId: number } | undefined} */ (
		db
			.prepare('SELECT text, done, kind, student_id AS studentId, teacher_id AS teacherId FROM goals WHERE id = ?')
			.get(id)
	);
	if (!current) error(404, 'Ziel nicht gefunden');
	const text = input.text === undefined ? current.text : requiredText(input.text, 'Ziel', 200);
	const done = input.done === undefined ? current.done === 1 : Boolean(input.done);
	db.transaction(() => {
		db.prepare('UPDATE goals SET text = ?, done = ? WHERE id = ?').run(text, done ? 1 : 0, id);
		// Zeitpunkt des letzten Abhakens pro Schüler, Lehrkraft und Art merken.
		if (done && current.done !== 1) {
			const column = current.kind === 'lesson' ? 'last_check_lesson' : 'last_check_self';
			db.prepare(`UPDATE student_teachers SET ${column} = ? WHERE student_id = ? AND teacher_id = ?`).run(
				Date.now(),
				current.studentId,
				current.teacherId
			);
		}
	})();
	return { id, text, done };
}

/** @param {number} id */
export function deleteGoal(id) {
	const { changes } = getDb().prepare('DELETE FROM goals WHERE id = ?').run(id);
	if (!changes) error(404, 'Ziel nicht gefunden');
}
