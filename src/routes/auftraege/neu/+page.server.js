import { requireTeacher } from '#lib/server/auth.js';

export function load({ locals }) {
	requireTeacher(locals);
	return {};
}
