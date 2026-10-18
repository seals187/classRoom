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

/** @returns {Assignment} */
export function getAssignment() {
	const row = /** @type {{ title: string, body: string, images: string, format: string, updatedAt: string | null } | undefined} */ (
		getDb().prepare('SELECT title, body, images, format, updated_at AS updatedAt FROM assignment WHERE id = 1').get()
	);
	if (!row) return { title: '', html: '', images: [], updatedAt: null };
	// Aufträge von vor dem Editor sind noch Markdown.
	const html = row.format === 'html' ? row.body : cleanHtml(renderMarkdown(row.body));
	return { title: row.title, html, images: parseIds(row.images), updatedAt: row.updatedAt };
}

/** @param {Record<string, unknown>} input */
export function saveAssignment(input) {
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
			`INSERT INTO assignment (id, title, body, images, format, updated_at) VALUES (1, ?, ?, ?, 'html', CURRENT_TIMESTAMP)
			 ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body,
			   images = excluded.images, format = 'html', updated_at = excluded.updated_at`
		).run(title, body, JSON.stringify(images));
		deleteUnusedFiles(new Set([...images, ...[...body.matchAll(/\/api\/files\/(\d+)/g)].map((m) => Number(m[1]))]));
	})();
	return getAssignment();
}

/** Auftrag samt seiner Bilder löschen. */
export function deleteAssignment() {
	const db = getDb();
	const { images } = getAssignment();
	db.transaction(() => {
		db.prepare('DELETE FROM assignment WHERE id = 1').run();
		const remove = db.prepare('DELETE FROM files WHERE id = ?');
		for (const id of images) remove.run(id);
	})();
	return getAssignment();
}

/**
 * Bilder, die im Auftrag nicht mehr vorkommen, aufräumen. Frische Uploads (< 1 h) bleiben,
 * falls gerade jemand anderes noch am Bearbeiten ist.
 * @param {Set<number>} used
 */
function deleteUnusedFiles(used) {
	const db = getDb();
	const candidates = /** @type {{ id: number }[]} */ (
		db.prepare("SELECT id FROM files WHERE created_at < datetime('now', '-1 hour')").all()
	);
	const remove = db.prepare('DELETE FROM files WHERE id = ?');
	for (const { id } of candidates) if (!used.has(id)) remove.run(id);
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
