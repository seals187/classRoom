import { minutesBetween } from './time.js';

/** Wochentage im Plan: 0 = Montag … 6 = Sonntag. */
export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/** @typedef {{ day: number, start: string, end: string, room: string }} Slot */

/** Wochentag im Plan für ein Datum (Montag = 0). @param {Date} d */
export const weekday = (d) => (d.getDay() + 6) % 7;

/** @param {string} t „HH:MM“ */
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Geplante Stunden eines Tages, nach Beginn sortiert. @param {Slot[]} schedule @param {number} day */
export const slotsOf = (schedule, day) =>
	schedule.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));

/**
 * Nächste geplante Stunde heute: die erste, deren Ende noch nicht vorbei ist.
 * @param {Slot[]} schedule
 * @param {Date} now
 * @returns {Slot | null}
 */
export function nextSlot(schedule, now) {
	const nowMin = now.getHours() * 60 + now.getMinutes();
	return slotsOf(schedule, weekday(now)).find((s) => toMin(s.start) + minutesBetween(s.start, s.end) > nowMin) ?? null;
}
