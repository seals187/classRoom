import { error } from '@sveltejs/kit';
import { gradientCss, photoCss } from '#lib/backgrounds.js';
import { patternCss } from '#lib/patterns.js';
import { saveImage } from './assignment.js';
import { getDb, readSettings, writeSettings } from './db.js';

// Hintergrund für Auftrag, Stundenziele und Selbstlernen.
// Lehrkraft: legt den Klassen-Hintergrund fest und ob Schüler selbst wählen dürfen.
// Schüler: wählen (falls erlaubt) ihren eigenen; ohne eigene Wahl gilt der Klassen-Hintergrund.
// `owner` ist die Lehrkraft, deren Klasse gerade gilt (bei Lehrkräften sie selbst).

/** @typedef {'fixed' | 'free'} BackgroundMode */
/** @typedef {{ id: number, url: string, own: boolean }} BackgroundImage */
/**
 * @typedef {{
 *   mode: BackgroundMode,
 *   classValue: string,
 *   ownValue: string,
 *   canChoose: boolean,
 *   css: string | null
 * }} BackgroundState
 */

const MAX_IMAGES = 30;

/** @param {number} owner */
function getClassSettings(owner) {
	const map = readSettings(owner, ['bg.mode', 'bg.value']);
	return {
		mode: /** @type {BackgroundMode} */ (map['bg.mode'] === 'free' ? 'free' : 'fixed'),
		value: map['bg.value'] ?? ''
	};
}

/** @param {number} studentId */
function getOwnValue(studentId) {
	const row = /** @type {{ background: string } | undefined} */ (
		getDb().prepare('SELECT background FROM students WHERE id = ?').get(studentId)
	);
	return row?.background ?? '';
}

/**
 * Bild-Hintergrund, den dieser Benutzer sehen darf (von der Lehrkraft der Klasse oder sein eigener).
 * @param {number} id
 * @param {import('./auth.js').User} user
 * @param {number} owner
 */
function findImage(id, user, owner) {
	return /** @type {{ fileId: number, studentId: number | null } | undefined} */ (
		getDb()
			.prepare(
				`SELECT file_id AS fileId, student_id AS studentId FROM backgrounds
				 WHERE id = ? AND ((student_id IS NULL AND teacher_id = ?) OR student_id = ?)`
			)
			.get(id, owner, user.role === 'student' ? user.studentId : -1)
	);
}

/**
 * Schlüssel → CSS für `background`. Unbekannte oder gelöschte Hintergründe → keiner.
 * @param {string} value
 * @param {import('./auth.js').User} user
 * @param {number} owner
 */
function toCss(value, user, owner) {
	if (value.startsWith('g:')) return gradientCss(value.slice(2));
	if (value.startsWith('p:')) return patternCss(value.slice(2));
	if (value.startsWith('f:')) return photoCss(value.slice(2));
	if (value.startsWith('i:')) {
		const image = findImage(Number(value.slice(2)), user, owner);
		return image ? `center / cover no-repeat url("/api/files/${image.fileId}")` : null;
	}
	return null;
}

/**
 * @param {import('./auth.js').User} user
 * @param {number} owner
 * @returns {BackgroundState}
 */
export function getBackground(user, owner) {
	const { mode, value: classValue } = getClassSettings(owner);
	const isStudent = user.role === 'student' && user.studentId !== null;
	const canChoose = !isStudent || mode === 'free';
	const ownValue = isStudent ? getOwnValue(/** @type {number} */ (user.studentId)) : '';
	const effective = isStudent && mode === 'free' && ownValue ? ownValue : classValue;
	return { mode, classValue, ownValue, canChoose, css: toCss(effective, user, owner) };
}

/**
 * @param {unknown} value
 * @param {import('./auth.js').User} user
 * @param {number} owner
 */
function validValue(value, user, owner) {
	if (value === '') return '';
	if (typeof value !== 'string') error(400, 'Ungültiger Hintergrund');
	if (value.startsWith('g:') && gradientCss(value.slice(2))) return value;
	if (value.startsWith('p:') && patternCss(value.slice(2))) return value;
	if (value.startsWith('f:') && photoCss(value.slice(2))) return value;
	// Lehrkräfte finden nur ihre eigenen Bilder – ein Schüler-Bild kann also nie Klassen-Hintergrund werden.
	if (/^i:\d+$/.test(value) && findImage(Number(value.slice(2)), user, owner)) return value;
	error(400, 'Ungültiger Hintergrund');
}

