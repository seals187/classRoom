import { getAssignment, listTeachers } from '#lib/server/assignment.js';
import { classScope, requireTeacher } from '#lib/server/auth.js';
import { listStudents } from '#lib/server/db.js';
import { listGroups } from '#lib/server/groups.js';
import { getShare } from '#lib/server/share.js';

// Ein Auftrag (auch nicht aktiv): ansehen, bearbeiten, teilen, als Stundenziele senden, zeigen.
export function load({ locals, params }) {
	requireTeacher(locals);
	const assignment = getAssignment(locals.owner, Number(params.id));
	return {
		assignment,
		lessonStudents: listStudents(classScope(locals), 'lesson'),
		groups: listGroups(locals.owner),
		teachers: listTeachers(),
		share: getShare(assignment.id)
	};
}
