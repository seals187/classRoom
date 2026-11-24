import { json } from '@sveltejs/kit';
import { createStudents } from '#lib/server/db.js';

// Schüler anlegen: { classId, firstName, lastName, username?, isTest? } oder { classId, students: [...] }.
// Rechte (eigene Klasse, Test-Schüler nur Admin) prüft db.js.
export async function POST({ locals, request }) {
	return json(createStudents(locals, await request.json()), { status: 201 });
}
