import { getAssignment } from '#lib/server/assignment.js';
import { classScope } from '#lib/server/auth.js';
import { listStudents } from '#lib/server/db.js';

export function load({ locals }) {
	return {
		students: listStudents(classScope(locals), 'lesson'),
		assignmentTitle: getAssignment(locals.owner).title
	};
}
