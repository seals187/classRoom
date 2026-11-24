import { json } from '@sveltejs/kit';
import { showAssignment } from '#lib/server/assignment.js';

// „Zeigen“: aktiv machen – Beamer und Schüler sehen dann diesen Auftrag.
export function POST({ locals, params }) {
	return json(showAssignment(locals, Number(params.id)));
}
