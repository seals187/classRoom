import { api } from '#lib/api.js';
import { showError } from '#lib/dialog.svelte.js';

/**
 * „Anmelden als …“ (nur Admin): danach ganz neu laden – andere Person, andere Klasse, andere Rechte.
 * @param {{ teacherId: number } | { studentId: number }} target
 */
export async function actAs(target) {
	try {
		await api('/api/impersonate', 'POST', target);
		location.href = '/';
	} catch (err) {
		showError(err);
	}
}
