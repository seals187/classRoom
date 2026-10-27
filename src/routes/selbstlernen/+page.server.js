import { scope } from '#lib/server/auth.js';
import { listStudents } from '#lib/server/db.js';

// Selbstlernen: Ziele pro Schüler, über alle eigenen Klassen.
export function load({ locals }) {
	return { students: listStudents(scope(locals)) };
}
