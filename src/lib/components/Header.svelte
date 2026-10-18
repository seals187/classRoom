<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { clock } from '#lib/clock.svelte.js';
	import { noise, startNoise, stopNoise, wantsAutoStart, watchRemoteNoise } from '#lib/noise.svelte.js';
	import { atToday, pad } from '#lib/time.js';
	import logo from '#lib/assets/logo.svg';
	import Icon from './Icon.svelte';
	import Menu from './Menu.svelte';

	/**
	 * Kopfband für alle Seiten: Menü-Knopf, Zeitbalken, (auf den Ziel-Seiten) Klassen-Fortschritt,
	 * Digitaluhr und kleine Ampel. Auf den Verwaltungsseiten nur Menü-Knopf und Logo.
	 * @type {{
	 *   user: import('#lib/server/auth.js').User,
	 *   settings: { roomName: string, startTime: string, returnTime: string },
	 *   warnMinutes: number,
	 *   noise: import('#lib/server/db.js').NoiseSettings | { enabled: boolean } | null
	 * }}
	 */
	let { user, settings, warnMinutes, noise: noiseSettings } = $props();

	const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
	const LAMPS = /** @type {const} */ (['red', 'yellow', 'green']);
	const LABELS = { red: 'zu laut', yellow: 'etwas leiser', green: 'gut' };
	const ADMIN_PAGES = ['/schueler', '/lehrer'];
	const GOAL_PAGES = ['/stundenziele', '/selbstlernen'];

	const isTeacher = $derived(user.role === 'teacher');
	const path = $derived(page.url.pathname);
	const isAdmin = $derived(ADMIN_PAGES.includes(path));
	/** @type {import('#lib/server/db.js').Student[] | null} */
	const students = $derived(GOAL_PAGES.includes(path) ? (page.data.students ?? null) : null);

	const noiseEnabled = $derived(Boolean(noiseSettings?.enabled));
	// Schüler sehen die Ampel nur, solange sie auf dem Lehrer-Gerät läuft.
	const showLight = $derived(noiseEnabled && (isTeacher || noise.active));

	let menuOpen = $state(false);
	let menuAutoHide = $state(false);

	const now = $derived(clock.now);
	const start = $derived(now && settings.startTime ? atToday(settings.startTime, now) : null);
	const end = $derived(now && settings.returnTime ? atToday(settings.returnTime, now) : null);
	const elapsed = $derived(now && start ? Math.max(0, now.getTime() - start.getTime()) : 0);
	const remaining = $derived(now && end ? end.getTime() - now.getTime() : null);
	const total = $derived(start && end && end > start ? end.getTime() - start.getTime() : null);
	const progress = $derived(remaining !== null && remaining <= 0 ? 1 : total ? Math.min(1, elapsed / total) : 0);
	const status = $derived(
		remaining === null ? '' : remaining <= 0 ? 'over' : remaining <= warnMinutes * 60000 ? 'soon' : ''
	);

	const totalGoals = $derived(students?.reduce((sum, s) => sum + s.goals.length, 0) ?? 0);
	const doneGoals = $derived(students?.reduce((sum, s) => sum + s.goals.filter((g) => g.done).length, 0) ?? 0);
	const finished = $derived(students?.filter((s) => s.goals.length > 0 && s.goals.every((g) => g.done)).length ?? 0);

	/** @param {number} minutes */
	const duration = (minutes) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);

	/** @param {string} hhmm */
	const short = (hhmm) => hhmm.slice(0, 5);

	function toggleLight() {
		if (noise.active) stopNoise();
		else startNoise();
	}

	onMount(() => {
		try {
			menuAutoHide = localStorage.getItem('gearAutoHide') === '1';
		} catch {
			// Kein localStorage verfügbar – Standard bleibt.
		}
		// War die Ampel schon einmal an, ohne erneuten Klick starten (Erlaubnis ist dann bereits erteilt).
		if (isTeacher && noiseEnabled && !noise.active && wantsAutoStart()) startNoise();
		if (!isTeacher && noiseEnabled) return watchRemoteNoise();
	});
