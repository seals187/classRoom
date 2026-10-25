import { json } from '@sveltejs/kit';
import { requireGoalAccess } from '#lib/server/auth.js';
import { deleteGoal, updateGoal } from '#lib/server/db.js';

export async function PATCH({ locals, params, request }) {
	const id = Number(params.id);
	requireGoalAccess(locals, id);
	return json(updateGoal(id, await request.json()));
}

export function DELETE({ locals, params }) {
	const id = Number(params.id);
	requireGoalAccess(locals, id);
	deleteGoal(id);
	return new Response(null, { status: 204 });
}
