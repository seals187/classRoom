import { invalidateAll } from '$app/navigation';
import { api } from '#lib/api.js';
import { ask, showError } from '#lib/dialog.svelte.js';

// Aktionen für eine Schüler-Zeile – gleich in der Klasse und im Reiter „Schüler“.

/**
 * Neues Passwort (bzw. Zugang anlegen). Gibt die Zugangsdaten zum Anzeigen/Drucken zurück.
 * @param {{ id: number, firstName: string, lastName: string, username: string | null }} s
 */
export async function newPassword(s) {
	const ok = await ask({
		title: s.username ? `Neues Passwort für ${s.firstName} ${s.lastName}?` : `Zugang für ${s.firstName} ${s.lastName} anlegen?`,
		message: s.username ? 'Das alte Passwort gilt danach nicht mehr, und der Schüler wird überall abgemeldet.' : '',
		confirmLabel: s.username ? 'Neues Passwort' : 'Zugang anlegen'
	});
	if (!ok) return null;
	try {
		const credentials = await api(`/api/students/${s.id}/password`, 'POST');
		await invalidateAll();
		return [{ name: `${s.firstName} ${s.lastName}`, ...credentials }];
	} catch (err) {
		showError(err);
		return null;
	}
}

/** @param {{ id: number, firstName: string, lastName: string }} s */
export async function deleteStudent(s) {
	const ok = await ask({
		title: `${s.firstName} ${s.lastName} löschen?`,
		message: 'Der Schüler wird aus allen Klassen entfernt, samt Zugang und Zielen.',
		confirmLabel: 'Löschen',
		danger: true
	});
	if (!ok) return;
	try {
		await api(`/api/students/${s.id}`, 'DELETE');
	} catch (err) {
		showError(err);
	}
	await invalidateAll();
}

/**
 * @param {{ id: number, name: string }} klass
 * @param {{ id: number, firstName: string, lastName: string }} s
 */
export async function removeFromClass(klass, s) {
	try {
		await api(`/api/classes/${klass.id}/students`, 'DELETE', { studentIds: [s.id] });
	} catch (err) {
		showError(err);
	}
	await invalidateAll();
}
