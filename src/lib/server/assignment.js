import { error } from '@sveltejs/kit';
import { renderMarkdown } from '#lib/markdown.js';
import { activeClass, listClasses } from './classes.js';
import { getConfig } from './config.js';
import { getDb, readSettings, writeSettings } from './db.js';
import { cleanHtml } from './sanitize.js';

// Aufträge: beliebig viele je Lehrkraft, jeder zu keiner, einer oder mehreren Klassen. Genau einer ist aktiv
// („Zeigen“) – ihn sehen Beamer und Schüler. Entwurf = ohne Klasse oder noch nie gezeigt.

/**
 * `html` ist serverseitig bereinigt und darf direkt mit {@html} ausgegeben werden. `id` null = noch keiner.
 * @typedef {{
 *   id: number | null, title: string, html: string, images: number[], updatedAt: string | null,
 *   classIds: number[], date: string | null, archived: boolean, draft: boolean, active: boolean, steps: number
 * }} Assignment
 */

/** @typedef {{ id: number, isAdmin: boolean }} Viewer */

const MAX_IMAGES = 30;
const ACTIVE_KEY = 'assignmentId';

/** @type {Assignment} */
const EMPTY = { id: null, title: '', html: '', images: [], updatedAt: null, classIds: [], date: null, archived: false, draft: true, active: false, steps: 0 };

/** @param {string} json */
function parseIds(json) {
	try {
		const ids = JSON.parse(json);
		return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
	} catch {
		return [];
	}
}

/**
 * @typedef {{
 *   id: number, teacherId: number, title: string, body: string, images: string, format: string,
 *   date: string | null, archived: number, shownAt: number | null, updatedAt: string | null
 * }} Row
 */
const COLUMNS = `id, teacher_id AS teacherId, title, body, images, format, planned_date AS date, archived,
	shown_at AS shownAt, updated_at AS updatedAt`;

/** @param {number} id @returns {Row | undefined} */
function rowOf(id) {
	return /** @type {Row | undefined} */ (getDb().prepare(`SELECT ${COLUMNS} FROM assignment_items WHERE id = ?`).get(id));
}

/** @param {number[]} ids @returns {Map<number, number[]>} */
function classesOf(ids) {
	/** @type {Map<number, number[]>} */
	const map = new Map(ids.map((id) => [id, []]));
	if (!ids.length) return map;
	const rows = /** @type {{ assignmentId: number, classId: number }[]} */ (
		getDb()
			.prepare(
				`SELECT ac.assignment_id AS assignmentId, ac.class_id AS classId FROM assignment_classes ac
				 JOIN classes c ON c.id = ac.class_id
				 WHERE ac.assignment_id IN (${ids.map(() => '?').join(', ')}) ORDER BY c.name COLLATE NOCASE`
			)
			.all(...ids)
	);
	for (const r of rows) map.get(r.assignmentId)?.push(r.classId);
	return map;
}

/** Zeilenanfang eines von Hand getippten Schritts – wie in steps.js. */
const MARKER = /^\s*(?:[-–—•*]|\d+[.)])\s+/;

/**
 * Zahl der Schritte für die Übersicht: Punkte nummerierter Listen und Zeilen mit „- “ / „1. “ am Anfang
 * (so zeigt sie die Anzeige als Schritte, siehe dashesToSteps).
 * @param {string} html
 */
function stepCount(html) {
	let count = 0;
	const rest = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
		count += (inner.match(/<li[\s>]/gi) ?? []).length;
		return '<p>';
	});
	for (const line of rest.split(/<br\s*\/?>|<\/?(?:p|div|ul|li|h3|h4)[^>]*>/i)) {
		const text = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
		if (MARKER.test(text) && text.replace(MARKER, '').trim()) count++;
	}
	return count;
}

/** @param {Row} row @param {number[]} classIds @param {number | null} activeId @returns {Assignment} */
function toAssignment(row, classIds, activeId) {
	// Aufträge von vor dem Editor sind noch Markdown. Auch gespeichertes HTML erneut bereinigen –
	// so verschwinden z. B. weiße Schriftfarben aus älteren Aufträgen.
	const html = cleanHtml(row.format === 'html' ? row.body : renderMarkdown(row.body));
	return {
		id: row.id,
		title: row.title,
		html,
		images: parseIds(row.images),
		updatedAt: row.updatedAt,
		classIds,
		date: row.date,
		archived: row.archived === 1,
		draft: classIds.length === 0 || row.shownAt === null,
		active: row.id === activeId,
		steps: stepCount(html)
	};
}

