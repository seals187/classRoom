import { error } from '@sveltejs/kit';
import { getDb, readSettings, requiredText, resetStudentPassword, writeSettings } from './db.js';

// Klassen: Schüler und Lehrkräfte sind je in einer oder mehreren Klassen. Eine Lehrkraft sieht die Schüler
// ihrer (nicht archivierten) Klassen – das steht abgeleitet in student_teachers (samt „zuletzt abgehakt“),
// damit alle bisherigen Abfragen und Rechte unverändert gelten. Nach jeder Änderung: syncVisibility().

/** Farben zur Auswahl (gut unterscheidbar, hell und dunkel lesbar). */
export const CLASS_COLORS = ['#3b6fe0', '#f08a3c', '#8b5cd6', '#2f9e64', '#e0484a', '#1f9bb0', '#d6489a', '#c99a06'];

/**
 * @typedef {{ id: number, firstName: string, lastName: string }} ClassStudent
 * @typedef {{
 *   id: number, name: string, color: string, archived: boolean,
 *   students: ClassStudent[], teachers: { id: number, username: string }[]
 * }} SchoolClass
 * @typedef {{ id: number, isAdmin: boolean }} Viewer
 */

/** Sichtbarkeit (student_teachers) aus den Klassen neu berechnen; „zuletzt abgehakt“ bleibt erhalten. */
export function syncVisibility() {
	const db = getDb();
	const pairs = `SELECT DISTINCT cs.student_id, ct.teacher_id FROM class_students cs
		JOIN class_teachers ct ON ct.class_id = cs.class_id
		JOIN classes c ON c.id = cs.class_id WHERE c.archived = 0`;
	db.transaction(() => {
		db.prepare(`DELETE FROM student_teachers WHERE (student_id, teacher_id) NOT IN (${pairs})`).run();
		db.prepare(`INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) ${pairs}`).run();
	})();
}

/** @param {number} i */
const colorAt = (i) => CLASS_COLORS[i % CLASS_COLORS.length];

