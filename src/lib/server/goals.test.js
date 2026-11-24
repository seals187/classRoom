import { describe, expect, it } from 'vitest';
import { createAssignment, updateAssignment } from './assignment.js';
import { updateTeacher } from './auth.js';
import { listClasses, requireClass } from './classes.js';
import { createStudents, listStudents, updateStudent } from './db.js';
import { addGoal, clearGoals, deleteGoal, deleteGoals, sendGoals, updateGoal } from './goals.js';
import { classWith, statusOf, studentActor, teacher } from './test-fixtures.js';

/** Ziele eines Schülers bei dieser Lehrkraft. @param {{ owner: number }} actor @param {number} studentId */
const goalsOf = (actor, studentId, kind = 'lesson') =>
	listStudents({ owner: actor.owner, all: false }, /** @type {'lesson' | 'self'} */ (kind)).find((s) => s.id === studentId)?.goals ?? [];

describe('Ziele aus Schritten', () => {
	it('Schritte als Stundenziele senden: Schlüssel am Ziel, erneutes Senden überspringt', () => {
		const t = teacher();
		const { studentIds } = classWith(t, ['Anna', 'Ben']);
		const a = createAssignment(t, { title: 'Bruchrechnen', html: '<p>- Seite 10 lesen</p><p>- Aufgabe 3</p>', images: [] });
		const goals = a.steps.map((s) => ({ text: s.text, stepKey: s.key }));

		expect(sendGoals(t, { kind: 'lesson', goals })).toMatchObject({ added: 4, students: 2 });
		expect(sendGoals(t, { kind: 'lesson', goals })).toMatchObject({ added: 0 });
		expect(goalsOf(t, studentIds[0]).map((g) => g.stepKey)).toEqual(a.steps.map((s) => s.key));
	});

	it('Fortschritt bleibt am Schritt, wenn die Lehrkraft dessen Text ändert', () => {
		const t = teacher();
		const { studentIds } = classWith(t, ['Anna']);
		const a = createAssignment(t, { title: 'A', html: '<ol><li>Seite 10 lesen</li></ol>', images: [] });
		sendGoals(t, { kind: 'lesson', goals: [{ text: a.steps[0].text, stepKey: a.steps[0].key }] });

		const edited = updateAssignment(t, /** @type {number} */ (a.id), { title: 'A', html: a.html.replace('Seite 10', 'Seite 12'), images: [] });
		expect(edited.steps[0]).toEqual({ key: a.steps[0].key, text: 'Seite 12 lesen' });
		expect(goalsOf(t, studentIds[0])[0].stepKey).toBe(edited.steps[0].key);
	});

	it('umformuliertes Ziel aus demselben Schritt zählt als dasselbe', () => {
		const t = teacher();
		classWith(t, ['Anna']);
		sendGoals(t, { kind: 'lesson', goals: [{ text: 'Lesen', stepKey: 'k1' }] });
		expect(sendGoals(t, { kind: 'lesson', goals: [{ text: 'Seite 10 lesen', stepKey: 'k1' }] }).added).toBe(0);
	});

	it('alte Form mit texts und Ersetzen', () => {
		const t = teacher();
		const { studentIds } = classWith(t, ['Anna']);
		sendGoals(t, { kind: 'lesson', texts: ['eins', 'zwei'] });
		sendGoals(t, { kind: 'lesson', texts: ['drei'], replace: true });
		expect(goalsOf(t, studentIds[0]).map((g) => g.text)).toEqual(['drei']);
	});

	it('nur Lehrkräfte senden', () => {
		const t = teacher();
		const { studentIds } = classWith(t, ['Anna']);
		expect(statusOf(() => sendGoals(studentActor(studentIds[0], t.owner), { texts: ['x'] }))).toBe(403);
	});
});

