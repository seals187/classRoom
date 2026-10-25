import { json } from '@sveltejs/kit';
import { addTeacher, requireAdmin } from '#lib/server/auth.js';

export async function POST({ locals, request }) {
	requireAdmin(locals);
	return json(addTeacher(await request.json()), { status: 201 });
}
