import { json } from '@sveltejs/kit';
import { requireStudentAccess, requireTeacher } from '#lib/server/auth.js';
import { resetStudentPassword } from '#lib/server/db.js';

export function POST({ locals, params }) {
	requireTeacher(locals);
	const id = Number(params.id);
	requireStudentAccess(locals, id);
	return json(resetStudentPassword(id));
}
