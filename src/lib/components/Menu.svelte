<script>
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';
	import { formatClock } from '#lib/time.js';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { NAV } from '#lib/nav.js';
	import { noise, setNoiseConfig, startNoise, stopNoise } from '#lib/noise.svelte.js';

	/**
	 * @type {{
	 *   open: boolean,
	 *   gearAutoHide: boolean,
	 *   settings: { roomName: string, startTime: string, returnTime: string },
	 *   user: import('#lib/server/auth.js').User,
	 *   noiseSettings: import('#lib/server/db.js').NoiseSettings | null
	 * }}
	 */
	let { open = $bindable(false), gearAutoHide = $bindable(false), settings, user, noiseSettings } = $props();

	const links = NAV;

	let form = $state({ roomName: '', startTime: '', returnTime: '' });
	let saving = $state(false);
	let message = $state('');

	let noiseForm = $state({ enabled: true, sensitivity: 5, yellow: 50, red: 75 });
	let noiseMessage = $state('');

	// Beim Öffnen (und nach dem Speichern) die aktuellen Werte übernehmen.
	$effect(() => {
		if (!open) return;
		form = { ...settings };
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

	/** @param {SubmitEvent} e */
	function save(e) {
		e.preventDefault();
		run(() => api('/api/settings', 'PUT', form));
	}

	function startNow() {
		form.startTime = formatClock(new Date());
		run(() => api('/api/settings', 'PUT', form), 'Stunde gestartet');
	}

	function clearTimes() {
		form.startTime = '';
		form.returnTime = '';
		run(() => api('/api/settings', 'PUT', form), 'Zeiten zurückgesetzt');
	}

	function persistGear() {
		try {
			localStorage.setItem('gearAutoHide', gearAutoHide ? '1' : '0');
		} catch {
			// Ignorieren – gilt dann nur bis zum Neuladen.
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

{#if open}
	<button class="backdrop" tabindex="-1" aria-label="Menü schließen" onclick={() => (open = false)}></button>

	<aside class="drawer" aria-label="Menü">
		<div class="drawer-head">
			<h2>Menü</h2>
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

		<form onsubmit={save}>
			<h3>Unterrichtsstunde</h3>
			<label class="field">
				Klassenraum
				<input type="text" bind:value={form.roomName} maxlength="60" required />
			</label>
			<label class="field">
				Beginn
				<span class="row">
					<input type="time" step="1" bind:value={form.startTime} />
					<button type="button" onclick={startNow} disabled={saving} title="Beginn auf die aktuelle Uhrzeit setzen">
						Jetzt
					</button>
				</span>
			</label>
			<label class="field" title="Zurück ins Hauptschulzimmer um">
				Zurück um
				<input type="time" bind:value={form.returnTime} />
			</label>
			<div class="actions">
				<button type="submit" class="primary" disabled={saving}>Speichern</button>
				<button type="button" onclick={clearTimes} disabled={saving} title="Beginn und Rückkehrzeit leeren">
					Zeiten zurücksetzen
				</button>
			</div>
			{#if message}<p class="message">{message}</p>{/if}
		</form>

		{#if noiseSettings}
			<details class="noise">
				<summary>Ampel-Einstellungen</summary>
				<form onsubmit={saveNoise}>
					<label class="inline">
						<input type="checkbox" bind:checked={noiseForm.enabled} />
						Ampel unter der Uhr anzeigen
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

		<label class="check">
			<input type="checkbox" bind:checked={gearAutoHide} onchange={persistGear} />
			Zahnrad ausblenden (erscheint beim Darüberfahren)
		</label>

		<div class="theme">
			<span>Darstellung</span>
			<ThemeToggle />
		</div>

		<form class="logout" method="POST" action="/logout">
			<span>Angemeldet als <strong>{user.username}</strong></span>
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

	.check {
		flex-direction: row;
		align-items: center;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.theme {
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
</style>
