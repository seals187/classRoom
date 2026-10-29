import { getActiveAssignment } from '#lib/server/assignment.js';
import { classScope } from '#lib/server/auth.js';
import { listStudents } from '#lib/server/db.js';

export function load({ locals }) {
	return {
		students: listStudents(classScope(locals), 'lesson'),
		assignmentTitle: getActiveAssignment(locals.owner).title
	};
}
