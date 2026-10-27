import { getAssignment, listAssignmentOwners } from '#lib/server/assignment.js';
import { classScope } from '#lib/server/auth.js';
import { listStudents } from '#lib/server/db.js';
import { listGroups } from '#lib/server/groups.js';
import { getShare } from '#lib/server/share.js';

export function load({ locals }) {
	const isTeacher = locals.user?.role === 'teacher';
	// Schüler der aktiven Klasse: Stundenziele für die Fortschritts-Leiste, Selbstlern-Ziele für den Fortschritt je Schritt.
	return {
		assignment: getAssignment(locals.owner),
		lessonStudents: listStudents(classScope(locals), 'lesson'),
		selfStudents: listStudents(classScope(locals), 'self'),
		// Gruppen für „Ziele aus dem Auftrag“ – nur Lehrkräfte senden Ziele.
		groups: isTeacher ? listGroups(locals.owner) : [],
		// „Weitergeben“: Lehrkräfte mit dem Titel ihres Auftrags.
		assignmentOwners: isTeacher ? listAssignmentOwners() : [],
		// Öffentlicher Link (QR-Code) zum eigenen Auftrag
		share: isTeacher ? getShare(locals.owner) : null
	};
}
