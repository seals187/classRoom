import { getAssignment } from '#lib/server/assignment.js';

export function load() {
	return { assignment: getAssignment() };
}
