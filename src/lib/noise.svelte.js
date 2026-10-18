// Lautstärke-Messung für die Ampel. Läuft komplett im Browser – es wird nichts aufgenommen,
// gespeichert oder an den Server geschickt. Modul-weit, damit die Messung beim Seitenwechsel weiterläuft.

/** @typedef {'green' | 'yellow' | 'red'} NoiseStatus */

export const noise = $state({
	active: false,
	/** geglätteter Pegel 0–100 */
	level: 0,
	/** @type {NoiseStatus} */
	status: 'green',
	error: ''
});

const AUTO_KEY = 'noiseAuto';
const HOLD_MS = 1500; // Gelb/Rot mindestens so lange halten → kein Flackern
const RANK = { green: 0, yellow: 1, red: 2 };

let config = { sensitivity: 5, yellow: 50, red: 75 };

/** @type {AudioContext | null} */
let ctx = null;
/** @type {MediaStream | null} */
let stream = null;
/** @type {ReturnType<typeof setInterval> | null} */
let timer = null;
let smoothed = 0;
let heldUntil = 0;
let lastSent = 0;
/** @type {NoiseStatus | null} */
let lastSentStatus = null;

const SEND_EVERY_MS = 4000; // Lebenszeichen an den Server, auch ohne Farbwechsel
const POLL_MS = 1500;

/**
 * Nur die Ampelfarbe an den Server melden, damit Schüler sie sehen – kein Ton.
 * @param {boolean} active
 */
function sendStatus(active) {
	lastSent = performance.now();
	lastSentStatus = active ? noise.status : null;
	fetch('/api/noise/status', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ active, status: noise.status }),
		keepalive: true
	}).catch(() => {
		// Netzwerkfehler: nächster Versuch beim nächsten Lebenszeichen
	});
}

/**
 * Schüler-Ansicht: Ampelfarbe vom Lehrer-Gerät regelmäßig abholen.
 * @returns {() => void} Aufräumfunktion
 */
export function watchRemoteNoise() {
	let stopped = false;
	async function poll() {
		if (document.hidden) return;
		try {
			const res = await fetch('/api/noise/status');
			if (!res.ok || stopped) return;
			const data = await res.json();
			noise.active = Boolean(data.active);
			noise.status = data.status;
		} catch {
			// kurz offline – beim nächsten Mal wieder
		}
	}
	poll();
	const id = setInterval(poll, POLL_MS);
	return () => {
		stopped = true;
		clearInterval(id);
	};
}

/** @param {Partial<typeof config>} next */
export function setNoiseConfig(next) {
	config = { ...config, ...next };
}

/** @param {number} level */
function statusFor(level) {
	return level >= config.red ? 'red' : level >= config.yellow ? 'yellow' : 'green';
}

/** @param {boolean} value */
function rememberAuto(value) {
	try {
		localStorage.setItem(AUTO_KEY, value ? '1' : '0');
	} catch {
		// egal – dann eben kein Autostart
	}
}

export function wantsAutoStart() {
	try {
		return localStorage.getItem(AUTO_KEY) === '1';
	} catch {
		return false;
	}
}

export async function startNoise() {
	if (noise.active) return;
	noise.error = '';
	if (!navigator.mediaDevices?.getUserMedia) {
		noise.error = window.isSecureContext
			? 'Kein Mikrofon verfügbar.'
			: 'Mikrofon geht nur über HTTPS oder localhost.';
		return;
	}
	try {
		// Ohne Rauschunterdrückung/Pegelautomatik, sonst „hört“ man Lärm kaum.
		stream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
		});
	} catch (err) {
		const name = err instanceof DOMException ? err.name : '';
		noise.error =
			name === 'NotAllowedError'
				? 'Mikrofon-Zugriff wurde verweigert (Browser-Einstellungen prüfen).'
				: name === 'NotFoundError'
					? 'Kein Mikrofon gefunden.'
					: 'Mikrofon konnte nicht gestartet werden.';
		rememberAuto(false);
		return;
	}

	ctx = new AudioContext();
	// Ohne Klick startet der Browser den Audio-Kontext evtl. pausiert → beim ersten Klick fortsetzen.
	if (ctx.state === 'suspended') {
		const resume = () => ctx?.resume();
		document.addEventListener('pointerdown', resume, { once: true });
	}
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 2048;
	ctx.createMediaStreamSource(stream).connect(analyser);
	const buffer = new Float32Array(analyser.fftSize);

	noise.active = true;
	rememberAuto(true);

	timer = setInterval(() => {
		analyser.getFloatTimeDomainData(buffer);
		let sum = 0;
		for (const v of buffer) sum += v * v;
		const rms = Math.sqrt(sum / buffer.length);
		// dBFS ca. -70 (still) bis -10 (sehr laut) → 0–100; Empfindlichkeit verschiebt um ±4 dB pro Stufe.
		const db = 20 * Math.log10(rms || 1e-8) + (config.sensitivity - 5) * 4;
		const level = Math.min(100, Math.max(0, ((db + 70) / 60) * 100));
		// Schnell hoch, langsam runter.
		smoothed = level > smoothed ? smoothed * 0.5 + level * 0.5 : smoothed * 0.9 + level * 0.1;
		noise.level = smoothed;

		const next = statusFor(smoothed);
		const now = performance.now();
		if (RANK[next] >= RANK[noise.status] || now > heldUntil) {
			if (RANK[next] > 0 && next !== noise.status) heldUntil = now + HOLD_MS;
			noise.status = next;
		}
		if (noise.status !== lastSentStatus || now - lastSent > SEND_EVERY_MS) sendStatus(true);
	}, 100);
}

export function stopNoise() {
	if (timer) clearInterval(timer);
	timer = null;
	stream?.getTracks().forEach((t) => t.stop());
	stream = null;
	ctx?.close();
	ctx = null;
	smoothed = 0;
	noise.active = false;
	noise.level = 0;
	noise.status = 'green';
	rememberAuto(false);
	sendStatus(false);
}
