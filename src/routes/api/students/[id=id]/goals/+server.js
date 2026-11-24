import { json } from '@sveltejs/kit';
import { addGoal } from '#lib/server/goals.js';

// Neues Ziel für einen Schüler – Lehrkraft für einen sichtbaren Schüler, Schüler für sich selbst.
export async function POST({ locals, params, request }) {
	return json(addGoal(locals, Number(params.id), await request.json()), { status: 201 });
}
