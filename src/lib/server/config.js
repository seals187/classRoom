// Direkt aus process.env lesen: SvelteKit 3 gibt über $app/env/private nur vorab deklarierte
// Variablen heraus. Docker (env_file) und `npm start` (--env-file) setzen process.env bereits;
// im Entwicklungsmodus (vite dev) laden wir die .env hier selbst – vorhandene Werte gewinnen.
try {
	process.loadEnvFile('.env');
} catch {
	// Keine .env vorhanden (z. B. im Container) – dann gelten die Umgebungsvariablen.
}
const env = process.env;

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** @param {string | undefined} value */
const timeOrEmpty = (value) => (value && TIME.test(value.trim()) ? value.trim() : '');

/**
 * @param {string | undefined} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
const intIn = (value, min, max, fallback) => {
	const n = Math.round(Number(value));
	return Number.isFinite(n) && value?.trim() ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * "45,90" → [45, 90]; ungültige Werte fallen weg, ohne gültige gilt 45 und 90.
 * @param {string | undefined} value
 */
const parseDurations = (value) => {
	const list = (value ?? '')
		.split(',')
		.map((v) => Math.round(Number(v.trim())))
		.filter((n) => Number.isFinite(n) && n >= 1 && n <= 600);
	return list.length ? [...new Set(list)].slice(0, 4) : [45, 90];
};

/** Konfiguration aus der .env-Datei (bzw. den Umgebungsvariablen), mit Standardwerten. */
export function getConfig() {
	return {
		databasePath: env.DATABASE_PATH || 'data/classroom.db',
		defaults: {
			roomName: env.DEFAULT_ROOM_NAME?.trim() || 'Klassenzimmer',
			// Nach der Stunde zurück in den Raum (roomName)? Sonst zeigt der Balken nur „Ende“.
			roomChange: env.DEFAULT_ROOM_CHANGE?.trim().toLowerCase() !== 'false',
			startTime: timeOrEmpty(env.DEFAULT_START_TIME),
			returnTime: timeOrEmpty(env.DEFAULT_RETURN_TIME)
		},
		// Zeitbalken: ab WARN_MINUTES vor Schluss „Aufräumen“, ab GO_MINUTES „Jetzt zurück“ (Losgehen).
		warnMinutes: Math.max(0, Number(env.WARN_MINUTES) || 5),
		goMinutes: intIn(env.GO_MINUTES, 0, 60, 3),
		// Knöpfe „Jetzt starten“ im Kopfband (Minuten), der erste ist der Hauptknopf.
		lessonDurations: parseDurations(env.LESSON_DURATIONS),
		teacher: {
			username: env.TEACHER_USERNAME?.trim().toLowerCase() || '',
			password: env.TEACHER_PASSWORD || ''
		},
		sessionHours: Math.max(1, Number(env.SESSION_HOURS) || 12),
		uploadMaxMb: Math.max(1, Number(env.UPLOAD_MAX_MB) || 5),
		goalsCollapsed: env.GOALS_COLLAPSED?.trim().toLowerCase() !== 'false',
		noise: {
			enabled: env.NOISE_ENABLED?.trim().toLowerCase() !== 'false',
			sensitivity: intIn(env.NOISE_SENSITIVITY, 1, 10, 5),
			yellow: intIn(env.NOISE_YELLOW, 1, 99, 50),
			red: intIn(env.NOISE_RED, 2, 100, 75)
		},
		defaultTheme: ['light', 'dark'].includes(env.DEFAULT_THEME?.trim() ?? '') ? env.DEFAULT_THEME.trim() : 'system'
	};
}

export { TIME };
