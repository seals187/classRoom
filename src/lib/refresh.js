import { invalidateAll } from '$app/navigation';

/**
 * Seitendaten regelmäßig nachladen, damit Änderungen von anderen Geräten (Schüler ↔ Beamer) erscheinen.
 * Für `onMount` gedacht – gibt die Aufräumfunktion zurück.
 * @param {number} ms
 */
export function autoRefresh(ms) {
	const timer = setInterval(() => {
		if (document.visibilityState === 'visible') invalidateAll();
	}, ms);
	return () => clearInterval(timer);
}
