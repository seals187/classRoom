import { json } from '@sveltejs/kit';
import { manageScope, requireTeacher } from '#lib/server/auth.js';
import { requireClass, setClassStudents } from '#lib/server/classes.js';
import { canSeeStudent } from '#lib/server/db.js';

// Vorhandene Schüler aufnehmen (POST) bzw. aus der Klasse entfernen (DELETE): { studentIds }
/** @param {import('./$types').RequestEvent} event @param {boolean} on */
async function change({ locals, params, request }, on) {
	const klass = requireClass(requireTeacher(locals), Number(params.id));
	const { studentIds } = await request.json();
	const scope = manageScope(locals);
	return json(setClassStudents(klass.id, studentIds, on, (id) => canSeeStudent(scope, id)));
}

export const POST = (/** @type {import('./$types').RequestEvent} */ event) => change(event, true);
export const DELETE = (/** @type {import('./$types').RequestEvent} */ event) => change(event, false);