/**
 * Lehrkraft: Klassen-Hintergrund und Modus. Schüler: eigener Hintergrund ('' = wie die Klasse).
 * @param {import('./auth.js').User} user
 * @param {number} owner
 * @param {{ value?: unknown, mode?: unknown }} input
 */
export function saveBackground(user, owner, input) {
	if (user.role === 'teacher') {
		/** @type {Record<string, string>} */
		const entries = {};
		if (input.value !== undefined) entries['bg.value'] = validValue(input.value, user, owner);
		if (input.mode !== undefined) {
			if (input.mode !== 'fixed' && input.mode !== 'free') error(400, 'Ungültiger Modus');
			entries['bg.mode'] = input.mode;
		}
		writeSettings(owner, entries);
	} else {
		if (getClassSettings(owner).mode !== 'free') error(403, 'Den Hintergrund legt die Lehrkraft fest');
		getDb()
			.prepare('UPDATE students SET background = ? WHERE id = ?')
			.run(validValue(input.value, user, owner), user.studentId);
	}
	return getBackground(user, owner);
}

/**
 * Lehrkraft: ihre Bilder. Schüler: die der Lehrkraft plus die eigenen.
 * @param {import('./auth.js').User} user
 * @param {number} owner
 * @returns {BackgroundImage[]}
 */
export function listBackgroundImages(user, owner) {
	const studentId = user.role === 'student' ? user.studentId : null;
	const rows = /** @type {{ id: number, fileId: number, studentId: number | null }[]} */ (
		getDb()
			.prepare(
				`SELECT id, file_id AS fileId, student_id AS studentId FROM backgrounds
				 WHERE (student_id IS NULL AND teacher_id = ?) OR student_id = ? ORDER BY id DESC`
			)
			.all(owner, studentId ?? -1)
	);
	return rows.map((r) => ({
		id: r.id,
		url: `/api/files/${r.fileId}`,
		own: user.role === 'teacher' ? r.studentId === null : r.studentId === studentId
	}));
}

/**
 * @param {import('./auth.js').User} user
 * @param {number} owner
 * @param {FormDataEntryValue | null} file
 */
export async function addBackgroundImage(user, owner, file) {
	const studentId = user.role === 'student' ? user.studentId : null;
	if (studentId !== null && getClassSettings(owner).mode !== 'free') error(403, 'Den Hintergrund legt die Lehrkraft fest');
	const count = /** @type {{ n: number }} */ (
		studentId !== null
			? getDb().prepare('SELECT COUNT(*) AS n FROM backgrounds WHERE student_id = ?').get(studentId)
			: getDb().prepare('SELECT COUNT(*) AS n FROM backgrounds WHERE student_id IS NULL AND teacher_id = ?').get(owner)
	).n;
	if (count >= MAX_IMAGES) error(400, `Höchstens ${MAX_IMAGES} eigene Bilder – lösche zuerst ein altes`);
	const saved = await saveImage(file);
	const { lastInsertRowid } = getDb()
		.prepare('INSERT INTO backgrounds (file_id, student_id, teacher_id) VALUES (?, ?, ?)')
		.run(saved.id, studentId, studentId === null ? owner : null);
	return { id: Number(lastInsertRowid), url: saved.url, own: true };
}

/**
 * Lehrkräfte löschen ihre Bilder, Schüler nur ihre eigenen. Die Datei wird mit gelöscht.
 * @param {import('./auth.js').User} user
 * @param {number} owner
 * @param {number} id
 */
export function deleteBackgroundImage(user, owner, id) {
	const row = /** @type {{ fileId: number, studentId: number | null, teacherId: number | null } | undefined} */ (
		getDb()
			.prepare('SELECT file_id AS fileId, student_id AS studentId, teacher_id AS teacherId FROM backgrounds WHERE id = ?')
			.get(id)
	);
	const allowed =
		row && (user.role === 'teacher' ? row.studentId === null && row.teacherId === owner : row.studentId === user.studentId);
	if (!row || !allowed) error(404, 'Bild nicht gefunden');
	const db = getDb();
	db.transaction(() => {
		db.prepare('DELETE FROM files WHERE id = ?').run(row.fileId);
		if (user.role === 'teacher' && getClassSettings(owner).value === `i:${id}`) writeSettings(owner, { 'bg.value': '' });
		db.prepare("UPDATE students SET background = '' WHERE background = ?").run(`i:${id}`);
	})();
}
