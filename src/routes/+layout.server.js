import { getConfig } from '#lib/server/config.js';
import { listAssignmentTitles } from '#lib/server/assignment.js';
import { manageScope, teachersOf } from '#lib/server/auth.js';
import { countPeople, getNoiseSettings, getRooms, getSchedule, getSettings, getWarnMinutes } from '#lib/server/db.js';
import { getBackground } from '#lib/server/backgrounds.js';
import { listShares } from '#lib/server/share.js';
import { activeClass, listClasses } from '#lib/server/classes.js';

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
		// Klasse der Stunde (Kopfband, Stundenziele) und zur Wahl beim Starten.
		activeClass: activeClass(owner),
		classes: isTeacher ? listClasses(locals.user).map(({ id, name, color }) => ({ id, name, color })) : [],
		schedule: isTeacher ? getSchedule(owner) : [],
		// Aufträge im Menü (aufklappbar, der aktive markiert)
		assignmentList: isTeacher ? listAssignmentTitles(owner) : [],
		// Geteilte Aufträge (QR-Code): Adresse für den Link, Standard-Gültigkeit, Anzahl im Menü.
		sharing: isTeacher
			? { publicUrl: config.publicUrl, days: config.shareDays, count: listShares(locals.user).length }
			: null,
		// Schüler mit mehreren Lehrkräften wählen im Menü, wessen Auftrag und Stunde sie sehen.
		teachers: isTeacher ? [] : teachersOf(/** @type {number} */ (locals.user.studentId)),
		owner,
		// Lehrkräfte messen (Mikrofon am Beamer-Gerät), Schüler sehen nur die Farbe.
		noise: isTeacher ? getNoiseSettings(owner) : { enabled: getNoiseSettings(owner).enabled }
	};
}
