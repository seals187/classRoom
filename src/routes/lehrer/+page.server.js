import { listTeachers } from '$lib/server/auth.js';

export function load() {
	return { teachers: listTeachers() };
}