describe('Rechte an Zielen', () => {
	it('Lehrkraft ändert nur Ziele ihrer Klasse, Schüler nur die eigenen', () => {
		const t1 = teacher();
		const t2 = teacher();
		const { studentIds: [anna, ben] } = classWith(t1, ['Anna', 'Ben']);
		const goal = addGoal(t1, anna, { text: 'Lesen', kind: 'lesson' });

		expect(statusOf(() => updateGoal(t2, goal.id, { done: true }))).toBe(404);
		expect(statusOf(() => updateGoal(studentActor(ben, t1.owner), goal.id, { done: true }))).toBe(403);
		expect(updateGoal(studentActor(anna, t1.owner), goal.id, { done: true })).toMatchObject({ done: true });
		expect(statusOf(() => deleteGoal(t2, goal.id))).toBe(404);
		expect(deleteGoals(t2, [goal.id])).toEqual({ deleted: 0 });
		deleteGoal(t1, goal.id);
		expect(goalsOf(t1, anna)).toEqual([]);
	});

	it('Schüler legt nur für sich selbst Ziele an', () => {
		const t = teacher();
		const { studentIds: [anna, ben] } = classWith(t, ['Anna', 'Ben']);
		expect(statusOf(() => addGoal(studentActor(anna, t.owner), ben, { text: 'x' }))).toBe(403);
		expect(addGoal(studentActor(anna, t.owner), anna, { text: 'x' }).text).toBe('x');
	});

	it('Abhaken merkt die Zeit, „Neue Stunde“ setzt sie zurück', () => {
		const t = teacher();
		const { studentIds: [anna] } = classWith(t, ['Anna']);
		const goal = addGoal(t, anna, { text: 'Lesen', kind: 'lesson' });
		updateGoal(t, goal.id, { done: true });
		const activeAt = () => listStudents({ owner: t.owner, all: false }, 'lesson').find((s) => s.id === anna)?.activeAt;
		expect(activeAt()).toBeGreaterThan(Date.now() - 5000);
		expect(clearGoals(t, 'lesson')).toEqual({ deleted: 1 });
		expect(activeAt()).toBeNull();
	});
});

describe('Rechte an Schülern, Klassen und Lehrkräften', () => {
	it('Test-Schüler nur durch den Admin', () => {
		const t = teacher();
		const admin = teacher({ admin: true });
		const { classId, studentIds: [anna] } = classWith(t, ['Anna']);
		expect(statusOf(() => createStudents(t, { classId, firstName: 'X', lastName: 'Y', isTest: true }))).toBe(403);
		expect(statusOf(() => updateStudent(t, anna, { isTest: true }))).toBe(403);
		expect(statusOf(() => updateStudent(admin, anna, { isTest: true }))).toBeNull();
	});

	it('fremde Klassen: nicht sichtbar, nicht bearbeitbar – der Admin sieht alle', () => {
		const t1 = teacher();
		const t2 = teacher();
		const admin = teacher({ admin: true });
		const { classId } = classWith(t1, ['Anna']);
		expect(listClasses(t2.user).map((c) => c.id)).not.toContain(classId);
		expect(statusOf(() => requireClass(t2.user, classId))).toBe(404);
		expect(listClasses(admin.user).map((c) => c.id)).toContain(classId);
		expect(statusOf(() => createStudents(t2, { classId, firstName: 'X', lastName: 'Y' }))).toBe(404);
	});

	it('Lehrkraft: eigenes Passwort ja, Namen und fremde Konten nur der Admin', () => {
		const t1 = teacher();
		const t2 = teacher();
		expect(statusOf(() => updateTeacher(t1, t1.owner, { password: 'geheim1234' }))).toBeNull();
		expect(statusOf(() => updateTeacher(t1, t1.owner, { username: 'neu' }))).toBe(403);
		expect(statusOf(() => updateTeacher(t1, t2.owner, { password: 'geheim1234' }))).toBe(403);
	});

	it('Aufträge ändern nur Lehrkräfte', () => {
		const t = teacher();
		const { studentIds: [anna] } = classWith(t, ['Anna']);
		expect(statusOf(() => createAssignment(studentActor(anna, t.owner), { title: 'x', html: '', images: [] }))).toBe(403);
	});
});
