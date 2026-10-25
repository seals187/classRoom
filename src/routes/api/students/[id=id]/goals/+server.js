import { json } from '@sveltejs/kit';
import { requireStudentAccess } from '#lib/server/auth.js';
import { addGoal } from '#lib/server/db.js';

// Das Ziel gehört zur Klasse, die gerade gilt (Lehrkraft selbst bzw. die gewählte Lehrkraft des Schülers).
export async function POST({ locals, params, request }) {
	const studentId = Number(params.id);
	requireStudentAccess(locals, studentId);
	return json(addGoal(locals.owner, studentId, await request.json()), { status: 201 });
}
