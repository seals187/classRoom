import { error } from '@sveltejs/kit';
import { renderMarkdown } from '#lib/markdown.js';
import { getConfig } from './config.js';
import { getDb } from './db.js';
import { cleanHtml } from './sanitize.js';

/** `html` ist serverseitig bereinigt und darf direkt mit {@html} ausgegeben werden. */
/** @typedef {{ title: string, html: string, images: number[], updatedAt: string | null }} Assignment */

const MAX_IMAGES = 30;

/** @param {string} json */
function parseIds(json) {
	try {
		const ids = JSON.parse(json);
		return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
	} catch {
		return [];
	}
}

/** @param {number} owner Lehrkraft @returns {Assignment} */
export function getAssignment(owner) {
	const row = /** @type {{ title: string, body: string, images: string, format: string, updatedAt: string | null } | undefined} */ (
		getDb()
			.prepare('SELECT title, body, images, format, updated_at AS updatedAt FROM assignments WHERE teacher_id = ?')
			.get(owner)
	);
	if (!row) return { title: '', html: '', images: [], updatedAt: null };
	// Aufträge von vor dem Editor sind noch Markdown. Auch gespeichertes HTML erneut bereinigen –
	// so verschwinden z. B. weiße Schriftfarben aus älteren Aufträgen.
	const html = cleanHtml(row.format === 'html' ? row.body : renderMarkdown(row.body));
	return { title: row.title, html, images: parseIds(row.images), updatedAt: row.updatedAt };
}

/** @param {number} owner @param {Record<string, unknown>} input */
export function saveAssignment(owner, input) {
	const title = typeof input.title === 'string' ? input.title.trim() : '';
	if (title.length > 120) error(400, 'Titel ist zu lang (max. 120 Zeichen)');
	if (typeof input.html === 'string' && input.html.length > 200_000) error(400, 'Text ist zu lang');
	const body = typeof input.html === 'string' ? cleanHtml(input.html) : '';
	if (body.length > 50_000) error(400, 'Text ist zu lang');

	const db = getDb();
	const exists = db.prepare('SELECT 1 FROM files WHERE id = ?');
	const wanted = Array.isArray(input.images) ? input.images.filter(Number.isInteger) : [];
	const images = [...new Set(wanted)].filter((id) => exists.get(id));
	if (images.length > MAX_IMAGES) error(400, `Höchstens ${MAX_IMAGES} Bilder pro Auftrag`);

	db.transaction(() => {
		db.prepare(
			`INSERT INTO assignments (teacher_id, title, body, images, format, updated_at) VALUES (?, ?, ?, ?, 'html', CURRENT_TIMESTAMP)
			 ON CONFLICT(teacher_id) DO UPDATE SET title = excluded.title, body = excluded.body,
			   images = excluded.images, format = 'html', updated_at = excluded.updated_at`
		).run(owner, title, body, JSON.stringify(images));
		deleteUnusedFiles();
	})();
	return getAssignment(owner);
}

/** Auftrag samt seiner Bilder löschen. @param {number} owner */
export function deleteAssignment(owner) {
	const db = getDb();
	const { images } = getAssignment(owner);
	db.transaction(() => {
		db.prepare('DELETE FROM assignments WHERE teacher_id = ?').run(owner);
		deleteFilesIfUnused(images);
	})();
	return getAssignment(owner);
}

/** Dateien, die noch ein Auftrag (Bildliste oder Text) oder ein Hintergrund braucht – über alle Lehrkräfte. */
function usedFiles() {
	const db = getDb();
	const used = new Set(
		/** @type {{ fileId: number }[]} */ (db.prepare('SELECT file_id AS fileId FROM backgrounds').all()).map((r) => r.fileId)
	);
	for (const row of /** @type {{ body: string, images: string }[]} */ (db.prepare('SELECT body, images FROM assignments').all())) {
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
