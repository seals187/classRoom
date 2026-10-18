import { goalStats, listStudents, listUsernames } from '#lib/server/db.js';

export function load() {
	return { students: listStudents(), usernames: listUsernames(), goalStats: goalStats() };
}
