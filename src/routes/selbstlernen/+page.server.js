import { listStudents } from '#lib/server/db.js';

export function load() {
	return { students: listStudents() };
}
