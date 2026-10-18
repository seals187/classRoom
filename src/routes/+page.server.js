import { getAssignment } from '#lib/server/assignment.js';
import { listStudents } from '#lib/server/db.js';

export function load() {
	// Stundenziele für die Fortschritts-Leiste unter dem Auftrag.
	return { assignment: getAssignment(), lessonStudents: listStudents('lesson') };
}
