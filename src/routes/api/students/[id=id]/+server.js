import { error, json } from '@sveltejs/kit';
import { manageScope, requireStudentAccess, requireTeacher } from '#lib/server/auth.js';
import { deleteStudent, setStudentTeachers, updateStudent } from '#lib/server/db.js';

// Name und Kürzel ändern; teacherIds (Lehrkräfte des Schülers) nur als Admin.
export async function PATCH({ locals, params, request }) {
	const user = requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	const { teacherIds, ...input } = await request.json();
	if (teacherIds !== undefined) {
		if (!user.isAdmin) error(403, 'Nur der Admin ordnet Schüler den Lehrkräften zu');
		setStudentTeachers(id, teacherIds);
	}
	return json(Object.keys(input).length ? updateStudent(id, input) : { id });
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	return json(deleteStudent(manageScope(locals), id));
}
