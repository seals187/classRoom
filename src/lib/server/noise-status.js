// Aktueller Ampel-Zustand vom Gerät jeder Lehrkraft, nur im Speicher. Es kommt nur die Farbe an – kein Ton.

/** @typedef {import('#lib/noise.svelte.js').NoiseStatus} NoiseStatus */

const STALE_MS = 8000; // ohne Meldung so lange → Ampel gilt als aus (Tab geschlossen o. Ä.)
const STATUSES = ['green', 'yellow', 'red'];

/** @type {Map<number, { status: NoiseStatus, updated: number }>} je Lehrkraft */
const current = new Map();

/** @param {number} owner @param {unknown} input */
export function setLiveNoise(owner, input) {
	const body = /** @type {{ active?: unknown, status?: unknown }} */ (input ?? {});
	if (!body.active) {
		current.delete(owner);
		return;
	}
	if (!STATUSES.includes(/** @type {string} */ (body.status))) throw new Error('Ungültiger Status');
	current.set(owner, { status: /** @type {NoiseStatus} */ (body.status), updated: Date.now() });
}

/** @param {number} owner */
export function getLiveNoise(owner) {
	const entry = current.get(owner);
	if (!entry || Date.now() - entry.updated > STALE_MS) return { active: false, status: 'green' };
	return { active: true, status: entry.status };
}
