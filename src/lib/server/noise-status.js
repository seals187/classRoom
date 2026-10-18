// Aktueller Ampel-Zustand vom Lehrer-Gerät, nur im Speicher. Es kommt nur die Farbe an – kein Ton.

/** @typedef {import('#lib/noise.svelte.js').NoiseStatus} NoiseStatus */

const STALE_MS = 8000; // ohne Meldung so lange → Ampel gilt als aus (Tab geschlossen o. Ä.)
const STATUSES = ['green', 'yellow', 'red'];

/** @type {{ status: NoiseStatus, updated: number } | null} */
let current = null;

/** @param {unknown} input */
export function setLiveNoise(input) {
	const body = /** @type {{ active?: unknown, status?: unknown }} */ (input ?? {});
	if (!body.active) {
		current = null;
		return;
	}
	if (!STATUSES.includes(/** @type {string} */ (body.status))) throw new Error('Ungültiger Status');
	current = { status: /** @type {NoiseStatus} */ (body.status), updated: Date.now() };
}

export function getLiveNoise() {
	if (!current || Date.now() - current.updated > STALE_MS) return { active: false, status: 'green' };
	return { active: true, status: current.status };
}
