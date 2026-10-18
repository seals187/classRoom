import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { addStudent } from '#lib/server/db.js';

export async function POST({ locals, request }) {
	requireTeacher(locals);
	return json(addStudent(await request.json()), { status: 201 });
}
