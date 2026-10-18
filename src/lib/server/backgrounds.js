import { error } from '@sveltejs/kit';
import { gradientCss, photoCss } from '#lib/backgrounds.js';
import { patternCss } from '#lib/patterns.js';
import { saveImage } from './assignment.js';
import { getDb } from './db.js';

// Hintergrund für Auftrag, Stundenziele und Selbstlernen.
// Lehrkraft: legt den Klassen-Hintergrund fest und ob Schüler selbst wählen dürfen.
// Schüler: wählen (falls erlaubt) ihren eigenen; ohne eigene Wahl gilt der Klassen-Hintergrund.

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

const upsert = () =>
	getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getClassSettings() {
	const rows = /** @type {{ key: string, value: string }[]} */ (
		getDb().prepare("SELECT key, value FROM settings WHERE key IN ('bg.mode', 'bg.value')").all()
	);
	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
 * Bild-Hintergrund, den dieser Benutzer sehen darf (von einer Lehrkraft oder sein eigener).
 * @param {number} id
 * @param {import('./auth.js').User} user
 */
function findImage(id, user) {
	return /** @type {{ fileId: number, studentId: number | null } | undefined} */ (
		getDb()
			.prepare(
				`SELECT file_id AS fileId, student_id AS studentId FROM backgrounds
				 WHERE id = ? AND (student_id IS NULL OR student_id = ?)`
			)
			.get(id, user.role === 'student' ? user.studentId : -1)
	);
}

/**
 * Schlüssel → CSS für `background`. Unbekannte oder gelöschte Hintergründe → keiner.
 * @param {string} value
 * @param {import('./auth.js').User} user
 */
function toCss(value, user) {
	if (value.startsWith('g:')) return gradientCss(value.slice(2));
	if (value.startsWith('p:')) return patternCss(value.slice(2));
	if (value.startsWith('f:')) return photoCss(value.slice(2));
	if (value.startsWith('i:')) {
		const image = findImage(Number(value.slice(2)), user);
		return image ? `center / cover no-repeat url("/api/files/${image.fileId}")` : null;
	}
	return null;
}

/**
 * @param {import('./auth.js').User} user
 * @returns {BackgroundState}
 */
export function getBackground(user) {
	const { mode, value: classValue } = getClassSettings();
	const isStudent = user.role === 'student' && user.studentId !== null;
	const canChoose = !isStudent || mode === 'free';
	const ownValue = isStudent ? getOwnValue(/** @type {number} */ (user.studentId)) : '';
	const effective = isStudent && mode === 'free' && ownValue ? ownValue : classValue;
	return { mode, classValue, ownValue, canChoose, css: toCss(effective, user) };
}

/**
 * @param {unknown} value
 * @param {import('./auth.js').User} user
 */
function validValue(value, user) {
	if (value === '') return '';
	if (typeof value !== 'string') error(400, 'Ungültiger Hintergrund');
	if (value.startsWith('g:') && gradientCss(value.slice(2))) return value;
	if (value.startsWith('p:') && patternCss(value.slice(2))) return value;
	if (value.startsWith('f:') && photoCss(value.slice(2))) return value;
	// Lehrkräfte finden nur Lehrer-Bilder – ein Schüler-Bild kann also nie Klassen-Hintergrund werden.
	if (/^i:\d+$/.test(value) && findImage(Number(value.slice(2)), user)) return value;
	error(400, 'Ungültiger Hintergrund');
}

/**
 * Lehrkraft: Klassen-Hintergrund und Modus. Schüler: eigener Hintergrund ('' = wie die Klasse).
 * @param {import('./auth.js').User} user
 * @param {{ value?: unknown, mode?: unknown }} input
 */
export function saveBackground(user, input) {
	if (user.role === 'teacher') {
		const stmt = upsert();
		getDb().transaction(() => {
			if (input.value !== undefined) stmt.run('bg.value', validValue(input.value, user));
			if (input.mode !== undefined) {
				if (input.mode !== 'fixed' && input.mode !== 'free') error(400, 'Ungültiger Modus');
				stmt.run('bg.mode', input.mode);
			}
		})();
	} else {
		if (getClassSettings().mode !== 'free') error(403, 'Den Hintergrund legt die Lehrkraft fest');
		getDb()
			.prepare('UPDATE students SET background = ? WHERE id = ?')
			.run(validValue(input.value, user), user.studentId);
	}
	return getBackground(user);
}

/**
 * Lehrkraft: Bilder der Lehrkräfte. Schüler: diese plus die eigenen.
 * @param {import('./auth.js').User} user
 * @returns {BackgroundImage[]}
 */
export function listBackgroundImages(user) {
	const studentId = user.role === 'student' ? user.studentId : null;
	const rows = /** @type {{ id: number, fileId: number, studentId: number | null }[]} */ (
		getDb()
			.prepare(
				`SELECT id, file_id AS fileId, student_id AS studentId FROM backgrounds
				 WHERE student_id IS NULL OR student_id = ? ORDER BY id DESC`
			)
			.all(studentId ?? -1)
	);
	return rows.map((r) => ({
		id: r.id,
		url: `/api/files/${r.fileId}`,
		own: user.role === 'teacher' ? r.studentId === null : r.studentId === studentId
	}));
}

/**
 * @param {import('./auth.js').User} user
 * @param {FormDataEntryValue | null} file
 */
export async function addBackgroundImage(user, file) {
	const studentId = user.role === 'student' ? user.studentId : null;
	if (studentId !== null && getClassSettings().mode !== 'free') error(403, 'Den Hintergrund legt die Lehrkraft fest');
	const count = /** @type {{ n: number }} */ (
		getDb().prepare('SELECT COUNT(*) AS n FROM backgrounds WHERE student_id IS ?').get(studentId)
	).n;
	if (count >= MAX_IMAGES) error(400, `Höchstens ${MAX_IMAGES} eigene Bilder – lösche zuerst ein altes`);
	const saved = await saveImage(file);
	const { lastInsertRowid } = getDb()
		.prepare('INSERT INTO backgrounds (file_id, student_id) VALUES (?, ?)')
		.run(saved.id, studentId);
	return { id: Number(lastInsertRowid), url: saved.url, own: true };
}

/**
 * Lehrkräfte löschen Lehrer-Bilder, Schüler nur ihre eigenen. Die Datei wird mit gelöscht.
 * @param {import('./auth.js').User} user
 * @param {number} id
 */
export function deleteBackgroundImage(user, id) {
	const row = /** @type {{ fileId: number, studentId: number | null } | undefined} */ (
		getDb().prepare('SELECT file_id AS fileId, student_id AS studentId FROM backgrounds WHERE id = ?').get(id)
	);
	const allowed = row && (user.role === 'teacher' ? row.studentId === null : row.studentId === user.studentId);
	if (!row || !allowed) error(404, 'Bild nicht gefunden');
	const db = getDb();
	db.transaction(() => {
		db.prepare('DELETE FROM files WHERE id = ?').run(row.fileId);
		if (user.role === 'teacher' && getClassSettings().value === `i:${id}`) upsert().run('bg.value', '');
		db.prepare("UPDATE students SET background = '' WHERE background = ?").run(`i:${id}`);
	})();
}
