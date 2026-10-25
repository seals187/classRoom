import { listTeachers, manageScope } from '#lib/server/auth.js';
import { goalStats, listStudents, listUsernames, studentTeacherIds } from '#lib/server/db.js';

export function load({ locals }) {
	const isAdmin = !!locals.user?.isAdmin;
	return {
		students: listStudents(manageScope(locals)),
		usernames: listUsernames(),
		goalStats: goalStats(locals.owner),
		// Nur der Admin ordnet Schüler den Lehrkräften zu.
		teachers: isAdmin ? listTeachers().map(({ id, username }) => ({ id, username })) : [],
		studentTeachers: isAdmin ? studentTeacherIds() : {}
	};
}
