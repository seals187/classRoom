import { listTeachers, manageScope, requireTeacher } from '#lib/server/auth.js';
import { listClasses, requireClass } from '#lib/server/classes.js';
import { goalStats, listStudents, listUsernames } from '#lib/server/db.js';

// Eine Klasse: Schülerliste, rechts Lehrkräfte und Sammel-Aktionen.
export function load({ locals, params }) {
	const user = requireTeacher(locals);
	const klass = requireClass(user, Number(params.id));
	const classes = listClasses(user, { archived: true });
	return {
		klass: /** @type {import('#lib/server/classes.js').SchoolClass} */ (classes.find((c) => c.id === klass.id)),
		// Für „Aus anderer Klasse“ – nur aktive Klassen.
		classes: classes.filter((c) => !c.archived || c.id === klass.id),
		students: listStudents({ ...manageScope(locals), classId: klass.id }),
		goalStats: goalStats(locals.owner),
		usernames: listUsernames(),
		// Zum Zuweisen (nur Admin)
		teachers: user.isAdmin ? listTeachers().map(({ id, username, isAdmin }) => ({ id, username, isAdmin })) : []
	};
}
