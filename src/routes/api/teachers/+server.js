import { json } from '@sveltejs/kit';
import { addTeacher, requireTeacher } from '$lib/server/auth.js';

export async function POST({ locals, request }) {
	requireTeacher(locals);
	return json(addTeacher(await request.json()), { status: 201 });
}
