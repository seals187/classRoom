import { getAssignment } from '#lib/server/assignment.js';
import { scope } from '#lib/server/auth.js';
import { listStudents } from '#lib/server/db.js';
import { listGroups } from '#lib/server/groups.js';

export function load({ locals }) {
	// Stundenziele für die Fortschritts-Leiste; Selbstlern-Ziele für den Fortschritt je Schritt.
	return {
		assignment: getAssignment(locals.owner),
		lessonStudents: listStudents(scope(locals), 'lesson'),
		selfStudents: listStudents(scope(locals), 'self'),
		// Gruppen für „Ziele aus dem Auftrag“ – nur Lehrkräfte senden Ziele.
		groups: locals.user?.role === 'teacher' ? listGroups(locals.owner) : []
	};
}
