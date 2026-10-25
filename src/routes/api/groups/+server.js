import { json } from '@sveltejs/kit';
import { requireTeacher, scope } from '#lib/server/auth.js';
import { addGroup } from '#lib/server/groups.js';

export async function POST({ locals, request }) {
	requireTeacher(locals);
	return json(addGroup(scope(locals), await request.json()), { status: 201 });
}
