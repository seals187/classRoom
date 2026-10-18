import { getAssignment } from '#lib/server/assignment.js';
import { listStudents } from '#lib/server/db.js';

export function load() {
	// Stundenziele für die Fortschritts-Leiste; Selbstlern-Ziele für den Fortschritt je Schritt.
	return { assignment: getAssignment(), lessonStudents: listStudents('lesson'), selfStudents: listStudents('self') };
}
