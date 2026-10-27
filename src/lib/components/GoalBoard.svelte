<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import { page } from '$app/state';
	import { clock } from '#lib/clock.svelte.js';
	import { lessonEnded, lessonSpan } from '#lib/time.js';
	import { ui } from '#lib/ui.svelte.js';
	import StudentTile from './StudentTile.svelte';

	/**
	 * Titelzeile und Schüler-Raster für Stundenziele und Selbstlernen (das Kopfband kommt aus dem Header).
	 * @type {{
	 *   students: import('#lib/server/db.js').Student[],
	 *   user: import('#lib/server/auth.js').User | null,
	 *   kind: 'self' | 'lesson',
	 *   collapsedByDefault?: boolean,
	 *   title: import('svelte').Snippet,
	 *   actions?: import('svelte').Snippet
	 * }}
	 */
	let { students, user, kind, collapsedByDefault = true, title, actions } = $props();

	const STORAGE_KEY = 'goalsExpanded';
	const STALE_MINUTES = 15;

	// „seit … nichts abgehakt“ zählt nur, solange eine Stunde läuft – und frühestens ab ihrem Beginn.
	const lessonStart = $derived.by(() => {
		const s = page.data.settings;
		const now = clock.now;
		if (!s?.returnTime || !now) return null;
		const span = lessonSpan(s.startTime, s.returnTime, now);
		if (!span.end || lessonEnded(span, now) || (span.start && span.start > now)) return null;
		return span.start?.getTime() ?? now.getTime();
	});
	const GAP = 10;
	// Spalten: mindestens 180px breit, auf schmalen Bildschirmen immer 2.
	const MIN_TILE = 180;

	const isTeacher = $derived(user?.role === 'teacher');
	const ownId = $derived(user?.studentId ?? null);
	const isSelf = $derived(kind === 'self');

	// Alle auf/zu (pro Gerät gemerkt) – einzelne Kacheln lassen sich davon abweichend umschalten.
	let expandAll = $state(false);
	/** @type {Record<number, boolean>} */
	let overrides = $state({});

	let width = $state(0);

	// Feste Reihenfolge nach Name; Schüler sehen ihre eigene Kachel zuerst.
	const ordered = $derived(
		[...students].sort(
			(a, b) =>
				Number(b.id === ownId) - Number(a.id === ownId) ||
				a.firstName.localeCompare(b.firstName, 'de') ||
				a.lastName.localeCompare(b.lastName, 'de')
		)
	);

	// Echte Spalten statt Grid-Zeilen: Aufklappen schiebt nur die Kacheln darunter in derselben
	// Spalte nach unten, nichts springt in eine andere Spalte. Verteilt zeilenweise (links → rechts).
	const columnCount = $derived(
		width === 0 ? 5 : width < 640 ? 2 : Math.max(1, Math.floor((width + GAP) / (MIN_TILE + GAP)))
	);
	const columns = $derived.by(() => {
		/** @type {import('#lib/server/db.js').Student[][]} */
		const cols = Array.from({ length: columnCount }, () => []);
		ordered.forEach((student, i) => cols[i % columnCount].push(student));
		return cols;
	});

	// Schüler können die Kacheln der anderen ausblenden (pro Gerät gemerkt) – Kopfband und
	// Klassen-Fortschritt bleiben, nur das Raster zeigt dann allein die eigene Kachel.
	const FOCUS_KEY = 'goalsOnlyOwn';
	let onlyOwn = $state(false);
	const ownStudent = $derived(ownId === null ? null : (students.find((s) => s.id === ownId) ?? null));
	const focused = $derived(onlyOwn && ownStudent !== null);

	function toggleOnlyOwn() {
		onlyOwn = !onlyOwn;
		try {
			localStorage.setItem(FOCUS_KEY, onlyOwn ? '1' : '0');
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}

	/** @param {number} id */
	const isOpen = (id) => overrides[id] ?? (expandAll || id === ownId);

	function toggleAll() {
		expandAll = !expandAll;
		overrides = {};
		try {
			localStorage.setItem(STORAGE_KEY, expandAll ? '1' : '0');
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}

	onMount(() => {
		expandAll = !collapsedByDefault;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored !== null) expandAll = stored === '1';
			onlyOwn = localStorage.getItem(FOCUS_KEY) === '1';
		} catch {
			// Kein localStorage – Standard aus der .env.
		}
		return autoRefresh(5000);
	});
</script>

