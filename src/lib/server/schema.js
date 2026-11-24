// Datenbankschema: Tabellen anlegen und fehlende Spalten nachrüsten. Läuft bei jedem Öffnen der Datenbank
// (getDb) und ist wiederholbar. Datenumstellungen, die Lehrkräfte oder Klassen brauchen, stehen in migrations.js.

export const SCHEMA = `
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
export function migrateSchema(db) {
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
	// Ziel aus einem Schritt des Auftrags: fester Schlüssel des Schritts (data-step), damit der Fortschritt am
	// Schritt bleibt, auch wenn sein Text später geändert wird.
	addColumn(db, 'goals', 'step_key', 'TEXT');
}