/** Id des aktiven Auftrags oder null. @param {number} owner */
export function activeAssignmentId(owner) {
	const id = Number(readSettings(owner, [ACTIVE_KEY])[ACTIVE_KEY]) || 0;
	const row = id ? rowOf(id) : undefined;
	return row && row.teacherId === owner && !row.archived ? id : null;
}

/** Der aktive Auftrag (Beamer, Schüler) – ohne einen leer. @param {number} owner @returns {Assignment} */
export function getActiveAssignment(owner) {
	const id = activeAssignmentId(owner);
	return id ? getAssignment(owner, id) : EMPTY;
}

/** Einen eigenen Auftrag. @param {number} owner @param {number} id @returns {Assignment} */
export function getAssignment(owner, id) {
	const row = rowOf(id);
	if (!row || row.teacherId !== owner) error(404, 'Auftrag nicht gefunden');
	return toAssignment(row, classesOf([id]).get(id) ?? [], activeAssignmentId(owner));
}

/** Alle Aufträge einer Lehrkraft in der Reihenfolge, in der sie erstellt wurden. @param {number} owner */
export function listAssignments(owner) {
	const rows = /** @type {Row[]} */ (
		getDb().prepare(`SELECT ${COLUMNS} FROM assignment_items WHERE teacher_id = ? ORDER BY id`).all(owner)
	);
	const classes = classesOf(rows.map((r) => r.id));
	const activeId = activeAssignmentId(owner);
	return rows.map((r) => toAssignment(r, classes.get(r.id) ?? [], activeId));
}

/**
 * Kurzliste fürs Menü: nicht archivierte Aufträge mit Titel und Klassen.
 * @param {number} owner
 * @returns {{ id: number, title: string, classIds: number[], active: boolean }[]}
 */
export function listAssignmentTitles(owner) {
	const rows = /** @type {{ id: number, title: string }[]} */ (
		getDb().prepare('SELECT id, title FROM assignment_items WHERE teacher_id = ? AND archived = 0 ORDER BY id').all(owner)
	);
	const classes = classesOf(rows.map((r) => r.id));
	const activeId = activeAssignmentId(owner);
	return rows.map((r) => ({ id: r.id, title: r.title, classIds: classes.get(r.id) ?? [], active: r.id === activeId }));
}

/**
 * Titel, Text und Bilder aus der Eingabe prüfen.
 * @param {Record<string, unknown>} input
 */
function contentOf(input) {
	const title = typeof input.title === 'string' ? input.title.trim() : '';
	if (title.length > 120) error(400, 'Titel ist zu lang (max. 120 Zeichen)');
	if (typeof input.html === 'string' && input.html.length > 200_000) error(400, 'Text ist zu lang');
	const body = typeof input.html === 'string' ? cleanHtml(input.html) : '';
	if (body.length > 50_000) error(400, 'Text ist zu lang');
	const exists = getDb().prepare('SELECT 1 FROM files WHERE id = ?');
	const wanted = Array.isArray(input.images) ? input.images.filter(Number.isInteger) : [];
	const images = [...new Set(wanted)].filter((id) => exists.get(id));
	if (images.length > MAX_IMAGES) error(400, `Höchstens ${MAX_IMAGES} Bilder pro Auftrag`);
	return { title, body, images: JSON.stringify(images) };
}

/** Nur Klassen, die die Lehrkraft sieht. @param {Viewer} viewer @param {unknown} value */
function classIdsOf(viewer, value) {
	if (!Array.isArray(value)) error(400, 'Ungültige Klassen');
	const visible = new Set(listClasses(viewer, { archived: true }).map((c) => c.id));
	const ids = [...new Set(value.map(Number))];
	if (ids.some((id) => !visible.has(id))) error(400, 'Unbekannte Klasse');
	return ids;
}

