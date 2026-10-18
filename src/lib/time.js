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
