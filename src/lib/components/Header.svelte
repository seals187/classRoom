<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { clock } from '#lib/clock.svelte.js';
	import { noise, startNoise, stopNoise, wantsAutoStart, watchRemoteNoise } from '#lib/noise.svelte.js';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { showError } from '#lib/dialog.svelte.js';
	import { formatClock, lessonSpan, pad } from '#lib/time.js';
	import logo from '#lib/assets/logo.svg';
	import Icon from './Icon.svelte';
	import Menu from './Menu.svelte';

	/**
	 * Kopfband für alle Seiten: Menü-Knopf, Zeitbalken, (auf den Ziel-Seiten) Klassen-Fortschritt,
	 * Digitaluhr und kleine Ampel. Auf den Verwaltungsseiten nur Menü-Knopf und Logo.
	 * @type {{
	 *   user: import('#lib/server/auth.js').User,
	 *   settings: { roomName: string, roomChange: boolean, startTime: string, returnTime: string },
	 *   warnMinutes: number,
	 *   goMinutes?: number,
	 *   noise: import('#lib/server/db.js').NoiseSettings | { enabled: boolean } | null
	 * }}
	 */
	let { user, settings, warnMinutes, goMinutes = 3, noise: noiseSettings } = $props();

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

	const now = $derived(clock.now);
	// Auch über Mitternacht richtig (z. B. 23:30 bis 00:15).
	const span = $derived(now ? lessonSpan(settings.startTime, settings.returnTime, now) : { start: null, end: null });
	const start = $derived(span.start);
	const end = $derived(span.end);
	const elapsed = $derived(now && start ? Math.max(0, now.getTime() - start.getTime()) : 0);
	const remaining = $derived(now && end ? end.getTime() - now.getTime() : null);
	const total = $derived(start && end && end > start ? end.getTime() - start.getTime() : null);
	const progress = $derived(remaining !== null && remaining <= 0 ? 1 : total ? Math.min(1, elapsed / total) : 0);
	// Vier Phasen: arbeiten → aufräumen (WARN_MINUTES) → losgehen (GO_MINUTES) → Zeit um.
	const status = $derived(
		remaining === null
			? ''
			: remaining <= 0
				? 'over'
				: remaining <= goMinutes * 60000
					? 'go'
					: remaining <= warnMinutes * 60000
						? 'soon'
						: ''
	);
	// Losgehen und Zeit um: groß in der Mitte, mit Tür, wenn es in einen anderen Raum geht.
	const callout = $derived(status === 'go' || status === 'over');
	const phase = $derived(
		status === 'over'
			? settings.roomChange
				? `Sofort zurück in ${settings.roomName}!`
				: 'Zeit um – die Stunde ist zu Ende'
			: status === 'go'
				? settings.roomChange
					? `Jetzt zurück in ${settings.roomName}`
					: 'Gleich Schluss – zusammenpacken'
				: status === 'soon'
					? 'Aufräumen'
					: now && start && now < start
						? `Beginnt um ${short(settings.startTime)}`
						: 'Arbeitsphase'
	);
	const overMinutes = $derived(remaining !== null && remaining < 0 ? Math.floor(-remaining / 60000) : 0);
	// Restzeit groß: „noch 40 min“ bzw. „noch 1:20 h“.
	const bigRemaining = $derived.by(() => {
		const m = remaining !== null ? Math.max(0, Math.ceil(remaining / 60000)) : 0;
		return m < 60 ? { value: String(m), unit: 'min' } : { value: `${Math.floor(m / 60)}:${pad(m % 60)}`, unit: 'h' };
	});
	// Rest des Balkens schmaler als ~ein Achtel → „noch …“ steht links vom Jetzt-Strich im farbigen Teil.
	const leftInside = $derived(remaining !== null && remaining > 0 && progress > 0.86);

	// Viertelstunden-Striche ab Beginn (bei langen Stunden halbstündlich), mit Uhrzeit darunter.
	const ticks = $derived.by(() => {
		if (!start || !end || !total) return [];
		const step = (total > 4 * 3_600_000 ? 60 : total > 2 * 3_600_000 ? 30 : 15) * 60000;
		const list = [];
		for (let t = start.getTime() + step; t < end.getTime() - 60000; t += step) {
			const d = new Date(t);
			list.push({ at: (t - start.getTime()) / total, label: `${pad(d.getHours())}:${pad(d.getMinutes())}` });
		}
		return list;
	});

	const totalGoals = $derived(students?.reduce((sum, s) => sum + s.goals.length, 0) ?? 0);
	const doneGoals = $derived(students?.reduce((sum, s) => sum + s.goals.filter((g) => g.done).length, 0) ?? 0);
	const finished = $derived(students?.filter((s) => s.goals.length > 0 && s.goals.every((g) => g.done)).length ?? 0);

	/** @param {number} minutes */
	const duration = (minutes) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);

	/** @param {string} hhmm */
	const short = (hhmm) => hhmm.slice(0, 5);

	// „Jetzt starten“: Beginn = jetzt, Ende = jetzt + Dauer (Dauern aus LESSON_DURATIONS).
	const durations = $derived(/** @type {number[]} */ (page.data.lessonDurations ?? [45, 90]));
	let starting = $state(false);
	let customOpen = $state(false);
	let customMinutes = $state(60);

	/** @param {number} minutes */
	async function startLesson(minutes) {
		starting = true;
		try {
			const begin = new Date();
			const back = new Date(begin.getTime() + minutes * 60000);
			await api('/api/settings', 'PUT', {
				roomName: settings.roomName,
				startTime: formatClock(begin),
				returnTime: `${pad(back.getHours())}:${pad(back.getMinutes())}`
			});
			customOpen = false;
			await invalidateAll();
		} catch (err) {
			showError(err);
		} finally {
			starting = false;
		}
	}

	/** @param {HTMLInputElement} node */
	const focusOnMount = (node) => node.focus();

	/** @param {SubmitEvent} e */
	function startCustom(e) {
		e.preventDefault();
		const minutes = Math.round(Number(customMinutes));
		if (minutes >= 1 && minutes <= 600) startLesson(minutes);
	}

	function toggleLight() {
		if (noise.active) stopNoise();
		else startNoise();
	}

	onMount(() => {
		// War die Ampel schon einmal an, ohne erneuten Klick starten (Erlaubnis ist dann bereits erteilt).
		if (isTeacher && noiseEnabled && !noise.active && wantsAutoStart()) startNoise();
		if (!isTeacher && noiseEnabled) return watchRemoteNoise();
	});
