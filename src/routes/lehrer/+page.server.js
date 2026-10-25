import { listTeachers } from '#lib/server/auth.js';

// Admin: alle Lehrkräfte. Sonst nur das eigene Konto (Passwort ändern).
export function load({ locals }) {
	const all = listTeachers();
	return { teachers: locals.user?.isAdmin ? all : all.filter((t) => t.id === locals.user?.id) };
}
