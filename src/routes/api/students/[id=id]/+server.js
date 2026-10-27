import { error, json } from '@sveltejs/kit';
import { manageScope, requireStudentAccess, requireTeacher } from '#lib/server/auth.js';
import { deleteStudent, updateStudent } from '#lib/server/db.js';

// Name und Kürzel ändern; isTest (Test-Schüler) nur als Admin. Klassen ändern über /api/classes/:id/students.
export async function PATCH({ locals, params, request }) {
	const user = requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	const input = await request.json();
	if (input.isTest !== undefined && !user.isAdmin) error(403, 'Nur der Admin legt Test-Schüler fest');
	return json(updateStudent(id, input));
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	return json(deleteStudent(manageScope(locals), id));
}
