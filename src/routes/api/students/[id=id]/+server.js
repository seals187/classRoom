import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { deleteStudent, updateStudent } from '#lib/server/db.js';

export async function PATCH({ locals, params, request }) {
	requireTeacher(locals);
	return json(updateStudent(Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	deleteStudent(Number(params.id));
	return new Response(null, { status: 204 });
}