</script>

<header class="band" class:go={status === 'go'} class:over={status === 'over'}>
	<button
		class="menu-btn"
		class:open={menuOpen}
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
			<div class="time {status}" class:inside={leftInside}>
				<div class="meta">
					<span>{#if settings.startTime}Beginn {short(settings.startTime)}{/if}</span>
					<!-- Phase klein in der Mitte, das Ziel („Zurück in … um …“) immer rechts -->
					<strong class="phase" class:callout>
						{#if status === 'soon'}<Icon name="broom" size={14} />{:else if callout && settings.roomChange}<Icon name="door" size={17} />{/if}
						{phase}
					</strong>
					<span class="end">
						{#if settings.roomChange}
							<!-- Losgehen/Zeit um: der Raum steht schon groß in der Mitte, rechts nur noch die Uhrzeit -->
							<Icon name="door" size={13} />
							{#if callout}{short(settings.returnTime)}{:else}Zurück in <b>{settings.roomName}</b> um {short(settings.returnTime)}{/if}
						{:else}
							Ende {short(settings.returnTime)}
						{/if}
					</span>
				</div>
				<div
					class="track"
					role="img"
					aria-label={remaining === null ? 'Zeit' : `${phase}: ${remaining <= 0 ? 'Zeit um' : `noch ${duration(Math.ceil(remaining / 60000))}`}`}
				>
					<div class="fill" style:width="{progress * 100}%"></div>
					{#each ticks as tick (tick.at)}
						<span class="tick" style:left="{tick.at * 100}%"></span>
					{/each}
					{#if start && now && progress >= 0.14}
						<span class="passed">{duration(Math.floor(elapsed / 60000))} vorbei</span>
					{/if}
					{#if remaining !== null && remaining > 0 && progress > 0}
						<span class="now" style:left="{progress * 100}%"></span>
					{/if}
					{#if remaining !== null}
						<!-- Restzeit am Ende des Balkens – wird der Rest zu schmal, wandert sie mit dem Jetzt-Strich. -->
						<span class="left" style:right={leftInside ? `calc(${(1 - progress) * 100}% + 12px)` : null}>
							{#if remaining <= 0}
								Zeit um{#if overMinutes > 0}{` · +${overMinutes} min`}{/if}
							{:else}
								noch <b>{bigRemaining.value}</b> {bigRemaining.unit}
							{/if}
						</span>
					{/if}
				</div>
				{#if ticks.length > 0}
					<div class="tick-labels" aria-hidden="true">
						{#each ticks as tick (tick.at)}
							<span style:left="{tick.at * 100}%">{tick.label}</span>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="time placeholder">
				<span class="not-started">Stunde noch nicht gestartet</span>
				{#if isTeacher}
					<div class="start">
						{#each durations as minutes, i (minutes)}
							<button class:primary={i === 0} disabled={starting} onclick={() => startLesson(minutes)}>
								{i === 0 ? `▶ Jetzt starten · ${minutes} min` : `${minutes} min`}
							</button>
						{/each}
						{#if customOpen}
							<form class="custom" onsubmit={startCustom}>
								<input
									type="number"
									min="1"
									max="600"
									bind:value={customMinutes}
									aria-label="Dauer in Minuten"
									use:focusOnMount
									onkeydown={(e) => e.key === 'Escape' && (customOpen = false)}
								/>
								<span>min</span>
								<button type="submit" class="primary" disabled={starting}>Start</button>
							</form>
						{:else}
							<button onclick={() => (customOpen = true)}>Andere…</button>
						{/if}
					</div>
				{/if}
			</div>
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

<Menu bind:open={menuOpen} {settings} {user} noiseSettings={isTeacher ? noiseSettings : null} />

<style>
	.band {
		display: flex;
		align-items: center;
		gap: 24px;
		margin: 24px var(--gutter) 18px;
		padding: 12px 22px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	/* Losgehen: kräftiger oranger Rand, pulsiert gut sichtbar (Schein + Tönung). Zeit um: roter Rand. */
	.band.go {
		border-color: var(--go);
		animation: go-pulse 1.4s ease-in-out infinite;
	}

	.band.over {
		border-color: var(--danger);
		box-shadow:
			0 0 0 1px var(--danger),
			0 0 22px color-mix(in srgb, var(--danger) 30%, transparent);
	}

	@keyframes go-pulse {
		0%,
		100% {
			background: var(--surface);
			box-shadow:
				0 0 0 2px var(--go),
				0 0 6px color-mix(in srgb, var(--go) 25%, transparent);
		}

		50% {
			background: color-mix(in srgb, var(--go) 14%, var(--surface));
			box-shadow:
				0 0 0 3px var(--go),
				0 0 40px 6px color-mix(in srgb, var(--go) 70%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.band.go {
			animation: none;
			box-shadow: 0 0 0 1px var(--go);
		}
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
		gap: 6px;
		/* Phasenfarbe: Arbeiten blau, bald zurück orange, Zeit um rot. */
		--phase: var(--lesson-accent);
	}

	.time.soon {
		--phase: var(--warn);
	}

	.time.go {
		--phase: var(--go);
	}

	.time.over {
		--phase: var(--danger);
	}

	.meta {
		display: grid;
		/* Beginn links, Phase mittig im freien Platz, Ziel rechts immer ganz */
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		color: var(--muted);
		font-size: 13px;
	}

	.meta span {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.meta .end {
		text-align: right;
	}

	.phase {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		color: var(--text);
		font-size: 13px;
		white-space: nowrap;
	}

	.soon .phase,
	.go .phase,
	.over .phase {
		color: var(--phase);
	}

	/* Losgehen und Zeit um: groß in der Mitte */
	.phase.callout {
		font-size: 16px;
		font-weight: 800;
		line-height: 1.2;
	}

	.phase :global(svg) {
		margin-right: 4px;
		vertical-align: -2px;
	}

	.tick-labels {
		position: relative;
		height: 14px;
		color: var(--muted);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.tick-labels span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		line-height: 14px;
	}

	.meta .end b {
		color: var(--text);
	}

	.meta :global(svg) {
		vertical-align: -2px;
	}

	.track {
		position: relative;
		height: 36px;
		overflow: hidden;
		border-radius: 9px;
		background: var(--track);
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.over .track {
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--danger) 45%, transparent),
			0 0 18px color-mix(in srgb, var(--danger) 35%, transparent);
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 9px 0 0 9px;
		background: var(--phase);
		transition:
			width 1s linear,
			background 0.4s;
	}

	.over .fill {
		border-radius: 9px;
	}

	/* Viertelstunden-Striche über den ganzen Balken. */
	.tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--tick);
	}

	/* Weißer „Jetzt“-Strich am Ende des farbigen Teils. */
	.now {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -2px;
		border-radius: 2px;
		background: var(--text);
		box-shadow: 0 0 6px rgb(0 0 0 / 25%);
		transition: left 1s linear;
	}

	.passed,
	.left {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
	}

	.passed {
		left: 12px;
		color: var(--on-fill);
	}

	.left {
		right: 12px;
		color: var(--text);
		font-weight: 500;
		transition: right 1s linear;
	}

	.left b {
		font-size: 22px;
		font-weight: 800;
	}

	/* Im farbigen Teil (wandert mit) bzw. bei „Zeit um“: dunkle bzw. weiße Schrift. */
	.inside .left {
		color: var(--on-fill);
	}

	.over .passed {
		color: rgb(255 255 255 / 85%);
	}

	.over .left {
		color: #fff;
		font-size: 16px;
		font-weight: 800;
	}

	.placeholder {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		color: var(--muted);
		font-size: 15px;
	}

	.start {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.start button {
		padding: 7px 14px;
		font-size: 14px;
		color: var(--muted);
	}

	.start button.primary {
		color: var(--on-accent);
		font-weight: 700;
	}

	.custom {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.custom input {
		width: 70px;
		padding: 6px 8px;
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
		background: var(--lamp-bg);
		box-shadow: var(--lamp-shadow);
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
		background: var(--lamp-red-off);
	}

	.lamp.yellow {
		background: var(--lamp-yellow-off);
	}

	.lamp.green {
		background: var(--lamp-green-off);
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
		opacity: var(--lamp-inactive);
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
