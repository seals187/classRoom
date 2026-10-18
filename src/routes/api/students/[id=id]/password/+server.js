import { json } from '@sveltejs/kit';
import { requireTeacher } from '$lib/server/auth.js';
import { resetStudentPassword } from '$lib/server/db.js';

export function POST({ locals, params }) {
	requireTeacher(locals);
	return json(resetStudentPassword(Number(params.id)));
}
