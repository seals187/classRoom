import { env } from '$env/dynamic/private';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** @param {string | undefined} value */
const timeOrEmpty = (value) => (value && TIME.test(value.trim()) ? value.trim() : '');

/** Konfiguration aus der .env-Datei (bzw. den Umgebungsvariablen), mit Standardwerten. */
export function getConfig() {
	return {
		databasePath: env.DATABASE_PATH || 'data/classroom.db',
		defaults: {
			roomName: env.DEFAULT_ROOM_NAME?.trim() || 'Klassenzimmer',
			startTime: timeOrEmpty(env.DEFAULT_START_TIME),
			returnTime: timeOrEmpty(env.DEFAULT_RETURN_TIME)
		},
		warnMinutes: Math.max(0, Number(env.WARN_MINUTES) || 5),
		teacher: {
			username: env.TEACHER_USERNAME?.trim().toLowerCase() || '',
			password: env.TEACHER_PASSWORD || ''
		},
		sessionHours: Math.max(1, Number(env.SESSION_HOURS) || 12),
		uploadMaxMb: Math.max(1, Number(env.UPLOAD_MAX_MB) || 5),
		goalsCollapsed: env.GOALS_COLLAPSED?.trim().toLowerCase() !== 'false',
		defaultTheme: ['light', 'dark'].includes(env.DEFAULT_THEME?.trim() ?? '') ? env.DEFAULT_THEME.trim() : 'system'
	};
}

export { TIME };