</script>

<header class="band">
	<button
		class="menu-btn"
		class:open={menuOpen}
		class:autohide={menuAutoHide}
		aria-label="Menü"
		aria-expanded={menuOpen}
		title="Menü"
		onclick={() => (menuOpen = !menuOpen)}
	>
		<Icon name="menu" size={22} />
	</button>
	<span class="divider" aria-hidden="true"></span>

	{#if isAdmin}
		<a href="/" class="brand" aria-label="classRoom – zur Startseite">
			<img src={logo} alt="" width="32" height="32" />
			<span class="wordmark">class<span class="r">R</span>oom</span>
		</a>
	{:else}
		{#if settings.returnTime}
			<div class="time {status}">
				<div class="meta">
					<span>{settings.roomName}{#if settings.startTime}{` · Beginn ${short(settings.startTime)}`}{/if}</span>
					<span>Rückkehr {short(settings.returnTime)}</span>
				</div>
				<div
					class="track"
					role="img"
					aria-label={remaining === null ? 'Zeit' : `${duration(Math.max(0, Math.ceil(remaining / 60000)))} bis zur Rückkehr`}
				>
					<div class="fill" style:width="{progress * 100}%">
						<!-- Text im gefüllten Teil nur, wenn er dort Platz hat und nicht mit „noch …“ kollidiert -->
						{#if start && now && progress >= 0.3 && progress <= 0.82}
							<span>{duration(Math.floor(elapsed / 60000))} vorbei</span>
						{/if}
					</div>
					{#if remaining !== null}
						<span class="left">{remaining <= 0 ? 'Zeit ist um' : `noch ${duration(Math.ceil(remaining / 60000))}`}</span>
					{/if}
				</div>
			</div>
		{:else}
			<div class="time placeholder">{settings.roomName}</div>
		{/if}

		{#if students}
			<div class="class-stats">
				<span class="label">Klasse</span>
				<span class="big"><strong>{doneGoals}/{totalGoals}</strong> Ziele</span>
				<span class="small">{finished} von {students.length} fertig</span>
			</div>
		{/if}

		<span class="divider" aria-hidden="true"></span>

		<div class="clock">
			<span class="hhmm">{now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : '--:--'}</span>
			<span class="date">
				{now ? `${WEEKDAYS[now.getDay()]}, ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}` : ''}
			</span>
		</div>

		{#if showLight}
			{@const label = noise.active ? `Lautstärke-Ampel: ${LABELS[noise.status]}` : 'Lautstärke-Ampel aus'}
			{#if isTeacher}
				<button
					class="light"
					class:inactive={!noise.active}
					onclick={toggleLight}
					aria-label="{label} – klicken zum {noise.active ? 'Stoppen' : 'Starten'}"
					title={noise.active ? 'Ampel stoppen' : 'Ampel starten (Mikrofon)'}
				>
					{#each LAMPS as color (color)}
						<span class="lamp {color}" class:on={noise.active && noise.status === color}></span>
					{/each}
				</button>
			{:else}
				<div class="light" role="img" aria-label={label}>
					{#each LAMPS as color (color)}
						<span class="lamp {color}" class:on={noise.active && noise.status === color}></span>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</header>
{#if isTeacher && noise.error}<p class="noise-error">{noise.error}</p>{/if}

<Menu bind:open={menuOpen} bind:autoHide={menuAutoHide} {settings} {user} noiseSettings={isTeacher ? noiseSettings : null} />

<style>
	.band {
		display: flex;
		align-items: center;
		gap: 24px;
		margin: 24px var(--gutter) 18px;
		padding: 16px 22px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.menu-btn {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: var(--track);
		color: var(--text);
		transition:
			opacity 0.25s,
			background 0.2s,
			color 0.2s;
	}

	.menu-btn:hover,
	.menu-btn.open {
		background: var(--accent-soft);
		color: var(--accent);
	}

	/* Ausgeblendet, bis man mit der Maus darüberfährt oder es per Tastatur fokussiert. */
	.menu-btn.autohide:not(:hover):not(:focus-visible):not(.open) {
		opacity: 0;
	}

	/* Auf Touch-Geräten gibt es kein Darüberfahren – Knopf dort immer zeigen. */
	@media (hover: none) {
		.menu-btn.autohide:not(.open) {
			opacity: 1;
		}
	}

	.divider {
		flex-shrink: 0;
		align-self: stretch;
		width: 1px;
		background: var(--border);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		text-decoration: none;
	}

	.brand img {
		border-radius: 8px;
	}

	.wordmark {
		font-size: 1.3rem;
		font-weight: 800;
	}

	/* Wie im Banner: das „R“ in Orange. */
	.wordmark .r {
		color: #f08a3c;
	}

	.time {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: var(--muted);
		font-size: 13px;
	}

	.meta span {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.track {
		position: relative;
		height: 30px;
		overflow: hidden;
		border-radius: 8px;
		background: var(--track);
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 12px;
		border-radius: 8px;
		background: var(--lesson-accent);
		color: #0d1424;
		white-space: nowrap;
		transition: width 1s linear;
	}

	.soon .fill {
		background: var(--warn);
	}

	.over .fill {
		background: var(--danger);
	}

	.left {
		position: absolute;
		top: 50%;
		right: 12px;
		transform: translateY(-50%);
		white-space: nowrap;
	}

	.soon .left {
		color: var(--warn);
	}

	.over .left {
		color: #fff;
	}

	.placeholder {
		color: var(--muted);
		font-size: 15px;
	}

	.class-stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.15;
		white-space: nowrap;
	}

	.label {
		color: var(--muted);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.big {
		color: var(--muted);
		font-size: 17px;
	}

	.big strong {
		color: var(--text);
		font-size: 28px;
		font-variant-numeric: tabular-nums;
	}

	.small {
		color: var(--muted);
		font-size: 13px;
	}

	.clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
		white-space: nowrap;
	}

	.hhmm {
		font-size: 44px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}

	.date {
		color: var(--muted);
		font-size: 13px;
	}

	/* Kleine senkrechte Ampel; Gehäuse in beiden Themes dunkel. */
	.light {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 7px;
		border: 0;
		border-radius: 999px;
		background: #1b2029;
		box-shadow: inset 0 1px 4px rgb(0 0 0 / 50%);
	}

	button.light {
		cursor: pointer;
	}

	.lamp {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		transition:
			background 0.25s,
			box-shadow 0.25s;
	}

	.lamp.red {
		background: #4a1c1c;
	}

	.lamp.yellow {
		background: #4a3c14;
	}

	.lamp.green {
		background: #173a26;
	}

	.lamp.red.on {
		background: #ff3b3b;
		box-shadow: 0 0 10px 2px rgb(255 59 59 / 60%);
	}

	.lamp.yellow.on {
		background: #ffc531;
		box-shadow: 0 0 10px 2px rgb(255 197 49 / 55%);
	}

	.lamp.green.on {
		background: #2fdc76;
		box-shadow: 0 0 10px 2px rgb(47 220 118 / 50%);
	}

	.inactive .lamp {
		opacity: 0.5;
	}

	.noise-error {
		margin: -10px var(--gutter) 14px;
		color: var(--danger);
		font-size: 13px;
		text-align: right;
	}

	/* Schmale Bildschirme: oben Menü, Klasse, Uhr und Ampel – darunter der Zeitbalken. */
	@media (max-width: 760px) {
		.band {
			flex-wrap: wrap;
			gap: 12px 14px;
			margin-top: 12px;
			margin-bottom: 14px;
			padding: 12px 14px;
		}

		.divider {
			display: none;
		}

		.time {
			order: 5;
			flex-basis: 100%;
		}

		.class-stats {
			align-items: flex-start;
		}

		.clock {
			margin-left: auto;
		}

		.hhmm {
			font-size: 26px;
		}

		.date {
			font-size: 12px;
		}

		.big {
			font-size: 15px;
		}

		.big strong {
			font-size: 22px;
		}
	}
</style>
