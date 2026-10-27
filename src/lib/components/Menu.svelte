<script>
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.js';
	import { formatClock, lessonSpan, minutesBetween, OVERTIME_MS } from '#lib/time.js';
	import { DAYS, DAY_NAMES, nextSlot, slotsOf, weekday } from '#lib/schedule.js';
	import { clock } from '#lib/clock.svelte.js';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { NAV } from '#lib/nav.js';
	import logo from '#lib/assets/logo.svg';
	import { noise, setNoiseConfig, startNoise, stopNoise } from '#lib/noise.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import { daysLabel, formatExpiry, reach, shareUrl, shortUrl } from '#lib/share.js';
	import { ask } from '#lib/dialog.svelte.js';

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
	// Ohne Admin-Recht verwaltet man unter „Lehrer“ nur das eigene Konto.
	const links = $derived(
		(isTeacher ? NAV : NAV.filter((item) => !item.teacherOnly)).map((item) =>
			item.href === '/verwaltung?tab=lehrer' && !user.isAdmin ? { ...item, label: 'Mein Konto', count: undefined } : item
		)
	);
	// In Gruppen mit Überschrift (Unterricht, Verwaltung) – leere Gruppen entfallen.
	const groups = $derived(
		[...new Set(links.map((item) => item.group))].map((name) => ({ name, items: links.filter((item) => item.group === name) }))
	);
	/** @type {{ students: number, teachers: number, classes: number } | null} */
	const counts = $derived(page.data.counts ?? null);
	/** Menüpunkt der aktuellen Seite (Verwaltung: Reiter in der Adresse, offene Klasse gehört zu „Klassen“). @param {string} href */
	const isActive = (href) =>
		page.url.pathname + page.url.search === href || (href === '/verwaltung' && page.url.pathname.startsWith('/verwaltung/'));

	// Unterseiten im Menü: Wochenplan, Ampel, Hintergrund & Darstellung.
	/** @type {'main' | 'plan' | 'noise' | 'display' | 'share'} */
	let view = $state('main');
	const TITLES = $derived({
		plan: 'Wochenplan',
		share: 'Geteilte Aufträge',
		noise: 'Ampel',
		display: page.data.background?.canChoose ? 'Hintergrund & Darstellung' : 'Darstellung'
	});

	/** @param {Date} d */
	const hhmm = (d) => formatClock(d).slice(0, 5);

	/** „16:51“ + 45 → „17:36“ @param {string} time @param {number} minutes */
	function addMinutes(time, minutes) {
		const [h, m] = time.split(':').map(Number);
		const d = new Date();
		d.setHours(h, m + minutes, 0, 0);
		return hhmm(d);
	}

	// --- Stunden-Karte ---

	// Läuft gerade eine Stunde (gespeicherte Zeiten, Beginn vorbei, Ende höchstens 15 min her)?
	const span = $derived(lessonSpan(settings.startTime, settings.returnTime, clock.now ?? new Date()));
	const running = $derived.by(() => {
		const now = clock.now;
		const { start, end } = span;
		return !!now && !!start && !!end && start <= now && now.getTime() < end.getTime() + OVERTIME_MS;
	});
	const durations = $derived(/** @type {number[]} */ (page.data.lessonDurations ?? [45, 90]));
	// Kurze Dauern plus die aus LESSON_DURATIONS (z. B. 15 · 30 · 45 · 90).
	const chips = $derived([...new Set([15, 30, ...durations])].sort((a, b) => a - b));
	const EXTEND = [5, 10, 15];
	const WARN_CHOICES = [0, 2, 3, 5, 10, 15];

	/** @type {'zeit' | 'raum' | 'aufraeumen'} */
	let tab = $state('zeit');
	let chosen = $state(45);
	// Eigene Zeiten; leer = ab jetzt bzw. Beginn + gewählte Dauer.
	let begin = $state('');
	let end = $state('');
	// Gewählter Raum; leer = kein Raumwechsel
	let roomChoice = $state('');
	let warn = $state(5);
	let addingRoom = $state(false);
	let newRoom = $state('');
	let saving = $state(false);
	let message = $state('');

	const rooms = $derived(/** @type {string[]} */ (page.data.rooms ?? []));
	// Klasse der Stunde – die zuletzt genutzte ist vorausgewählt.
	const classes = $derived(/** @type {{ id: number, name: string, color: string }[]} */ (page.data.classes ?? []));
	let classChoice = $state(0);
	const chosenClass = $derived(classes.find((c) => c.id === classChoice) ?? null);
	const from = $derived(begin || hhmm(clock.now ?? new Date()));
	const to = $derived(end || addMinutes(from, chosen));
	// Laufende Stunde: Minuten bis zum (evtl. verlängerten) Ende, negativ = überzogen.
	const left = $derived.by(() => {
		const now = clock.now ?? new Date();
		const { end: stop } = lessonSpan(from, to, now);
		return stop ? Math.ceil((stop.getTime() - now.getTime()) / 60000) : 0;
	});

	// Wochenplan: heutige Stunden zum Auswählen, die nächste ist vorausgewählt.
	const schedule = $derived(/** @type {import('#lib/schedule.js').Slot[]} */ (page.data.schedule ?? []));
	const today = $derived(slotsOf(schedule, weekday(clock.now ?? new Date())));

	/** @param {import('#lib/schedule.js').Slot} slot */
	function pick(slot) {
		begin = slot.start;
		end = slot.end;
		roomChoice = slot.room;
	}
	const warnChoices = $derived([...new Set([...WARN_CHOICES, warn])].sort((a, b) => a - b));

	// Geschlossen → beim nächsten Öffnen wieder Hauptseite und Reiter „Zeit“.
	$effect(() => {
		if (open) return;
		view = 'main';
		tab = 'zeit';
		message = '';
		addingRoom = false;
	});

	// Gespeicherte Werte als Text: ändert sich nur, wenn wirklich etwas anders gespeichert ist –
	// nicht bei jedem Neuladen der Seite (alle 10 s), sonst springen Eingaben im Menü zurück.
	const stored = $derived(
		JSON.stringify([settings, running, durations[0], page.data.warnMinutes, noiseSettings, schedule, page.data.activeClass])
	);

	// Beim Öffnen und nach dem Speichern die gespeicherten Werte übernehmen.
	$effect(() => {
		if (!open) return;
		void stored;
		untrack(() => {
			chosen = durations[0];
			begin = running ? settings.startTime.slice(0, 5) : '';
			end = running ? settings.returnTime.slice(0, 5) : '';
			roomChoice = settings.roomChange ? settings.roomName : '';
			classChoice = page.data.activeClass?.id ?? 0;
			warn = page.data.warnMinutes ?? 5;
			const next = running ? null : nextSlot(schedule, clock.now ?? new Date());
			if (next) pick(next);
			plan = schedule.map((s) => ({ ...s }));
			if (noiseSettings) noiseForm = { ...noiseSettings };
		});
	});

	/** @param {number} minutes */
	function choose(minutes) {
		chosen = minutes;
		end = '';
	}

	/** Laufende Stunde verlängern (wirkt mit „Stunde aktualisieren“). @param {number} minutes */
	function extend(minutes) {
		end = addMinutes(to, minutes);
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

	// Starten: die Stunde läuft ab dem Klick so lange wie Beginn bis Ende (14:00–14:45 → noch 45 min).
	// Aktualisieren: gespeicherter Beginn bleibt, Ende wie eingegeben bzw. verlängert.
	function startLesson() {
		const wasRunning = running;
		const now = new Date();
		const times = wasRunning
			? { startTime: begin || hhmm(now), returnTime: to }
			: { startTime: formatClock(now), returnTime: formatClock(new Date(now.getTime() + minutesBetween(from, to) * 60000)) };
		run(
			() =>
				api('/api/settings', 'PUT', {
					roomName: roomChoice || settings.roomName,
					roomChange: roomChoice !== '',
					...times,
					warnMinutes: warn,
					...(classChoice && { classId: classChoice })
				}),
			wasRunning ? 'Stunde aktualisiert' : 'Stunde gestartet'
		);
	}

	function stopLesson() {
		run(() => api('/api/settings', 'PUT', { ...settings, startTime: '', returnTime: '' }), 'Stunde beendet');
	}

	/** @param {SubmitEvent} e */
	function addRoom(e) {
		e.preventDefault();
		const name = newRoom.trim();
		if (!name) return;
		roomChoice = name;
		newRoom = '';
		addingRoom = false;
		if (!rooms.includes(name)) run(() => api('/api/rooms', 'PUT', { rooms: [...rooms, name] }), 'Raum hinzugefügt');
	}

	/** @param {string} name */
	function removeRoom(name) {
		if (roomChoice === name) roomChoice = '';
		run(() => api('/api/rooms', 'PUT', { rooms: rooms.filter((r) => r !== name) }), 'Raum entfernt');
	}

	// --- Schüler mit mehreren Lehrkräften: wessen Auftrag und Stunde sie sehen ---

	const teachers = $derived(/** @type {{ id: number, username: string }[]} */ (page.data.teachers ?? []));

	/** @param {number} teacherId */
	function chooseTeacher(teacherId) {
		run(() => api('/api/context', 'PUT', { teacherId }), 'Lehrkraft gewechselt');
	}

	// --- Wochenplan ---

	/** Bearbeitete Kopie des Plans; erst „Speichern“ schreibt ihn. @type {import('#lib/schedule.js').Slot[]} */
	let plan = $state([]);
	let planDay = $state(0);
	let planMessage = $state('');
	const planSlots = $derived(plan.filter((s) => s.day === planDay));

	function openPlan() {
		planDay = weekday(clock.now ?? new Date());
		planMessage = '';
		view = 'plan';
	}

	// Neue Stunde schließt an die letzte des Tages an (sonst 08:00), Dauer wie die erste aus LESSON_DURATIONS.
	function addSlot() {
		const last = slotsOf(plan, planDay).at(-1);
		const start = last ? last.end : '08:00';
		plan.push({ day: planDay, start, end: addMinutes(start, durations[0]), room: '' });
	}

	/** @param {import('#lib/schedule.js').Slot} slot */
	function removeSlot(slot) {
		plan.splice(plan.indexOf(slot), 1);
	}

	async function savePlan() {
		planMessage = '';
		try {
			await api('/api/schedule', 'PUT', { schedule: plan });
			await invalidateAll();
			planMessage = 'Gespeichert';
		} catch (err) {
			planMessage = err instanceof Error ? err.message : String(err);
		}
	}

	// --- Ampel ---

	let noiseForm = $state({ enabled: true, sensitivity: 5, yellow: 50, red: 75 });
	let noiseMessage = $state('');

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

	// --- Geteilte Aufträge (QR-Code): eigene bzw. als Admin alle ---

	/** @type {{ publicUrl: string, days: number, count: number } | null} */
	const sharing = $derived(page.data.sharing ?? null);
	const shareReach = $derived(sharing ? reach(sharing.publicUrl || page.url.origin) : '');
	/** @type {import('#lib/server/share.js').ShareEntry[]} */
	let shares = $state([]);
	let shareMessage = $state('');

	async function loadShares() {
		try {
			shares = await api('/api/share', 'GET');
		} catch (err) {
			shareMessage = err instanceof Error ? err.message : String(err);
		}
	}

	function openShares() {
		shareMessage = '';
		view = 'share';
		loadShares();
	}

	/** @param {number} teacher @param {'PUT' | 'DELETE'} method */
	async function changeShare(teacher, method) {
		shareMessage = '';
		if (method === 'DELETE') {
			const ok = await ask({
				title: 'Teilen beenden?',
				message: 'Der Link und QR-Code funktionieren danach nicht mehr.',
				confirmLabel: 'Beenden',
				danger: true
			});
			if (!ok) return;
		}
		try {
			await api('/api/share', method, method === 'PUT' ? { teacher, days: sharing?.days } : { teacher });
			await Promise.all([loadShares(), invalidateAll()]);
		} catch (err) {
			shareMessage = err instanceof Error ? err.message : String(err);
		}
	}

	// Avatar unten: Initialen aus dem Namen („admin-classroom“ → „AC“, „Lea Muster“ → „LM“).
	const accountName = $derived(isTeacher ? user.username : user.displayName);
	const initials = $derived(
		accountName
			.split(/[\s._-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('')
	);
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

		{#if view === 'main'}
			<nav>
				{#each groups as group (group.name)}
					<h3 class="group">{group.name}</h3>
					{#each group.items as link (link.href)}
						<a href={link.href} class:active={isActive(link.href)} onclick={() => (open = false)}>
							<Icon name={link.icon} size={18} />
							{link.label}
							{#if link.count && counts}<span class="count">{counts[link.count]}</span>{/if}
						</a>
					{/each}
				{/each}
			</nav>

			{#if isTeacher}
				<section class="lesson">
					<h3 class="group status" class:live={running}>
						<span class="status-dot" aria-hidden="true"></span>
						{running ? 'Stunde läuft' : 'Keine Stunde aktiv'}
					</h3>

					<div class="card">
						<div class="summary">
							<span class="kicker">{running ? (left >= 0 ? 'Noch' : 'Überzogen') : 'Nächste Stunde'}</span>
							<strong class="big">
								{running ? `${left >= 0 ? '' : '+'}${Math.abs(left)} min` : `${minutesBetween(from, to)} min`}
							</strong>
							<span class="meta">
								{from} – {to} ·
								{#if roomChoice}<Icon name="door" size={14} /> {roomChoice}{:else}nur Ende{/if}
								{#if chosenClass}· <span class="kdot" style:background={chosenClass.color}></span>{chosenClass.name}{/if}
							</span>
						</div>

						{#if classes.length > 1}
							<label class="classes">
								<span class="kdot" style:background={chosenClass?.color ?? 'transparent'}></span>
								Klasse
								<select bind:value={classChoice} aria-label="Klasse der Stunde">
									{#each classes as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
								</select>
							</label>
						{/if}

						<div class="tabs" role="tablist">
							<button role="tab" aria-selected={tab === 'zeit'} class:on={tab === 'zeit'} onclick={() => (tab = 'zeit')}>Zeit</button>
							<button role="tab" aria-selected={tab === 'raum'} class:on={tab === 'raum'} onclick={() => (tab = 'raum')}>Raum</button>
							<button role="tab" aria-selected={tab === 'aufraeumen'} class:on={tab === 'aufraeumen'} onclick={() => (tab = 'aufraeumen')}>
								Aufräumen
							</button>
						</div>

						{#if tab === 'zeit'}
							<div class="panel">
								{#if running}
									<div class="chips" aria-label="Verlängern">
										{#each EXTEND as m (m)}
											<button onclick={() => extend(m)} title="Ende um {m} min nach hinten schieben">+{m}</button>
										{/each}
									</div>
								{:else}
									{#if today.length > 0}
										<div class="slots" aria-label="Heute laut Wochenplan">
											{#each today as slot, i (i)}
												<button class:on={begin === slot.start && end === slot.end} onclick={() => pick(slot)}>
													{slot.start}–{slot.end}{#if slot.room}<small>{slot.room}</small>{/if}
												</button>
											{/each}
										</div>
									{/if}
									<div class="chips" aria-label="Dauer in Minuten">
										{#each chips as m (m)}
											<button class:on={!end && chosen === m} onclick={() => choose(m)}>{m}</button>
										{/each}
									</div>
								{/if}
								<div class="times">
									<label>
										Beginn
										<input type="time" value={from} oninput={(e) => (begin = e.currentTarget.value)} />
									</label>
									<label>
										Ende
										<input type="time" value={to} oninput={(e) => (end = e.currentTarget.value)} />
									</label>
								</div>
								{#if !running}
									<p class="hint">Läuft ab dem Klick {minutesBetween(from, to)} min.</p>
								{/if}
							</div>
						{:else if tab === 'raum'}
							<div class="panel rooms" role="radiogroup" aria-label="Raum nach der Stunde">
								<label class="room">
									<input type="radio" name="room" value="" bind:group={roomChoice} />
									<span>Kein Raumwechsel</span>
									<small>nur Ende</small>
								</label>
								{#each rooms as room (room)}
									<label class="room">
										<input type="radio" name="room" value={room} bind:group={roomChoice} />
										<span>{room}</span>
										{#if room === settings.roomName}<small>zuletzt</small>{/if}
										<button class="remove" title="Raum entfernen" aria-label="{room} entfernen" onclick={() => removeRoom(room)}>
											<Icon name="close" size={12} />
										</button>
									</label>
								{/each}
								{#if addingRoom}
									<form class="add-room" onsubmit={addRoom}>
										<!-- svelte-ignore a11y_autofocus -->
										<input type="text" bind:value={newRoom} maxlength="60" placeholder="z. B. Werkraum" autofocus />
										<button type="submit" class="primary" disabled={!newRoom.trim()}>Hinzufügen</button>
									</form>
								{:else}
									<button class="add-link" onclick={() => (addingRoom = true)}>+ Raum hinzufügen</button>
								{/if}
							</div>
						{:else}
							<div class="panel">
								<p class="hint">Aufräumen beginnt so viele Minuten vor Schluss:</p>
								<div class="chips" aria-label="Minuten vor Schluss">
									{#each warnChoices as m (m)}
										<button class:on={warn === m} onclick={() => (warn = m)}>{m === 0 ? 'Aus' : m}</button>
									{/each}
								</div>
							</div>
						{/if}

						<button class="primary go" onclick={startLesson} disabled={saving}>
							{#if running}Stunde aktualisieren{:else}▶ Stunde starten{/if}
						</button>
						{#if running}
							<button class="text-link" onclick={stopLesson} disabled={saving}>Stunde beenden</button>
						{/if}
						{#if message}<p class="message">{message}</p>{/if}
					</div>
					<button class="row" onclick={openPlan}>
						<Icon name="calendar" size={18} />
						Wochenplan
						<span class="value">{schedule.length ? `${schedule.length} Stunden` : 'leer'}</span>
						<Icon name="chevron" size={16} />
					</button>
				</section>
			{:else if teachers.length > 1}
				<section class="display">
					<h3 class="group">Lehrkraft</h3>
					<div class="rooms" role="radiogroup" aria-label="Lehrkraft">
						{#each teachers as teacher (teacher.id)}
							<label class="room">
								<input
									type="radio"
									name="teacher"
									checked={page.data.owner === teacher.id}
									onchange={() => chooseTeacher(teacher.id)}
								/>
								<span>{teacher.username}</span>
							</label>
						{/each}
					</div>
					{#if message}<p class="message">{message}</p>{/if}
				</section>
			{/if}

			<section class="display">
				<h3 class="group">Anzeige</h3>
				{#if sharing}
					<button class="row" onclick={openShares}>
						<Icon name="qr" size={18} />
						Geteilte Aufträge
						<span class="value">{sharing.count || 'keine'}</span>
						<Icon name="chevron" size={16} />
					</button>
				{/if}
				{#if noiseSettings}
					<button class="row" onclick={() => (view = 'noise')}>
						<Icon name="traffic" size={18} />
						Ampel
						<span class="value">{noiseSettings.enabled ? 'An' : 'Aus'}</span>
						<Icon name="chevron" size={16} />
					</button>
				{/if}
				<button class="row" onclick={() => (view = 'display')}>
					<Icon name="image" size={18} />
					{TITLES.display}
					<span class="value"></span>
					<Icon name="chevron" size={16} />
				</button>
			</section>
		{:else}
			<button class="back" onclick={() => (view = 'main')}>
				<Icon name="back" size={16} />
				{TITLES[view]}
			</button>

			{#if view === 'plan'}
				<div class="sub">
					<div class="tabs days" role="tablist" aria-label="Wochentag">
						{#each DAYS as day, i (day)}
							<button
								role="tab"
								aria-selected={planDay === i}
								class:on={planDay === i}
								class:has={plan.some((s) => s.day === i)}
								title={DAY_NAMES[i]}
								onclick={() => (planDay = i)}>{day}</button
							>
						{/each}
					</div>
					{#each planSlots as slot (slot)}
						<div class="slot">
							<input type="time" bind:value={slot.start} aria-label="Beginn" />
							<span>–</span>
							<input type="time" bind:value={slot.end} aria-label="Ende" />
							<button class="remove" title="Stunde entfernen" aria-label="Stunde entfernen" onclick={() => removeSlot(slot)}>
								<Icon name="close" size={12} />
							</button>
							<span class="door"><Icon name="door" size={14} /></span>
							<select bind:value={slot.room} aria-label="Raum nach der Stunde">
								<option value="">Kein Raumwechsel</option>
								{#each rooms as room (room)}<option value={room}>{room}</option>{/each}
								{#if slot.room && !rooms.includes(slot.room)}<option value={slot.room}>{slot.room}</option>{/if}
							</select>
						</div>
					{:else}
						<p class="hint">Am {DAY_NAMES[planDay]} ist noch nichts geplant.</p>
					{/each}
					<button class="add-link" onclick={addSlot}>+ Stunde hinzufügen</button>
					<p class="hint">Gestartet wird immer mit „▶ Stunde starten“ – die geplante Dauer läuft ab dem Klick.</p>
					<div class="actions">
						<button class="primary" onclick={savePlan}>Speichern</button>
					</div>
					{#if planMessage}<p class="message">{planMessage}</p>{/if}
				</div>
			{:else if view === 'noise' && noiseSettings}
				<form class="sub" onsubmit={saveNoise}>
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
			{:else if view === 'share' && sharing}
				<div class="sub">
					{#if shareReach === 'device'}
						<p class="hint warn">
							Die Adresse zeigt auf dieses Gerät – Handys erreichen sie so nicht. classRoom über die Netzwerk-Adresse
							öffnen oder PUBLIC_URL in der .env setzen.
						</p>
					{:else if shareReach === 'local'}
						<p class="hint">Die Adresse ist nur im Schulnetz erreichbar – Handys müssen im selben WLAN sein.</p>
					{/if}
					{#each shares as s (s.teacherId)}
						<div class="share">
							<strong class="share-title">{s.title || 'Auftrag ohne Titel'}</strong>
							<small>
								{user.isAdmin ? `${s.username}${s.teacherId === user.id ? ' (du)' : ''} · ` : ''}bis {formatExpiry(s.expiresAt)}
							</small>
							<small class="share-link">{shortUrl(shareUrl(sharing.publicUrl, s.code))}</small>
							<div class="share-actions">
								<button onclick={() => changeShare(s.teacherId, 'PUT')} title="Gültig ab jetzt für {daysLabel(sharing.days)}">
									+ {daysLabel(sharing.days)}
								</button>
								<button class="danger" onclick={() => changeShare(s.teacherId, 'DELETE')}>Beenden</button>
							</div>
						</div>
					{:else}
						<p class="hint">
							Kein Auftrag ist geteilt. Teilen über das QR-Symbol <Icon name="qr" size={12} /> in der Leiste des Auftrags.
						</p>
					{/each}
					{#if shareMessage}<p class="message error">{shareMessage}</p>{/if}
				</div>
			{:else if view === 'display'}
				<div class="sub">
					<div class="setting">
						<span>Darstellung</span>
						<ThemeToggle />
					</div>
					{#if page.data.background?.canChoose}
						<div class="setting">
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
				</div>
			{/if}
		{/if}

		<form class="account" method="POST" action="/logout">
			<span class="avatar" aria-hidden="true">{initials}</span>
			<span class="who">
				<strong>{accountName}</strong>
				<small>{isTeacher ? 'Lehrkraft' : 'Schüler'}</small>
			</span>
			<button type="submit" class="icon-btn" title="Abmelden" aria-label="Abmelden">
				<Icon name="logout" size={16} />
			</button>
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
		gap: 8px;
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

	/* Gruppen-Überschrift: klein, grau, Großbuchstaben */
	.group {
		margin: 8px 10px 2px;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	nav .group:first-child {
		margin-top: 4px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 5px 10px;
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

	/* Anzahl rechtsbündig (Schüler, Lehrer) */
	nav .count {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}

	/* --- Stunde: Status, Karte mit Zusammenfassung, Reitern und Start-Knopf --- */
	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 0;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border: 1.5px solid currentColor;
		border-radius: 50%;
	}

	.status.live {
		color: var(--ok);
	}

	.status.live .status-dot {
		background: currentColor;
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px 12px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg);
	}

	.summary {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.kicker {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.big {
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
	}

	.meta {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}

	/* Reiter Zeit · Raum · Aufräumen */
	.tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
		padding: 3px;
		border-radius: 10px;
		background: var(--track);
	}

	.drawer .tabs button {
		padding: 4px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font-weight: 600;
	}

	.drawer .tabs button.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 3px rgb(0 0 0 / 18%);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.chips {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
		gap: 6px;
	}

	.drawer .chips button {
		padding: 4px;
		background: var(--surface);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Klasse der Stunde */
	.classes {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.classes select {
		flex: 1;
		min-width: 0;
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-weight: 600;
	}

	.kdot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		vertical-align: baseline;
	}

	.drawer .chips button.on {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}

	.times {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.drawer input[type='text'],
	.drawer input[type='time'] {
		padding: 5px 8px;
		color: var(--text);
	}

	/* Raumliste mit runden Auswahlknöpfen */
	.rooms {
		gap: 0;
	}

	label.room {
		flex-direction: row;
		align-items: center;
		gap: 10px;
		padding: 9px 2px;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		font-size: 0.92rem;
		cursor: pointer;
	}

	.room span {
		flex: 1;
	}

	.room small {
		color: var(--muted);
		font-size: 0.75rem;
	}

	.room input {
		appearance: none;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid var(--muted);
		border-radius: 50%;
		cursor: pointer;
	}

	.room input:checked {
		border-color: var(--accent);
		background: radial-gradient(circle, var(--accent) 0 4px, transparent 5px);
	}

	.room input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Entfernen erst beim Darüberfahren deutlich */
	.drawer .room .remove {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		opacity: 0.35;
	}

	.drawer .room:hover .remove,
	.drawer .room .remove:focus-visible {
		opacity: 1;
	}

	.drawer .room .remove:hover {
		color: var(--danger);
	}

	.drawer .add-link {
		align-self: flex-start;
		margin-top: 8px;
		padding: 2px 0;
		border: 0;
		background: transparent;
		color: var(--accent);
		font-size: 0.85rem;
	}

	.add-room {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}

	.add-room input {
		flex: 1;
		min-width: 0;
	}

	/* Heutige Stunden aus dem Wochenplan: Zeit groß, Raum klein darunter */
	.slots {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
		gap: 6px;
	}

	.drawer .slots button {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4px 6px;
		background: var(--surface);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.slots small {
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 500;
	}

	.drawer .slots button.on {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}

	.drawer .slots button.on small {
		color: inherit;
	}

	.lesson > .row {
		width: 100%;
		margin-top: 6px;
	}

	/* Wochenplan: Wochentage als Reiter, darunter je Stunde Beginn – Ende ✕ und Raum */
	.days {
		grid-template-columns: repeat(7, 1fr);
	}

	.drawer .days button.has:not(.on) {
		color: var(--text);
	}

	.slot {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto;
		align-items: center;
		gap: 4px 6px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
		color: var(--muted);
	}

	.slot input {
		min-width: 0;
	}

	.slot select {
		grid-column: 2 / -1;
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	.slot .door {
		display: flex;
		justify-self: end;
	}

	.drawer .slot .remove {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
	}

	.drawer .slot .remove:hover {
		color: var(--danger);
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.drawer .go {
		padding: 8px 10px;
		border-radius: 10px;
		font-size: 1rem;
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

	.message {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
		text-align: center;
	}

	.message.error {
		color: var(--danger);
	}

	/* --- Anzeige: Zeilen mit Wert und Pfeil --- */
	.display {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.drawer .row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 5px 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text);
		font-weight: 500;
		text-align: left;
	}

	.drawer .row:hover {
		background: var(--bg);
	}

	.row .value {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.row :global(svg:last-child) {
		color: var(--muted);
	}

	/* --- Unterseiten (Ampel, Darstellung) --- */
	.drawer .back {
		display: flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		padding: 4px 6px;
		border: 0;
		background: transparent;
		color: var(--text);
		font-size: 1rem;
		font-weight: 700;
	}

	.sub {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* Geteilte Aufträge */
	.hint.warn {
		padding: 8px 10px;
		border-radius: 8px;
		background: var(--warn-soft);
		color: var(--text);
	}

	.share {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.share-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.share small {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.share .share-link {
		font-family: ui-monospace, monospace;
		word-break: break-all;
	}

	.share-actions {
		display: flex;
		gap: 6px;
		margin-top: 6px;
	}

	.share-actions button {
		padding: 4px 10px;
		font-size: 0.85rem;
	}

	.setting {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.drawer button:not(.icon-btn) {
		padding: 5px 10px;
	}

	label.field {
		display: grid;
		grid-template-columns: 100px 1fr;
		align-items: center;
		gap: 8px;
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

	.actions {
		display: flex;
		gap: 6px;
	}

	.actions button {
		flex: 1;
	}

	/* --- Konto unten: Avatar, Name, Rolle, Abmelden --- */
	.account {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: auto -16px -14px;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
	}

	.avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.85rem;
		font-weight: 800;
	}

	.who {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.who strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.who small {
		color: var(--muted);
		font-size: 0.78rem;
	}

	.account .icon-btn {
		color: var(--muted);
	}

	/* Smartphone/Tablet: Konto direkt unter dem Inhalt statt ganz unten –
	   dort liegt es sonst oft hinter der Browserleiste und man müsste scrollen. */
	@media (max-width: 900px), (hover: none) {
		.account {
			margin-top: 0;
		}
	}
</style>
