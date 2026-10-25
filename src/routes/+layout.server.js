import { getConfig } from '#lib/server/config.js';
import { manageScope, teachersOf } from '#lib/server/auth.js';
import { countPeople, getNoiseSettings, getRooms, getSchedule, getSettings, getWarnMinutes } from '#lib/server/db.js';
import { getBackground } from '#lib/server/backgrounds.js';

export function load({ locals }) {
	if (!locals.user) return { user: null };
	const config = getConfig();
	const owner = locals.owner;
	const isTeacher = locals.user.role === 'teacher';
	return {
		user: locals.user,
		settings: getSettings(owner),
		warnMinutes: getWarnMinutes(owner),
		goMinutes: config.goMinutes,
		lessonDurations: config.lessonDurations,
		background: getBackground(locals.user, owner),
		goalsCollapsed: config.goalsCollapsed,
		// Zahlen neben „Schüler / Lehrer verwalten“ im Menü
		counts: isTeacher ? countPeople(manageScope(locals)) : null,
		rooms: isTeacher ? getRooms(owner) : [],
		schedule: isTeacher ? getSchedule(owner) : [],
		// Schüler mit mehreren Lehrkräften wählen im Menü, wessen Auftrag und Stunde sie sehen.
		teachers: isTeacher ? [] : teachersOf(/** @type {number} */ (locals.user.studentId)),
		owner,
		// Lehrkräfte messen (Mikrofon am Beamer-Gerät), Schüler sehen nur die Farbe.
		noise: isTeacher ? getNoiseSettings(owner) : { enabled: getNoiseSettings(owner).enabled }
	};
}
