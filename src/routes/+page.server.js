import { getAssignment } from '#lib/server/assignment.js';
import { listStudents } from '#lib/server/db.js';
import { listGroups } from '#lib/server/groups.js';

export function load({ locals }) {
	// Stundenziele für die Fortschritts-Leiste; Selbstlern-Ziele für den Fortschritt je Schritt.
	return {
		assignment: getAssignment(),
		lessonStudents: listStudents('lesson'),
		selfStudents: listStudents('self'),
		// Gruppen für „Ziele aus dem Auftrag“ – nur Lehrkräfte senden Ziele.
		groups: locals.user?.role === 'teacher' ? listGroups() : []
	};
}
