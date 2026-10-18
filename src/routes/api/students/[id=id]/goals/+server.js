import { json } from '@sveltejs/kit';
import { requireStudentAccess } from '$lib/server/auth.js';
import { addGoal } from '$lib/server/db.js';

export async function POST({ locals, params, request }) {
	const studentId = Number(params.id);
	requireStudentAccess(locals, studentId);
	return json(addGoal(studentId, await request.json()), { status: 201 });
}
