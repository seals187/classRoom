/** @param {number} n */
export const pad = (n) => String(n).padStart(2, '0');

/**
 * "HH:MM" oder "HH:MM:SS" als Zeitpunkt am Tag von `now`.
 * @param {string} hhmm
 * @param {Date} now
 */
export function atToday(hhmm, now) {
	const [h, m, s = 0] = hhmm.split(':').map(Number);
	const d = new Date(now);
	d.setHours(h, m, s, 0);
	return d;
}

const DAY = 24 * 3_600_000;

/**
 * Beginn und Ende einer Stunde als Zeitpunkte – auch über Mitternacht (z. B. 23:30 bis 00:15).
 * Ein Beginn mehr als 4 h in der Zukunft gilt als gestern (z. B. 23:30, angezeigt um 00:10), das Ende liegt danach.
 * @param {string} startTime "HH:MM" oder leer
 * @param {string} endTime "HH:MM" oder leer
 * @param {Date} now
 */
export function lessonSpan(startTime, endTime, now) {
	/** @param {Date} d */
	const startDay = (d) => {
		const diff = d.getTime() - now.getTime();
		return diff > 4 * 3_600_000 ? new Date(d.getTime() - DAY) : d;
	};
	const start = startTime ? startDay(atToday(startTime, now)) : null;
	let end = endTime ? atToday(endTime, now) : null;
	if (end && start) {
		end = new Date(start.getTime() + ((((end.getTime() - start.getTime()) % DAY) + DAY) % DAY));
	} else if (end) {
		// Nur ein Ende: liegt es mehr als 12 h zurück, ist das Ende morgen gemeint (z. B. 00:15 um 23:50).
		if (end.getTime() - now.getTime() < -DAY / 2) end = new Date(end.getTime() + DAY);
	}
	return { start, end };
}

/** @param {number} ms */
export function formatDuration(ms) {
	const total = Math.floor(ms / 1000);
	return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/** @param {number} ms */
export function formatRemaining(ms) {
	if (ms <= 0) return 'Zeit ist um';
	const minutes = Math.ceil(ms / 60000);
	if (minutes < 60) return `noch ${minutes} min`;
	return `noch ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** @param {Date} d */
export const formatDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** @param {Date} d */
export const formatClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
