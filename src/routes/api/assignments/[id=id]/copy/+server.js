import { json } from '@sveltejs/kit';
import { copyAssignment } from '#lib/server/assignment.js';

export function POST({ locals, params }) {
	return json(copyAssignment(locals, Number(params.id)));
}
