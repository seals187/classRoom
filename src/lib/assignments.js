// Aufträge in der Übersicht: geplantes Datum als „Heute“, „Morgen“ …
import { DAY_NAMES } from './schedule.js';

/** @param {Date} d */
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Montag der Woche. @param {Date} d */
function weekStart(d) {
	const start = dayStart(d);
	start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	return start;
}

/**
 * Geplantes Datum (YYYY-MM-DD) relativ zu heute: Heute, Morgen, Gestern, Wochentag (diese Woche),
 * Nächste Woche, Letzte Woche, sonst „3.11.“ (anderes Jahr „3.11.2027“).
 * @param {string | null | undefined} date
 * @param {Date} [now]
 */
export function dateLabel(date, now = new Date()) {
	if (!date) return '';
	const [y, m, d] = date.split('-').map(Number);
	const day = new Date(y, m - 1, d);
	const today = dayStart(now);
	const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
	if (diff === 0) return 'Heute';
	if (diff === 1) return 'Morgen';
	if (diff === -1) return 'Gestern';
	const weeks = Math.round((weekStart(day).getTime() - weekStart(today).getTime()) / (7 * 86_400_000));
	if (weeks === 0) return DAY_NAMES[(day.getDay() + 6) % 7];
	if (weeks === 1) return 'Nächste Woche';
	if (weeks === -1) return 'Letzte Woche';
	return `${d}.${m}.${y === today.getFullYear() ? '' : y}`;
}
