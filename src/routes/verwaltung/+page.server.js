import { listTeachers, manageScope, requireTeacher } from '#lib/server/auth.js';
import { listClasses, studentClassIds } from '#lib/server/classes.js';
import { goalStats, listStudents, listUsernames } from '#lib/server/db.js';

// Verwaltung mit den Reitern Klassen · Schüler · Lehrkräfte. Lehrkräfte sehen ihre Klassen und deren
// Schüler, der Admin alles. Unter „Lehrkräfte“ sieht man ohne Admin-Recht nur sich selbst.
export function load({ locals, url }) {
	const user = requireTeacher(locals);
	const tab = url.searchParams.get('tab');
	const teachers = listTeachers();
	return {
		tab: tab === 'schueler' || tab === 'lehrer' ? tab : 'klassen',
		classes: listClasses(user, { archived: true }),
		students: listStudents(manageScope(locals)),
		studentClasses: studentClassIds(),
		goalStats: goalStats(locals.owner),
		usernames: listUsernames(),
		teachers: user.isAdmin ? teachers : teachers.filter((t) => t.id === user.id)
	};
}
