import { getConfig } from '#lib/server/config.js';
import { getNoiseSettings, getSettings } from '#lib/server/db.js';

export function load({ locals }) {
	if (!locals.user) return { user: null };
	const config = getConfig();
	return {
		user: locals.user,
		settings: getSettings(),
		warnMinutes: config.warnMinutes,
		goalsCollapsed: config.goalsCollapsed,
		// Lehrkräfte messen (Mikrofon am Beamer-Gerät), Schüler sehen nur die Farbe.
		noise:
			locals.user.role === 'teacher' ? getNoiseSettings() : { enabled: getNoiseSettings().enabled }
	};
}
