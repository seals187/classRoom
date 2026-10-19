import { getConfig } from '#lib/server/config.js';
import { countPeople, getNoiseSettings, getRooms, getSettings, getWarnMinutes } from '#lib/server/db.js';
import { getBackground } from '#lib/server/backgrounds.js';

export function load({ locals }) {
	if (!locals.user) return { user: null };
	const config = getConfig();
	return {
		user: locals.user,
		settings: getSettings(),
		warnMinutes: getWarnMinutes(),
		goMinutes: config.goMinutes,
		lessonDurations: config.lessonDurations,
		background: getBackground(locals.user),
		goalsCollapsed: config.goalsCollapsed,
		// Zahlen neben „Schüler / Lehrer verwalten“ im Menü
		counts: locals.user.role === 'teacher' ? countPeople() : null,
		rooms: locals.user.role === 'teacher' ? getRooms() : [],
		// Lehrkräfte messen (Mikrofon am Beamer-Gerät), Schüler sehen nur die Farbe.
		noise:
			locals.user.role === 'teacher' ? getNoiseSettings() : { enabled: getNoiseSettings().enabled }
	};
}
