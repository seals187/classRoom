// Gemeinsame, sekündlich aktualisierte Uhrzeit. Bleibt bis zum Mount `null`,
// damit der Server (evtl. andere Zeitzone) keine falsche Zeit rendert.
export const clock = $state({ now: /** @type {Date | null} */ (null) });

/** @type {ReturnType<typeof setInterval> | null} */
let timer = null;

export function startClock() {
	clock.now = new Date();
	timer ??= setInterval(() => (clock.now = new Date()), 1000);
	return () => {
		if (timer) clearInterval(timer);
		timer = null;
	};
}
