import { deleteTeacher, requireTeacher, setTeacherPassword } from '#lib/server/auth.js';

export async function PATCH({ locals, params, request }) {
	requireTeacher(locals);
	setTeacherPassword(Number(params.id), await request.json());
	return new Response(null, { status: 204 });
}

export function DELETE({ locals, params }) {
	const user = requireTeacher(locals);
	deleteTeacher(Number(params.id), user.id);
	return new Response(null, { status: 204 });
}