<div class="board" style:--page-accent={isSelf ? 'var(--self-accent)' : 'var(--lesson-accent)'}>
	<div class="head">
		<h1>
			<span class="dot" aria-hidden="true"></span>
			{@render title()}
		</h1>
		<div class="controls">
			{#if students.length > 0 && lessonStart !== null}
				<span class="legend"><span class="legend-dot" aria-hidden="true"></span>{STALE_MINUTES}+ min nichts abgehakt</span>
			{/if}
			{#if isTeacher && students.length > 0}
				<button class="link" aria-pressed={expandAll} onclick={toggleAll}>
					{expandAll ? 'Alle einklappen' : 'Alle aufklappen'}
				</button>
			{/if}
			{#if ownStudent && students.length > 1}
				<button class="link focus-toggle" aria-pressed={onlyOwn} onclick={toggleOnlyOwn}>
					{onlyOwn ? 'Alle Schüler zeigen' : 'Nur meine Kachel'}
				</button>
			{/if}
			{#if page.data.background?.canChoose}
				<button class="link" onclick={() => (ui.backgroundPicker = true)}>Hintergrund</button>
			{/if}
			{@render actions?.()}
		</div>
	</div>

	{#if ordered.length === 0}
		<section class="empty">
			<h2>Noch keine Schüler</h2>
			{#if isTeacher}
				<p>In der aktiven Klasse sind noch keine Schüler – unter <a href="/verwaltung">Klassen</a> hinzufügen.</p>
			{/if}
		</section>
	{:else if focused && ownStudent}
		<!-- Fokus: nur die eigene Kachel, breiter und mittig -->
		<div class="focus">
			<StudentTile
				student={ownStudent}
				{kind}
				editable
				own
				open={isOpen(ownStudent.id)}
				onopenchange={(open) => (overrides[ownStudent.id] = open)}
				now={lessonStart === null ? null : clock.now}
				{lessonStart}
				staleMinutes={STALE_MINUTES}
			/>
			<p class="focus-hint">
				Die Kacheln der anderen sind ausgeblendet. <button class="link" onclick={toggleOnlyOwn}>Alle Schüler zeigen</button>
			</p>
		</div>
	{:else}
		<div class="tiles" bind:clientWidth={width} style:--cols={columnCount} style:--gap="{GAP}px">
			{#each columns as column, c (c)}
				<div class="column">
					{#each column as student (student.id)}
						<StudentTile
							{student}
							{kind}
							editable={isTeacher || student.id === ownId}
							own={student.id === ownId}
							open={isOpen(student.id)}
							onopenchange={(open) => (overrides[student.id] = open)}
							now={lessonStart === null ? null : clock.now}
							{lessonStart}
							staleMinutes={STALE_MINUTES}
						/>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.board {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px 20px;
		margin-top: 4px;
	}

	/* Auf einem Hintergrund (Farbverlauf/Bild) steht die Titelzeile auf einer Milchglas-Leiste. */
	:global(main[data-bg]) .head {
		margin-top: 0;
		padding: 8px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--surface) 82%, transparent);
		backdrop-filter: blur(10px);
	}

	h1 {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		font-size: 21px;
		font-weight: 700;
	}

	.dot {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--page-accent);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 18px;
		color: var(--muted);
		font-size: 14px;
	}

	.legend {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.legend-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--warn);
	}

	.link {
		padding: 2px 0;
		border: 0;
		background: transparent;
		color: var(--page-accent);
		font-size: 14px;
		font-weight: 500;
	}

	.link:hover {
		text-decoration: underline;
	}

	/* Feste Spalten nebeneinander, in jeder Spalte die Kacheln untereinander. */
	.tiles {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		align-items: start;
		gap: var(--gap);
	}

	.column {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}

	.focus {
		width: min(520px, 100%);
		margin: 8px auto 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* Text auf einer Milchglas-Fläche, damit er auch auf Hintergrundbildern lesbar bleibt. */
	.focus-hint {
		align-self: center;
		margin: 0;
		padding: 6px 14px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 82%, transparent);
		backdrop-filter: blur(8px);
		color: var(--muted);
		font-size: 13px;
		text-align: center;
	}

	.focus-hint .link {
		font-size: 13px;
	}

	.link.focus-toggle[aria-pressed='true'] {
		font-weight: 700;
	}

	.empty {
		max-width: 520px;
		margin: 40px auto 0;
		text-align: center;
		color: var(--muted);
	}

	h2 {
		margin-bottom: 8px;
		color: var(--text);
		font-size: 1.3rem;
	}

	a {
		color: var(--page-accent);
	}

	@media (max-width: 640px) {
		h1 {
			font-size: 18px;
		}
	}
</style>
