import { error } from '@sveltejs/kit';
import { getDb, requiredText } from './db.js';

// Schülergruppen (z. B. „Förderkinder“): bleiben gespeichert und sind beim Senden von Zielen auswählbar.

/** Farben zur Auswahl – gleiche Reihenfolge wie im Fenster. */
export const GROUP_COLORS = ['blue', 'orange', 'purple', 'green', 'red'];

/** @typedef {{ id: number, name: string, color: string, studentIds: number[] }} Group */

/** @returns {Group[]} */
export function listGroups() {
	const db = getDb();
	const groups = /** @type {Omit<Group, 'studentIds'>[]} */ (
		db.prepare('SELECT id, name, color FROM student_groups ORDER BY name COLLATE NOCASE, id').all()
	);
	const members = /** @type {{ groupId: number, studentId: number }[]} */ (
		db.prepare('SELECT group_id AS groupId, student_id AS studentId FROM group_members').all()
	);
	return groups.map((g) => ({ ...g, studentIds: members.filter((m) => m.groupId === g.id).map((m) => m.studentId) }));
}

/** @param {Record<string, unknown>} input */
function validGroup(input) {
	const name = requiredText(input.name, 'Name', 60);
	const color = GROUP_COLORS.includes(/** @type {string} */ (input.color)) ? /** @type {string} */ (input.color) : GROUP_COLORS[0];
	if (!Array.isArray(input.studentIds)) error(400, 'Keine Schüler angegeben');
	const studentIds = [...new Set(input.studentIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
	if (studentIds.length === 0) error(400, 'Bitte mindestens einen Schüler auswählen');
	return { name, color, studentIds };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} groupId
 * @param {number[]} studentIds
 */
function setMembers(db, groupId, studentIds) {
	db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
	// Nur Schüler, die es gibt (gelöschte fallen still weg).
	const insert = db.prepare(
		'INSERT INTO group_members (group_id, student_id) SELECT ?, id FROM students WHERE id = ?'
	);
	for (const id of studentIds) insert.run(groupId, id);
}

/** @param {Record<string, unknown>} input @returns {Group} */
export function addGroup(input) {
	const group = validGroup(input);
	const db = getDb();
	const id = db.transaction(() => {
		const id = Number(
			db.prepare('INSERT INTO student_groups (name, color) VALUES (?, ?)').run(group.name, group.color).lastInsertRowid
		);
		setMembers(db, id, group.studentIds);
		return id;
	})();
	return /** @type {Group} */ (listGroups().find((g) => g.id === id));
}

/** @param {number} id @param {Record<string, unknown>} input @returns {Group} */
export function updateGroup(id, input) {
	const group = validGroup(input);
	const db = getDb();
	db.transaction(() => {
		const { changes } = db
			.prepare('UPDATE student_groups SET name = ?, color = ? WHERE id = ?')
			.run(group.name, group.color, id);
		if (!changes) error(404, 'Gruppe nicht gefunden');
		setMembers(db, id, group.studentIds);
	})();
	return /** @type {Group} */ (listGroups().find((g) => g.id === id));
}

/** @param {number} id */
export function deleteGroup(id) {
	const { changes } = getDb().prepare('DELETE FROM student_groups WHERE id = ?').run(id);
	if (!changes) error(404, 'Gruppe nicht gefunden');
}
