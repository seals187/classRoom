<script>
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';
	import { formatClock, lessonSpan } from '#lib/time.js';
	import { clock } from '#lib/clock.svelte.js';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { NAV } from '#lib/nav.js';
	import logo from '#lib/assets/logo.svg';
	import { noise, setNoiseConfig, startNoise, stopNoise } from '#lib/noise.svelte.js';
	import { ui } from '#lib/ui.svelte.js';

	/**
	 * @type {{
	 *   open: boolean,
	 *   settings: { roomName: string, roomChange: boolean, startTime: string, returnTime: string },
	 *   user: import('#lib/server/auth.js').User,
	 *   noiseSettings: import('#lib/server/db.js').NoiseSettings | null
	 * }}
	 */
	let { open = $bindable(false), settings, user, noiseSettings } = $props();

	const isTeacher = $derived(user.role === 'teacher');
	// Schüler sehen nur ihre Seiten, Darstellung und Abmelden.
	const links = $derived(isTeacher ? NAV : NAV.filter((item) => !item.teacherOnly));

	let form = $state({ roomName: '', roomChange: true, startTime: '', returnTime: '' });
	let saving = $state(false);
	let message = $state('');

	let noiseForm = $state({ enabled: true, sensitivity: 5, yellow: 50, red: 75 });
	let noiseMessage = $state('');

	// Beim Öffnen (und nach dem Speichern) die aktuellen Werte übernehmen.
	$effect(() => {
		if (!open) return;
		form = { ...settings, startTime: settings.startTime.slice(0, 5), returnTime: settings.returnTime.slice(0, 5) };
		if (noiseSettings) noiseForm = { ...noiseSettings };
	});

	// Die Ampel misst mit den gespeicherten Werten – solange das Menü offen ist, mit den
	// Reglerwerten, damit man beim Testen sofort sieht, wie sie sich auswirken.
	$effect(() => {
		const active = open ? { ...noiseForm } : noiseSettings;
		if (active) setNoiseConfig(active);
	});

	/** @param {SubmitEvent} e */
	async function saveNoise(e) {
		e.preventDefault();
		noiseMessage = '';
		try {
			await api('/api/noise', 'PUT', noiseForm);
			await invalidateAll();
			noiseMessage = 'Gespeichert';
		} catch (err) {
			noiseMessage = err instanceof Error ? err.message : String(err);
		}
	}

	function toggleMic() {
		if (noise.active) stopNoise();
		else startNoise();
	}

	/** @param {() => Promise<unknown>} action */
	async function run(action, done = 'Gespeichert') {
		saving = true;
		message = '';
		try {
			await action();
			await invalidateAll();
			message = done;
		} catch (err) {
			message = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	// Läuft gerade eine Stunde (gespeicherte Zeiten, Beginn vorbei, Ende höchstens 30 min her)?
	const EXTEND = [5, 10, 15];
	const running = $derived.by(() => {
		const now = clock.now;
		if (!now || !settings.startTime || !settings.returnTime) return false;
		const { start, end } = lessonSpan(settings.startTime, settings.returnTime, now);
		return !!start && !!end && start <= now && now.getTime() < end.getTime() + 30 * 60000;
	});

	/** @param {SubmitEvent} e */
	function save(e) {
		e.preventDefault();
		if (!form.startTime) form.startTime = hhmm(new Date());
		run(() => api('/api/settings', 'PUT', form), running ? 'Stunde aktualisiert' : 'Stunde gestartet');
	}

	/**
	 * Laufende Stunde verlängern – sofort gespeichert. Ist die Zeit schon um, zählt es ab jetzt.
	 * @param {number} minutes
	 */
	function extend(minutes) {
		const now = /** @type {Date} */ (clock.now ?? new Date());
		const { end } = lessonSpan(settings.startTime, settings.returnTime, now);
		const base = end && end > now ? end : now;
		form.returnTime = hhmm(new Date(base.getTime() + minutes * 60000));
		run(
			() => api('/api/settings', 'PUT', { ...settings, returnTime: form.returnTime }),
			`Um ${minutes} min verlängert – Ende ${form.returnTime}`
		);
	}

	const durations = $derived(/** @type {number[]} */ (page.data.lessonDurations ?? [45, 90]));

	/** @param {Date} d */
	const hhmm = (d) => formatClock(d).slice(0, 5);

	function startNow() {
		form.startTime = hhmm(new Date());
	}

	/** Ende = Beginn (oder jetzt) + Minuten. @param {number} minutes */
	function addMinutes(minutes) {
		if (!form.startTime) form.startTime = hhmm(new Date());
		const [h, m] = form.startTime.split(':').map(Number);
		const end = new Date();
		end.setHours(h, m + minutes, 0, 0);
		form.returnTime = hhmm(end);
	}

	function clearTimes() {
		form.startTime = '';
		form.returnTime = '';
		run(() => api('/api/settings', 'PUT', form), 'Zeiten zurückgesetzt');
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

{#if open}
	<button class="backdrop" tabindex="-1" aria-label="Menü schließen" onclick={() => (open = false)}></button>

	<aside class="drawer" aria-label="Menü">
		<div class="drawer-head">
			<h2 class="brand"><img src={logo} alt="" width="28" height="28" /><span>class<span class="r">R</span>oom</span></h2>
			<button class="icon-btn" aria-label="Menü schließen" onclick={() => (open = false)}>
				<Icon name="close" size={18} />
			</button>
		</div>

		<nav>
			{#each links as link (link.href)}
				<a
					href={link.href}
					class:active={page.url.pathname === link.href}
					onclick={() => (open = false)}
				>
					<Icon name={link.icon} size={18} />
					{link.label}
				</a>
			{/each}
		</nav>

		{#if isTeacher}
		<form onsubmit={save}>
			<h3>Unterrichtsstunde</h3>
			<div class="times">
				<label>
					Beginn
					<input type="time" bind:value={form.startTime} />
				</label>
				<label>
					Ende
					<input type="time" bind:value={form.returnTime} />
				</label>
			</div>
			<div class="quick">
				<button type="button" onclick={startNow} title="Beginn auf die aktuelle Uhrzeit setzen">Jetzt</button>
				{#each durations as minutes (minutes)}
					<button type="button" onclick={() => addMinutes(minutes)} title="Ende = Beginn + {minutes} min">+{minutes} min</button>
				{/each}
			</div>
			{#if running}
				<!-- Laufende Stunde verlängern: wirkt sofort -->
				<div class="extend">
					<span>Verlängern</span>
					{#each EXTEND as minutes (minutes)}
						<button type="button" onclick={() => extend(minutes)} disabled={saving} title="Ende um {minutes} min nach hinten schieben">
							+{minutes}
						</button>
					{/each}
					<span>min</span>
				</div>
			{/if}

			<!-- Raumwechsel: Felder erscheinen nur bei Bedarf -->
			<label class="switch">
				<span><Icon name="door" size={16} /> Danach Raumwechsel</span>
				<input type="checkbox" role="switch" bind:checked={form.roomChange} />
			</label>
			{#if form.roomChange}
				<label>
					Zurück in Raum
					<input type="text" bind:value={form.roomName} maxlength="60" placeholder="z. B. Raum 101" required />
				</label>
			{/if}

			<button type="submit" class="primary start-btn" disabled={saving}>{running ? 'Stunde aktualisieren' : 'Stunde starten'}</button>
			<button type="button" class="text-link" onclick={clearTimes} disabled={saving} title="Beginn und Ende leeren">
				Zeiten zurücksetzen
			</button>
			{#if message}<p class="message">{message}</p>{/if}
		</form>
		{/if}

		{#if noiseSettings}
			<details class="noise">
				<summary>Ampel-Einstellungen</summary>
				<form onsubmit={saveNoise}>
					<label class="inline">
						<input type="checkbox" bind:checked={noiseForm.enabled} />
						Ampel neben der Uhr anzeigen
					</label>
					<label class="field" title="Höher = reagiert schon auf leisere Geräusche">
						Empfindlichkeit
						<span class="slider">
							<input type="range" min="1" max="10" bind:value={noiseForm.sensitivity} />
							<output>{noiseForm.sensitivity}</output>
						</span>
					</label>
					<label class="field" title="Ab diesem Pegel (0–100) wird die Ampel gelb">
						Gelb ab
						<span class="slider">
							<input type="range" min="1" max="99" bind:value={noiseForm.yellow} />
							<output>{noiseForm.yellow}</output>
						</span>
					</label>
					<label class="field" title="Ab diesem Pegel (0–100) wird die Ampel rot">
						Rot ab
						<span class="slider">
							<input type="range" min="2" max="100" bind:value={noiseForm.red} />
							<output>{noiseForm.red}</output>
						</span>
					</label>

					<!-- Live-Pegel mit den beiden Schwellen als Markierung -->
					<div class="meter {noise.status}" class:idle={!noise.active} aria-label="Aktueller Pegel">
						<div class="meter-fill" style:width="{noise.level}%"></div>
						<span class="mark" style:left="{noiseForm.yellow}%" title="Gelb"></span>
						<span class="mark red" style:left="{noiseForm.red}%" title="Rot"></span>
						<span class="meter-value">{noise.active ? Math.round(noise.level) : '–'}</span>
					</div>

					<div class="actions">
						<button type="button" onclick={toggleMic} title="Sprich etwas ins Mikrofon und beobachte den Pegel">
							{noise.active ? 'Mikrofon aus' : '🎤 Testen'}
						</button>
						<button type="submit" class="primary">Speichern</button>
					</div>
					{#if noise.error}<p class="message error">{noise.error}</p>{/if}
					{#if noiseMessage}<p class="message">{noiseMessage}</p>{/if}
				</form>
			</details>
		{/if}

		<div class="theme">
			<span>Darstellung</span>
			<ThemeToggle />
		</div>

		{#if page.data.background?.canChoose}
			<div class="background">
				<span>Hintergrund</span>
				<button
					type="button"
					onclick={() => {
						open = false;
						ui.backgroundPicker = true;
					}}>Ändern…</button
				>
			</div>
		{/if}

		<form class="logout" method="POST" action="/logout">
			<span>Angemeldet als <strong>{isTeacher ? user.username : user.displayName}</strong></span>
			<button type="submit">Abmelden</button>
		</form>
	</aside>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: rgb(20 30 50 / 25%);
		cursor: default;
	}

	.drawer {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: 11;
		width: min(360px, 100vw);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px 16px;
		background: var(--surface);
		box-shadow: 4px 0 24px rgb(20 30 60 / 15%);
		font-size: 0.92rem;
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.drawer-head h2 {
		font-size: 1.15rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 800;
	}

	.brand img {
		margin-right: 2px;
		border-radius: 7px;
	}

	/* Wie im Banner: das „R“ in Orange. */
	.brand .r {
		color: #f08a3c;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border-radius: 8px;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
	}

	nav a:hover {
		background: var(--bg);
	}

	nav a.active {
		background: var(--accent-soft);
		color: var(--accent);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	h3 {
		font-size: 0.95rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 0.82rem;
		color: var(--muted);
	}

	/* Beschriftung links neben dem Feld – spart pro Feld eine Zeile. */
	label.field {
		display: grid;
		grid-template-columns: 84px 1fr;
		align-items: center;
		gap: 8px;
	}

	/* Kompaktere Felder und Knöpfe als im Rest der App. */
	.drawer input[type='text'],
	.drawer input[type='time'] {
		padding: 5px 8px;
		color: var(--text);
	}

	.drawer button:not(.icon-btn) {
		padding: 5px 10px;
	}

	.row,
	.actions {
		display: flex;
		gap: 6px;
	}

	.row input {
		flex: 1;
	}

	/* --- Unterrichtsstunde: Beginn/Ende nebeneinander, Schnellknöpfe, Raumwechsel --- */
	.times {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.drawer .quick button {
		padding: 4px 10px;
		font-size: 0.82rem;
		color: var(--muted);
	}

	/* Laufende Stunde verlängern */
	.extend {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 8px;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.extend span:first-child {
		margin-right: auto;
	}

	.drawer .extend button {
		padding: 3px 10px;
		border-color: var(--accent);
		background: var(--surface);
		color: var(--accent);
		font-size: 0.82rem;
		font-weight: 700;
	}

	.switch {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		margin-top: 4px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
		color: var(--text);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.switch span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	/* Kippschalter statt Häkchen */
	.switch input {
		appearance: none;
		position: relative;
		width: 38px;
		height: 22px;
		margin: 0;
		border-radius: 999px;
		background: var(--track);
		box-shadow: inset 0 0 0 1px var(--border);
		cursor: pointer;
		transition: background 0.2s;
	}

	.switch input::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgb(0 0 0 / 30%);
		transition: transform 0.2s;
	}

	.switch input:checked {
		background: var(--accent);
		box-shadow: none;
	}

	.switch input:checked::after {
		transform: translateX(16px);
	}

	.switch input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.drawer .start-btn {
		margin-top: 4px;
		padding: 8px 10px;
		font-weight: 700;
	}

	.drawer .text-link {
		align-self: center;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.78rem;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.actions button {
		flex: 1;
	}

	.message {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
	}

	/* --- Ampel-Einstellungen (aufklappbar) --- */
	.noise {
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.noise summary {
		cursor: pointer;
		font-weight: 700;
		font-size: 0.95rem;
	}

	.noise form {
		margin-top: 8px;
		padding-top: 0;
		border-top: 0;
	}

	label.inline {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}

	.slider {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.slider input {
		flex: 1;
		accent-color: var(--accent);
	}

	.slider output {
		min-width: 2ch;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.meter {
		position: relative;
		height: 22px;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
	}

	.meter-fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: #2fdc76;
		transition: width 0.1s linear;
	}

	.meter.yellow .meter-fill {
		background: #ffc531;
	}

	.meter.red .meter-fill {
		background: #ff3b3b;
	}

	.meter.idle .meter-fill {
		width: 0 !important;
	}

	.mark {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: #d9a400;
	}

	.mark.red {
		background: #d63c3c;
	}

	.meter-value {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.message.error {
		color: var(--danger);
	}

	.theme {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
		font-size: 0.82rem;
		color: var(--muted);
	}

	.background {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.logout {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: auto;
		font-size: 0.82rem;
		color: var(--muted);
	}

	/* Smartphone/Tablet: Abmelden direkt unter den Einstellungen statt ganz unten –
	   dort liegt es sonst oft hinter der Browserleiste und man müsste scrollen. */
	@media (max-width: 900px), (hover: none) {
		.logout {
			margin-top: 0;
		}
	}
</style>
