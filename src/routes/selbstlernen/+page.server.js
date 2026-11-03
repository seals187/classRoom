import { selfScope } from '#lib/server/auth.js';
import { selfAllClasses, studentClassDots } from '#lib/server/classes.js';
import { listStudents } from '#lib/server/db.js';

// Selbstlernen: Schüler der aktiven Klasse – oder aller eigenen Klassen (dann mit Klassen-Punkt je Kachel).
export function load({ locals }) {
	const selfAll = locals.user?.role === 'teacher' && selfAllClasses(locals.owner);
	return {
		students: listStudents(selfScope(locals)),
		selfAll,
		classDots: selfAll ? studentClassDots(locals.owner) : null
	};
}
