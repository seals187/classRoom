import { getDb } from './db.js';
import { migrateClasses } from './classes.js';
import { migrateAssignments, migrateStepKeys } from './assignment.js';

// Datenumstellungen nach einem Update, in genau dieser Reihenfolge (jede baut auf der vorigen auf).
// Das Schema (Tabellen, Spalten) richtet getDb() vorher ein, siehe schema.js. Jede Umstellung merkt sich selbst,
// ob sie schon gelaufen ist, und ist sonst wiederholbar.

/** @type {{ name: string, run: () => void }[]} */
export const MIGRATIONS = [
	// Nach einem Update: bestehende Schüler, Ziele, Auftrag usw. gehören dem Admin.
	{ name: 'claimOrphans', run: () => claimOrphans() },
	// Seit den Klassen: jede Lehrkraft bekommt einmalig eine Klasse mit ihren bisherigen Schülern.
	{ name: 'classes', run: () => migrateClasses() },
	// Seit mehreren Aufträgen: der bisherige wird der erste – aktiv, für die aktive Klasse, gleicher Link.
	{ name: 'assignments', run: () => migrateAssignments() },
	// Seit festen Schritt-Schlüsseln: Schritte bekommen data-step, Ziele aus Schritten den Schlüssel.
	{ name: 'stepKeys', run: () => migrateStepKeys() }
];

/** Alle Umstellungen der Reihe nach (beim Start, nach ensureEnvTeacher). */
export function runMigrations() {
	for (const m of MIGRATIONS) m.run();
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
