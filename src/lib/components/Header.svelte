<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { clock } from '#lib/clock.svelte.js';
	import { noise, startNoise, stopNoise, wantsAutoStart, watchRemoteNoise } from '#lib/noise.svelte.js';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { showError } from '#lib/dialog.svelte.js';
	import { formatClock, lessonEnded, lessonSpan, minutesBetween, pad } from '#lib/time.js';
	import { nextSlot } from '#lib/schedule.js';
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
	const GOAL_PAGES = ['/stundenziele', '/selbstlernen'];

	const isTeacher = $derived(user.role === 'teacher');
	const path = $derived(page.url.pathname);
	const isAdmin = $derived(path === '/verwaltung' || path.startsWith('/verwaltung/'));
	// Klasse der Stunde: farbiger Punkt + Name
	/** @type {{ id: number, name: string, color: string } | null} */
	const klass = $derived(page.data.activeClass ?? null);
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
	// 15 min nach dem Ende ist die Stunde von selbst vorbei – dann wieder „Stunde starten“.
	const ended = $derived(!!now && lessonEnded(span, now));
	const elapsed = $derived(now && start ? Math.max(0, now.getTime() - start.getTime()) : 0);
	const remaining = $derived(now && end ? end.getTime() - now.getTime() : null);
	const total = $derived(start && end && end > start ? end.getTime() - start.getTime() : null);
	const progress = $derived(remaining !== null && remaining <= 0 ? 1 : total ? Math.min(1, elapsed / total) : 0);
	// Vier Phasen: arbeiten → aufräumen (WARN_MINUTES) → losgehen (GO_MINUTES) → Zeit um.
	const status = $derived(
		remaining === null || ended
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

	// „Stunde starten“: Beginn = jetzt, Ende = jetzt + Dauer der nächsten geplanten Stunde (Wochenplan)
	// bzw. der ersten Dauer aus LESSON_DURATIONS.
	const durations = $derived(/** @type {number[]} */ (page.data.lessonDurations ?? [45, 90]));
	const plan = $derived(nextSlot(page.data.schedule ?? [], now ?? new Date()));
	const idleMinutes = $derived(plan ? minutesBetween(plan.start, plan.end) : durations[0]);
	let starting = $state(false);
	const idleEnd = $derived.by(() => {
		const back = new Date((now ?? new Date()).getTime() + idleMinutes * 60000);
		return `${pad(back.getHours())}:${pad(back.getMinutes())}`;
	});

	/** @param {number} minutes @param {import('#lib/schedule.js').Slot | null} [slot] mit Raum aus dem Wochenplan */
	async function startLesson(minutes, slot = null) {
		starting = true;
		try {
			const begin = new Date();
			const back = new Date(begin.getTime() + minutes * 60000);
			await api('/api/settings', 'PUT', {
				roomName: slot?.room || settings.roomName,
				...(slot && { roomChange: slot.room !== '' }),
				startTime: formatClock(begin),
				returnTime: formatClock(back)
			});
			await invalidateAll();
		} catch (err) {
			showError(err);
		} finally {
			starting = false;
		}
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

<!-- Verwaltung zeigt keinen Zeitbalken – dann auch nicht rot/orange leuchten. -->
<header class="band" class:go={status === 'go' && !isAdmin} class:over={status === 'over' && !isAdmin}>
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
		<span class="crumb">/ Verwaltung</span>
	{:else}
		{#if settings.returnTime && !ended}
			<div class="time {status}" class:inside={leftInside}>
				<div class="meta">
					<span>
						{#if klass}<span class="klass"><span class="kdot" style:background={klass.color}></span>{klass.name}</span>{/if}
						{#if settings.startTime}Beginn {short(settings.startTime)}{/if}
					</span>
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
			<!-- Keine Stunde: Balken mit „Stunde starten“ (Standarddauer ab jetzt), Anpassen öffnet das Menü. -->
			<div class="time">
				<div class="idle-bar">
					{#if isTeacher}
						<div class="idle-main">
							<button class="primary" disabled={starting} onclick={() => startLesson(idleMinutes, plan)}>▶ Stunde starten</button>
							<span class="idle-info">
								{idleMinutes} min<span class="opt-end">· {plan ? `Plan ${plan.start}–${plan.end}` : `bis ${idleEnd}`}</span>
								{#if plan ? plan.room : settings.roomChange}
									<span class="opt-room">· <Icon name="door" size={14} /> {plan ? plan.room : settings.roomName}</span>
								{/if}
								{#if klass}<span class="klass" title="Klasse {klass.name}">· <span class="kdot" style:background={klass.color}></span><span class="kname">{klass.name}</span></span>{/if}
							</span>
						</div>
						<button class="adjust" onclick={() => (menuOpen = true)}>Anpassen…</button>
					{:else}
						<span class="idle-info">
							Stunde noch nicht gestartet{#if klass}<span class="klass" title="Klasse {klass.name}">· <span class="kdot" style:background={klass.color}></span><span class="kname">{klass.name}</span></span>{/if}
						</span>
					{/if}
				</div>
			</div>
		{/if}

		{#if students}
			<div class="class-stats">
				<span class="label">{#if klass}<span class="kdot" style:background={klass.color}></span> <span class="kname">{klass.name}</span>{:else}Klasse{/if}</span>
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

	.crumb {
		margin-left: -8px;
		color: var(--muted);
		font-size: 1.05rem;
	}

	/* Klasse der Stunde: farbiger Punkt + Name */
	.klass {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: 4px;
		font-weight: 700;
		white-space: nowrap;
	}

	.meta .klass {
		margin: 0 8px 0 0;
	}

	/* Lange Namen im Startbalken kürzen, damit „Anpassen…“ Platz behält. */
	.kname {
		max-width: 9em;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.adjust {
		white-space: nowrap;
	}

	.kdot {
		display: inline-block;
		vertical-align: 0;
		width: 9px;
		height: 9px;
		border-radius: 50%;
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

	/* Keine Stunde: Balken wie der Zeitbalken, Start-Knopf und Infos in der Mitte, „Anpassen…“ rechts. */
	.idle-bar {
		display: grid;
		/* Mitte zentriert; rechts mindestens so breit wie „Anpassen…“. */
		grid-template-columns: minmax(0, 1fr) auto minmax(max-content, 1fr);
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 5px 12px;
		border-radius: 10px;
		background: var(--track);
	}

	.idle-bar > :first-child {
		grid-column: 2;
	}

	.opt-room {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	/* Wenig Platz (z. B. neben der Klassen-Statistik): zuerst den Raum, dann „bis …“ weglassen – die Klasse bleibt. */
	.time:has(.idle-bar) {
		container-type: inline-size;
	}

	/* Auf dem Smartphone darf der Balken umbrechen – dort nichts weglassen. */
	@media (min-width: 761px) {
		@container (max-width: 640px) {
			.opt-room {
				display: none;
			}
		}

		@container (max-width: 520px) {
			.opt-end {
				display: none;
			}

			.idle-info .klass {
				display: none;
			}
		}
	}

	.idle-main {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.idle-main .primary {
		padding: 6px 14px;
		font-size: 14px;
		font-weight: 700;
		white-space: nowrap;
	}

	.idle-info {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--text);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.adjust {
		justify-self: end;
		padding: 2px 4px;
		border: 0;
		background: transparent;
		color: var(--accent);
		font-size: 13px;
		font-weight: 500;
	}

	.adjust:hover {
		text-decoration: underline;
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

		/* Schmal: Start links, „Anpassen…“ rechts, Infos darunter */
		.idle-bar {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			gap: 8px;
			padding: 8px 10px;
		}

		.idle-main {
			flex-wrap: wrap;
			gap: 6px 12px;
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
