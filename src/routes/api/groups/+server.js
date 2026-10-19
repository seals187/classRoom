import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { addGroup } from '#lib/server/groups.js';

export async function POST({ locals, request }) {
	requireTeacher(locals);
	return json(addGroup(await request.json()), { status: 201 });
}
