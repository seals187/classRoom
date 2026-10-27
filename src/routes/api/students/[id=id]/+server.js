import { json } from '@sveltejs/kit';
import { manageScope, requireStudentAccess, requireTeacher } from '#lib/server/auth.js';
import { deleteStudent, updateStudent } from '#lib/server/db.js';

// Name und Kürzel ändern. Klassen ändern über /api/classes/:id/students.
export async function PATCH({ locals, params, request }) {
	requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	return json(updateStudent(id, await request.json()));
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	return json(deleteStudent(manageScope(locals), id));
}