/** @param {unknown} value */
function validColor(value) {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

/**
 * Einmalig beim Update: Jede Lehrkraft bekommt eine Klasse mit ihren bisherigen Schülern. Der (erste) Admin
 * heißt „Meine Klasse“, die anderen „Klasse <Name>“. Wer „sieht alle Schüler“ hatte, bekommt alle Klassen.
 */
export function migrateClasses() {
	const db = getDb();
	if (db.prepare("SELECT 1 FROM settings WHERE key = 'migrated.classes'").get()) return;
	const teachers = /** @type {{ id: number, username: string, isAdmin: number, seesAll: number }[]} */ (
		db
			.prepare("SELECT id, username, is_admin AS isAdmin, sees_all AS seesAll FROM users WHERE role = 'teacher' ORDER BY is_admin DESC, id")
			.all()
	);
	db.transaction(() => {
		/** @type {number[]} */
		const created = [];
		teachers.forEach((t, i) => {
			const name = i === 0 ? 'Meine Klasse' : `Klasse ${t.username}`;
			const id = Number(db.prepare('INSERT INTO classes (name, color) VALUES (?, ?)').run(name, colorAt(i)).lastInsertRowid);
			created.push(id);
			db.prepare('INSERT INTO class_teachers (class_id, teacher_id) VALUES (?, ?)').run(id, t.id);
			db.prepare('INSERT OR IGNORE INTO class_students (class_id, student_id) SELECT ?, student_id FROM student_teachers WHERE teacher_id = ?').run(
				id,
				t.id
			);
		});
		for (const t of teachers.filter((t) => t.seesAll === 1)) {
			for (const id of created) db.prepare('INSERT OR IGNORE INTO class_teachers (class_id, teacher_id) VALUES (?, ?)').run(id, t.id);
		}
		db.prepare('UPDATE users SET sees_all = 0').run();
		db.prepare("INSERT INTO settings (key, value) VALUES ('migrated.classes', '1')").run();
	})();
	syncVisibility();
}

/**
 * Klassen, die jemand sieht: der Admin alle, sonst die eigenen.
 * @param {Viewer} viewer
 * @param {{ archived?: boolean }} [options] auch archivierte (Verwaltung)
 * @returns {SchoolClass[]}
 */
export function listClasses(viewer, { archived = false } = {}) {
	const db = getDb();
	const rows = /** @type {{ id: number, name: string, color: string, archived: number }[]} */ (
		db
			.prepare(
				`SELECT c.id, c.name, c.color, c.archived FROM classes c
				 WHERE (? OR EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.teacher_id = ?))
				   AND (? OR c.archived = 0)
				 ORDER BY c.archived, c.name COLLATE NOCASE`
			)
			.all(viewer.isAdmin ? 1 : 0, viewer.id, archived ? 1 : 0)
	);
	const students = /** @type {(ClassStudent & { classId: number })[]} */ (
		db
			.prepare(
				`SELECT cs.class_id AS classId, s.id, s.first_name AS firstName, s.last_name AS lastName
				 FROM class_students cs JOIN students s ON s.id = cs.student_id
				 ORDER BY s.first_name COLLATE NOCASE, s.last_name COLLATE NOCASE`
			)
			.all()
	);
	const teachers = /** @type {{ classId: number, id: number, username: string }[]} */ (
		db
			.prepare(
				`SELECT ct.class_id AS classId, u.id, u.username FROM class_teachers ct JOIN users u ON u.id = ct.teacher_id
				 ORDER BY u.username`
			)
			.all()
	);
	return rows.map((c) => ({
		...c,
		archived: c.archived === 1,
		students: students.filter((s) => s.classId === c.id).map(({ classId, ...s }) => s),
		teachers: teachers.filter((t) => t.classId === c.id).map(({ classId, ...t }) => t)
	}));
}

/**
 * Darf er diese Klasse sehen bzw. bearbeiten? Sonst 404.
 * @param {Viewer} viewer
 * @param {number} classId
 */
export function requireClass(viewer, classId) {
	const db = getDb();
	const row = /** @type {{ id: number, name: string, color: string, archived: number } | undefined} */ (
		db.prepare('SELECT id, name, color, archived FROM classes WHERE id = ?').get(classId)
	);
	const mine = row && (viewer.isAdmin || db.prepare('SELECT 1 FROM class_teachers WHERE class_id = ? AND teacher_id = ?').get(classId, viewer.id));
	if (!row || !mine) error(404, 'Klasse nicht gefunden');
	return { ...row, archived: row.archived === 1 };
}

/**
 * Neue Klasse; wer sie anlegt, unterrichtet sie.
 * @param {Viewer} viewer
 * @param {Record<string, unknown>} input
 */
export function createClass(viewer, input) {
	const name = requiredText(input.name, 'Name', 40);
	const db = getDb();
	const count = /** @type {{ n: number }} */ (db.prepare('SELECT COUNT(*) AS n FROM classes').get()).n;
	const color = validColor(input.color) ?? colorAt(count);
	const id = db.transaction(() => {
		const id = Number(db.prepare('INSERT INTO classes (name, color) VALUES (?, ?)').run(name, color).lastInsertRowid);
		db.prepare('INSERT INTO class_teachers (class_id, teacher_id) VALUES (?, ?)').run(id, viewer.id);
		return id;
	})();
	return { id, name, color };
}

/**
 * Name, Farbe, archiviert ändern.
 * @param {number} id
 * @param {Record<string, unknown>} input
 */
export function updateClass(id, input) {
	const db = getDb();
	if (input.name !== undefined) db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(requiredText(input.name, 'Name', 40), id);
	if (input.color !== undefined) {
		const color = validColor(input.color);
		if (!color) error(400, 'Ungültige Farbe');
		db.prepare('UPDATE classes SET color = ? WHERE id = ?').run(color, id);
	}
	if (input.archived !== undefined) {
		db.prepare('UPDATE classes SET archived = ? WHERE id = ?').run(input.archived === true ? 1 : 0, id);
		syncVisibility();
	}
}

/** Klasse löschen – die Schüler bleiben (nur nicht mehr in dieser Klasse). @param {number} id */
export function deleteClass(id) {
	getDb().prepare('DELETE FROM classes WHERE id = ?').run(id);
	syncVisibility();
}

/**
 * Lehrkraft einer Klasse zuweisen oder entfernen (nur Admin).
 * @param {number} classId
 * @param {unknown} teacherId
 * @param {boolean} on
 */
export function setClassTeacher(classId, teacherId, on) {
	const db = getDb();
	const id = Number(teacherId);
	if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'teacher'").get(id)) error(404, 'Lehrkraft nicht gefunden');
	if (on) db.prepare('INSERT OR IGNORE INTO class_teachers (class_id, teacher_id) VALUES (?, ?)').run(classId, id);
	else db.prepare('DELETE FROM class_teachers WHERE class_id = ? AND teacher_id = ?').run(classId, id);
	syncVisibility();
}

/**
 * Schüler in eine Klasse aufnehmen bzw. daraus entfernen (nur Schüler, die man sieht).
 * @param {number} classId
 * @param {unknown} studentIds
 * @param {boolean} on
 * @param {(studentId: number) => boolean} canSee
 */
export function setClassStudents(classId, studentIds, on, canSee) {
	if (!Array.isArray(studentIds) || studentIds.length === 0) error(400, 'Keine Schüler angegeben');
	const db = getDb();
	const ids = studentIds.map(Number).filter((id) => Number.isInteger(id) && canSee(id));
	const sql = on
		? 'INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)'
		: 'DELETE FROM class_students WHERE class_id = ? AND student_id = ?';
	const stmt = db.prepare(sql);
	db.transaction(() => {
		for (const id of ids) stmt.run(classId, id);
	})();
	syncVisibility();
	return { changed: ids.length };
}

/** Klassen je Schüler. @returns {Record<number, number[]>} */
export function studentClassIds() {
	const rows = /** @type {{ studentId: number, classId: number }[]} */ (
		getDb().prepare('SELECT student_id AS studentId, class_id AS classId FROM class_students').all()
	);
	/** @type {Record<number, number[]>} */
	const map = {};
	for (const r of rows) (map[r.studentId] ??= []).push(r.classId);
	return map;
}

/**
 * Neue Passwörter für alle Schüler der Klasse (zum Drucken). Wer noch keinen Zugang hat, bekommt einen.
 * @param {number} classId
 */
export function resetClassPasswords(classId) {
	const students = /** @type {{ id: number, firstName: string, lastName: string }[]} */ (
		getDb()
			.prepare(
				`SELECT s.id, s.first_name AS firstName, s.last_name AS lastName FROM class_students cs
				 JOIN students s ON s.id = cs.student_id WHERE cs.class_id = ?
				 ORDER BY s.first_name COLLATE NOCASE, s.last_name COLLATE NOCASE`
			)
			.all(classId)
	);
	return getDb().transaction(() =>
		students.map((s) => ({ name: `${s.firstName} ${s.lastName}`, ...resetStudentPassword(s.id) }))
	)();
}

// --- Aktive Klasse: gilt für Stunde, Stundenziele und „Ziele an alle“ ---

/**
 * Die zuletzt gewählte Klasse der Lehrkraft, sonst ihre erste. null = keine Klasse.
 * @param {number} owner Lehrkraft (Admin: jede Klasse)
 * @returns {{ id: number, name: string, color: string } | null}
 */
export function activeClass(owner) {
	const db = getDb();
	const isAdmin = !!db.prepare("SELECT 1 FROM users WHERE id = ? AND is_admin = 1").get(owner);
	const chosen = Number(readSettings(owner, ['classId']).classId) || 0;
	const visible = `FROM classes c WHERE c.archived = 0
		AND (? OR EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.teacher_id = ?))`;
	const row =
		db.prepare(`SELECT c.id, c.name, c.color ${visible} AND c.id = ?`).get(isAdmin ? 1 : 0, owner, chosen) ??
		db
			.prepare(
				`SELECT c.id, c.name, c.color ${visible}
				 ORDER BY EXISTS (SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.teacher_id = ?) DESC,
				   c.name COLLATE NOCASE LIMIT 1`
			)
			.get(isAdmin ? 1 : 0, owner, owner);
	return /** @type {{ id: number, name: string, color: string } | null} */ (row ?? null);
}

/**
 * Klasse für die Stunde wählen (beim Starten).
 * @param {Viewer} viewer
 * @param {unknown} classId
 */
export function chooseClass(viewer, classId) {
	const klass = requireClass(viewer, Number(classId));
	if (klass.archived) error(400, 'Die Klasse ist archiviert');
	writeSettings(viewer.id, { classId: String(klass.id) });
}

/** Ist der Schüler in der Klasse? @param {number} classId @param {number} studentId */
export function inClass(classId, studentId) {
	return !!getDb().prepare('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?').get(classId, studentId);
}
