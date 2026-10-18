import { json } from '@sveltejs/kit';
import { requireStudentAccess } from '$lib/server/auth.js';
import { deleteGoal, getGoalStudentId, updateGoal } from '$lib/server/db.js';

export async function PATCH({ locals, params, request }) {
	const id = Number(params.id);
	requireStudentAccess(locals, getGoalStudentId(id));
	return json(updateGoal(id, await request.json()));
}

export function DELETE({ locals, params }) {
	const id = Number(params.id);
	requireStudentAccess(locals, getGoalStudentId(id));
	deleteGoal(id);
	return new Response(null, { status: 204 });
}
