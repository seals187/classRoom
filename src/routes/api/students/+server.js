import { error, json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { requireClass } from '#lib/server/classes.js';
import { addStudent, addStudents } from '#lib/server/db.js';

// Neue Schüler kommen in eine Klasse der Lehrkraft: POST { classId, firstName, lastName, username?, isTest? }
// oder mehrere auf einmal: POST { classId, students: [{ firstName, lastName, username?, isTest? }] }
// isTest (Test-Schüler, sieht nur der Admin) darf nur der Admin setzen.
export async function POST({ locals, request }) {
	const user = requireTeacher(locals);
	const { classId, students, ...input } = await request.json();
	const wantsTest = input.isTest !== undefined || (Array.isArray(students) && students.some((s) => s?.isTest !== undefined));
	if (wantsTest && !user.isAdmin) error(403, 'Test-Schüler legt nur der Admin an');
	const klass = requireClass(user, Number(classId));
	if (students !== undefined) return json(addStudents(klass.id, students), { status: 201 });
	return json(addStudent(klass.id, input), { status: 201 });
}
