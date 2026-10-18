import { getAssignment } from '#lib/server/assignment.js';
import { listStudents } from '#lib/server/db.js';

export function load() {
	return {
		students: listStudents('lesson'),
		assignmentTitle: getAssignment().title
	};
}
