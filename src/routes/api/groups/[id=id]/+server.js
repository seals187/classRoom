import { json } from '@sveltejs/kit';
import { requireTeacher } from '#lib/server/auth.js';
import { deleteGroup, updateGroup } from '#lib/server/groups.js';

export async function PUT({ locals, params, request }) {
	requireTeacher(locals);
	return json(updateGroup(Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	deleteGroup(Number(params.id));
	return new Response(null, { status: 204 });
}
