import { listAssignments } from '#lib/server/assignment.js';
import { requireTeacher } from '#lib/server/auth.js';

// Übersicht aller Aufträge der Lehrkraft (Karten mit Filter nach Klasse, Entwurf, Archiv).
export function load({ locals }) {
	requireTeacher(locals);
	return { assignments: listAssignments(locals.owner) };
}
