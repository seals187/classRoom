import { json } from '@sveltejs/kit';
import { deleteGoal, updateGoal } from '#lib/server/goals.js';

// Ziel ändern bzw. abhaken – Lehrkraft in ihrer Klasse, Schüler bei sich selbst (Rechte prüft goals.js).
export async function PATCH({ locals, params, request }) {
	return json(updateGoal(locals, Number(params.id), await request.json()));
}

export function DELETE({ locals, params }) {
	deleteGoal(locals, Number(params.id));
	return new Response(null, { status: 204 });
}
