import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { requireClass } from '#lib/server/classes.js';
import { addStudent, addStudents } from '#lib/server/db.js';

// Neue Schüler kommen in eine Klasse der Lehrkraft: POST { classId, firstName, lastName, username? }
// oder mehrere auf einmal: POST { classId, students: [{ firstName, lastName, username? }] }
export async function POST({ locals, request }) {
	const user = requireTeacher(locals);
	const { classId, students, ...input } = await request.json();
	const klass = requireClass(user, Number(classId));
	if (students !== undefined) return json(addStudents(klass.id, students), { status: 201 });
	return json(addStudent(klass.id, input), { status: 201 });
}
