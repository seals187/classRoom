import { json } from '@sveltejs/kit';
import { requireTeacher, scope } from '#lib/server/auth.js';
import { deleteGroup, updateGroup } from '#lib/server/groups.js';

export async function PUT({ locals, params, request }) {
	requireTeacher(locals);
	return json(updateGroup(scope(locals), Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	requireTeacher(locals);
	deleteGroup(locals.owner, Number(params.id));
	return new Response(null, { status: 204 });
}