/** @param {unknown} value */
function dateOf(value) {
	if (value === null || value === '') return null;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
		error(400, 'Ungültiges Datum');
	}
	return value;
}

/** @param {number} id @param {number[]} classIds */
function setClasses(id, classIds) {
	const db = getDb();
	db.prepare('DELETE FROM assignment_classes WHERE assignment_id = ?').run(id);
	const insert = db.prepare('INSERT INTO assignment_classes (assignment_id, class_id) VALUES (?, ?)');
	for (const classId of classIds) insert.run(id, classId);
}

/**
 * Neuer Auftrag (nicht aktiv, Entwurf bis zum ersten „Zeigen“).
 * @param {number} owner
 * @param {Viewer} viewer
 * @param {Record<string, unknown>} input title, html, images, classIds?, date?
 */
export function createAssignment(owner, viewer, input) {
	const { title, body, images } = contentOf(input);
	const classIds = input.classIds === undefined ? [] : classIdsOf(viewer, input.classIds);
	const date = input.date === undefined ? null : dateOf(input.date);
	const db = getDb();
	const id = db.transaction(() => {
		const id = Number(
			db
				.prepare(
					`INSERT INTO assignment_items (teacher_id, title, body, images, format, planned_date, updated_at)
					 VALUES (?, ?, ?, ?, 'html', ?, CURRENT_TIMESTAMP)`
				)
				.run(owner, title, body, images, date).lastInsertRowid
		);
		setClasses(id, classIds);
		deleteUnusedFiles();
		return id;
	})();
	return getAssignment(owner, id);
}

/**
 * Auftrag ändern – nur die mitgeschickten Teile: Inhalt (title/html/images), classIds, date, archived.
 * Archivieren beendet „aktiv“ (der Auftrag verschwindet aus Menü und „Alle“).
 * @param {number} owner
 * @param {Viewer} viewer
 * @param {number} id
 * @param {Record<string, unknown>} input
 */
