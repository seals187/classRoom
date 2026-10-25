import { error } from '@sveltejs/kit';
import { canSeeStudent, getDb, requiredText } from './db.js';

// Schülergruppen (z. B. „Förderkinder“): gehören einer Lehrkraft, bleiben gespeichert und sind beim Senden
// von Zielen auswählbar.

/** Farben zur Auswahl – gleiche Reihenfolge wie im Fenster. */
export const GROUP_COLORS = ['blue', 'orange', 'purple', 'green', 'red'];

/** @typedef {{ id: number, name: string, color: string, studentIds: number[] }} Group */

/** @param {number} owner @returns {Group[]} */
export function listGroups(owner) {
	const db = getDb();
	const groups = /** @type {Omit<Group, 'studentIds'>[]} */ (
		db.prepare('SELECT id, name, color FROM student_groups WHERE teacher_id = ? ORDER BY name COLLATE NOCASE, id').all(owner)
	);
	const members = /** @type {{ groupId: number, studentId: number }[]} */ (
		db
			.prepare(
				`SELECT m.group_id AS groupId, m.student_id AS studentId FROM group_members m
				 JOIN student_groups g ON g.id = m.group_id WHERE g.teacher_id = ?`
			)
			.all(owner)
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
 * @param {import('./db.js').Scope} scope
 * @param {number} groupId
 * @param {number[]} studentIds
 */
function setMembers(scope, groupId, studentIds) {
	const db = getDb();
	db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
	// Nur Schüler, die diese Lehrkraft sieht (gelöschte und fremde fallen still weg).
	const insert = db.prepare('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)');
	for (const id of studentIds) if (canSeeStudent(scope, id)) insert.run(groupId, id);
}

/** @param {import('./db.js').Scope} scope @param {Record<string, unknown>} input @returns {Group} */
export function addGroup(scope, input) {
	const group = validGroup(input);
	const db = getDb();
	const id = db.transaction(() => {
		const id = Number(
			db
				.prepare('INSERT INTO student_groups (name, color, teacher_id) VALUES (?, ?, ?)')
				.run(group.name, group.color, scope.owner).lastInsertRowid
		);
		setMembers(scope, id, group.studentIds);
		return id;
	})();
	return /** @type {Group} */ (listGroups(scope.owner).find((g) => g.id === id));
}

/** @param {import('./db.js').Scope} scope @param {number} id @param {Record<string, unknown>} input @returns {Group} */
export function updateGroup(scope, id, input) {
	const group = validGroup(input);
	const db = getDb();
	db.transaction(() => {
		const { changes } = db
			.prepare('UPDATE student_groups SET name = ?, color = ? WHERE id = ? AND teacher_id = ?')
			.run(group.name, group.color, id, scope.owner);
		if (!changes) error(404, 'Gruppe nicht gefunden');
		setMembers(scope, id, group.studentIds);
	})();
	return /** @type {Group} */ (listGroups(scope.owner).find((g) => g.id === id));
}

/** @param {number} owner @param {number} id */
export function deleteGroup(owner, id) {
	const { changes } = getDb().prepare('DELETE FROM student_groups WHERE id = ? AND teacher_id = ?').run(id, owner);
	if (!changes) error(404, 'Gruppe nicht gefunden');
}