export function updateAssignment(owner, viewer, id, input) {
	const before = getAssignment(owner, id);
	const db = getDb();
	const content = 'title' in input || 'html' in input || 'images' in input ? contentOf(input) : null;
	const classIds = input.classIds === undefined ? null : classIdsOf(viewer, input.classIds);
	const date = input.date === undefined ? undefined : dateOf(input.date);
	const archived = input.archived === undefined ? undefined : input.archived === true;
	db.transaction(() => {
		if (content) {
			db.prepare(
				`UPDATE assignment_items SET title = ?, body = ?, images = ?, format = 'html', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
			).run(content.title, content.body, content.images, id);
		}
		if (classIds) setClasses(id, classIds);
		if (date !== undefined) db.prepare('UPDATE assignment_items SET planned_date = ? WHERE id = ?').run(date, id);
		if (archived !== undefined) {
			db.prepare('UPDATE assignment_items SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
			if (archived && before.active) writeSettings(owner, { [ACTIVE_KEY]: '' });
		}
		if (content) deleteFilesIfUnused(before.images);
		deleteUnusedFiles();
	})();
	return getAssignment(owner, id);
}

/** Auftrag samt seiner Bilder (sofern sonst unbenutzt) löschen. @param {number} owner @param {number} id */
export function deleteAssignment(owner, id) {
	const { images } = getAssignment(owner, id);
	const db = getDb();
	db.transaction(() => {
		db.prepare('DELETE FROM assignment_items WHERE id = ?').run(id);
		deleteFilesIfUnused(images);
	})();
}

/** „Zeigen“: aktiv machen (auch aus dem Archiv). @param {number} owner @param {number} id */
export function showAssignment(owner, id) {
	getAssignment(owner, id);
	getDb().prepare('UPDATE assignment_items SET shown_at = ?, archived = 0 WHERE id = ?').run(Date.now(), id);
	writeSettings(owner, { [ACTIVE_KEY]: String(id) });
	return getAssignment(owner, id);
}

/**
 * Kopie mit denselben Klassen, Datum und Bildern (geteilt, nicht verdoppelt) – nicht geteilt, als Entwurf.
 * @param {number} owner
 * @param {number} id
 */
export function copyAssignment(owner, id) {
	getAssignment(owner, id);
	const db = getDb();
	const copy = db.transaction(() => {
		const copy = Number(
			db
				.prepare(
					`INSERT INTO assignment_items (teacher_id, title, body, images, format, planned_date, updated_at)
					 SELECT teacher_id, substr(CASE WHEN title = '' THEN '' ELSE title || ' (Kopie)' END, 1, 120), body, images, format,
					   planned_date, CURRENT_TIMESTAMP
					 FROM assignment_items WHERE id = ?`
				)
				.run(id).lastInsertRowid
		);
		db.prepare('INSERT INTO assignment_classes (assignment_id, class_id) SELECT ?, class_id FROM assignment_classes WHERE assignment_id = ?').run(
			copy,
			id
		);
		return copy;
	})();
	return getAssignment(owner, copy);
}

/**
 * PUT /api/assignment (ältere Clients, Skripte): den aktiven Auftrag ändern bzw. ohne einen neuen für die
 * aktive Klasse anlegen und zeigen.
 * @param {number} owner
 * @param {Viewer} viewer
 * @param {Record<string, unknown>} input
 */
export function saveActiveAssignment(owner, viewer, input) {
	const id = activeAssignmentId(owner);
	if (id) return updateAssignment(owner, viewer, id, { title: input.title, html: input.html, images: input.images });
	const klass = activeClass(owner);
	const created = createAssignment(owner, viewer, { ...input, classIds: klass ? [klass.id] : [] });
	return showAssignment(owner, /** @type {number} */ (created.id));
}

/** @param {number} owner */
export function deleteActiveAssignment(owner) {
	const id = activeAssignmentId(owner);
	if (id) deleteAssignment(owner, id);
}

/** Lehrkräfte zum Weitergeben. @returns {{ id: number, username: string }[]} */
export function listTeachers() {
	return /** @type {{ id: number, username: string }[]} */ (
		getDb().prepare("SELECT id, username FROM users WHERE role = 'teacher' ORDER BY username").all()
	);
}

/**
 * Auftrag an eine andere Lehrkraft kopieren oder übertragen (dann ist er bei der ersten weg). Er kommt dort
 * ohne Klassen an (Entwurf), ein öffentlicher Link (QR-Code) geht nicht mit. Bilder werden geteilt.
 * @param {number} owner
 * @param {number} id
 * @param {number} to
 * @param {unknown} mode 'copy' | 'move'
 */
export function transferAssignment(owner, id, to, mode) {
	if (mode !== 'copy' && mode !== 'move') error(400, 'Ungültige Art');
	if (owner === to) error(400, 'Bitte eine andere Lehrkraft wählen');
	const db = getDb();
	if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'teacher'").get(to)) error(404, 'Lehrkraft nicht gefunden');
	const source = getAssignment(owner, id);
	db.transaction(() => {
		if (mode === 'move') {
			db.prepare(
				`UPDATE assignment_items SET teacher_id = ?, shown_at = NULL, share_code = NULL, share_expires = NULL,
				   updated_at = CURRENT_TIMESTAMP WHERE id = ?`
			).run(to, id);
			setClasses(id, []);
			if (source.active) writeSettings(owner, { [ACTIVE_KEY]: '' });
		} else {
			db.prepare(
				`INSERT INTO assignment_items (teacher_id, title, body, images, format, planned_date, updated_at)
				 SELECT ?, title, body, images, format, planned_date, CURRENT_TIMESTAMP FROM assignment_items WHERE id = ?`
			).run(to, id);
		}
	})();
}

/**
 * Einmalig beim Update: Der bisherige (einzige) Auftrag jeder Lehrkraft wird ihr erster in der Liste – für
 * ihre aktive Klasse, aktiv und mit demselben öffentlichen Link.
 */
export function migrateAssignments() {
	const db = getDb();
	if (db.prepare("SELECT 1 FROM settings WHERE key = 'migrated.assignments'").get()) return;
	const old = /** @type {{ teacherId: number }[]} */ (db.prepare('SELECT teacher_id AS teacherId FROM assignments').all());
	db.transaction(() => {
		for (const { teacherId } of old) {
			const id = Number(
				db
					.prepare(
						`INSERT INTO assignment_items (teacher_id, title, body, images, format, shown_at, share_code, share_expires, updated_at)
						 SELECT teacher_id, title, body, images, format, ?, share_code, share_expires, updated_at
						 FROM assignments WHERE teacher_id = ?`
					)
					.run(Date.now(), teacherId).lastInsertRowid
			);
			const klass = activeClass(teacherId);
			if (klass) setClasses(id, [klass.id]);
			writeSettings(teacherId, { [ACTIVE_KEY]: String(id) });
		}
		db.prepare('DELETE FROM assignments').run();
		db.prepare("INSERT INTO settings (key, value) VALUES ('migrated.assignments', '1')").run();
	})();
}

/** Bilder aller Aufträge einer Lehrkraft (vor dem Löschen der Lehrkraft). @param {number} teacherId */
export function teacherImages(teacherId) {
	const rows = /** @type {{ images: string }[]} */ (
		getDb().prepare('SELECT images FROM assignment_items WHERE teacher_id = ?').all(teacherId)
	);
	return rows.flatMap((r) => parseIds(r.images));
}

/** Dateien, die noch ein Auftrag (Bildliste oder Text) oder ein Hintergrund braucht – über alle Lehrkräfte. */
function usedFiles() {
	const db = getDb();
	const used = new Set(
		/** @type {{ fileId: number }[]} */ (db.prepare('SELECT file_id AS fileId FROM backgrounds').all()).map((r) => r.fileId)
	);
	// Auch die alte Tabelle, solange sie vor der Umstellung noch Aufträge hat.
	const rows = /** @type {{ body: string, images: string }[]} */ (
		db.prepare('SELECT body, images FROM assignment_items UNION ALL SELECT body, images FROM assignments').all()
	);
	for (const row of rows) {
		for (const id of parseIds(row.images)) used.add(id);
		for (const m of row.body.matchAll(/\/api\/files\/(\d+)/g)) used.add(Number(m[1]));
	}
	return used;
}

/** Diese Dateien löschen, falls nichts mehr sie braucht. @param {number[]} ids */
export function deleteFilesIfUnused(ids) {
	const used = usedFiles();
	const remove = getDb().prepare('DELETE FROM files WHERE id = ?');
	for (const id of ids) if (!used.has(id)) remove.run(id);
}

/**
 * Bilder, die in keinem Auftrag und keinem Hintergrund mehr vorkommen, aufräumen. Frische Uploads (< 1 h)
 * bleiben, falls gerade jemand noch am Bearbeiten ist.
 */
function deleteUnusedFiles() {
	const candidates = /** @type {{ id: number }[]} */ (
		getDb().prepare("SELECT id FROM files WHERE created_at < datetime('now', '-1 hour')").all()
	);
	deleteFilesIfUnused(candidates.map((c) => c.id));
}

/**
 * Typ anhand der ersten Bytes erkennen – der vom Browser gemeldete Typ ist nicht vertrauenswürdig.
 * SVG ist bewusst nicht erlaubt (kann Skripte enthalten).
 * @param {Buffer} buf
 */
function sniffImage(buf) {
	if (buf.length < 12) return null;
	if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
	if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
	if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
	return null;
}

/** @param {FormDataEntryValue | null} file */
export async function saveImage(file) {
	if (!(file instanceof File) || file.size === 0) error(400, 'Keine Datei erhalten');
	const { uploadMaxMb } = getConfig();
	if (file.size > uploadMaxMb * 1024 * 1024) error(413, `Bild ist zu groß (max. ${uploadMaxMb} MB)`);
	const data = Buffer.from(await file.arrayBuffer());
	const mime = sniffImage(data);
	if (!mime) error(415, 'Nur Bilder im Format PNG, JPEG, GIF oder WebP');
	const { lastInsertRowid } = getDb().prepare('INSERT INTO files (mime, data) VALUES (?, ?)').run(mime, data);
	const id = Number(lastInsertRowid);
	return { id, url: `/api/files/${id}` };
}

/** @param {number} id */
export function getFile(id) {
	const row = /** @type {{ mime: string, data: Buffer } | undefined} */ (
		getDb().prepare('SELECT mime, data FROM files WHERE id = ?').get(id)
	);
	if (!row) error(404, 'Datei nicht gefunden');
	return row;
}
