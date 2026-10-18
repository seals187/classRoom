<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import { clock } from '#lib/clock.svelte.js';
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
	const GAP = 10;

	/** @type {Record<string, string>} */
	const SORT_LABELS =
		kind === 'self' ? { active: 'zuletzt aktiv', name: 'Name' } : { name: 'Name', progress: 'Fortschritt' };
	const sortKey = `goalSort.${kind}`;

	const isTeacher = $derived(user?.role === 'teacher');
	const ownId = $derived(user?.studentId ?? null);
	const isSelf = $derived(kind === 'self');
	// Zeilenhöhe einer zugeklappten Kachel (Selbstlernen hat eine Zeile mehr).
	const row = $derived(isSelf ? 78 : 59);

	let sortBy = $state(kind === 'self' ? 'active' : 'name');

	// Alle auf/zu (pro Gerät gemerkt) – einzelne Kacheln lassen sich davon abweichend umschalten.
	let expandAll = $state(false);
	/** @type {Record<number, boolean>} */
	let overrides = $state({});

	/** @param {import('#lib/server/db.js').Student} s */
	const isComplete = (s) => s.goals.length > 0 && s.goals.every((g) => g.done);
	/** @param {import('#lib/server/db.js').Student} s */
	const ratio = (s) => (s.goals.length ? s.goals.filter((g) => g.done).length / s.goals.length : 0);

	const byName = (/** @type {import('#lib/server/db.js').Student} */ a, /** @type {typeof a} */ b) =>
		a.firstName.localeCompare(b.firstName, 'de') || a.lastName.localeCompare(b.lastName, 'de');

	const sorted = $derived.by(() => {
		const list = [...students];
		if (sortBy === 'progress') {
			// Wer am wenigsten erledigt hat, zuerst – Fertige landen damit am Ende.
			list.sort((a, b) => ratio(a) - ratio(b) || byName(a, b));
		} else if (sortBy === 'active') {
			// Am längsten nichts abgehakt zuerst, ohne Ziele danach, Fertige ans Ende.
			const rank = (/** @type {typeof list[number]} */ s) => (isComplete(s) ? 2 : s.goals.length === 0 ? 1 : 0);
			list.sort(
				(a, b) =>
					rank(a) - rank(b) || (a.activeAt ?? Infinity) - (b.activeAt ?? Infinity) || byName(a, b)
			);
		} else {
			list.sort(byName);
		}
		// Schüler sehen ihre eigene Kachel zuerst.
		if (ownId !== null) list.sort((a, b) => Number(b.id === ownId) - Number(a.id === ownId));
		return list;
	});

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

	function persistSort() {
		try {
			localStorage.setItem(sortKey, sortBy);
		} catch {
			// Gilt dann nur bis zum Neuladen.
		}
	}

	onMount(() => {
		expandAll = !collapsedByDefault;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored !== null) expandAll = stored === '1';
			const sort = localStorage.getItem(sortKey);
			if (sort && sort in SORT_LABELS) sortBy = sort;
		} catch {
			// Kein localStorage – Standardwerte.
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
			{#if isSelf}
				<span class="legend"><span class="legend-dot" aria-hidden="true"></span>seit {STALE_MINUTES}+ min nichts abgehakt</span>
			{/if}
			<label class="sort">
				Sortiert:
				<select bind:value={sortBy} onchange={persistSort}>
					{#each Object.entries(SORT_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</label>
			{#if isTeacher && students.length > 0}
				<button class="link" aria-pressed={expandAll} onclick={toggleAll}>
					{expandAll ? 'Alle einklappen' : 'Alle aufklappen'}
				</button>
			{/if}
			{@render actions?.()}
		</div>
	</div>

	{#if sorted.length === 0}
		<section class="empty">
			<h2>Noch keine Schüler</h2>
			{#if isTeacher}
				<p>Lege zuerst die Klasse unter <a href="/schueler">Schüler verwalten</a> an.</p>
			{/if}
		</section>
	{:else}
		<div class="tiles" style:--row="{row}px" style:--gap="{GAP}px">
			{#each sorted as student (student.id)}
				<StudentTile
					{student}
					{kind}
					editable={isTeacher || student.id === ownId}
					own={student.id === ownId}
					open={isOpen(student.id)}
					onopenchange={(open) => (overrides[student.id] = open)}
					now={clock.now}
					staleMinutes={STALE_MINUTES}
					{row}
					gap={GAP}
				/>
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

	.sort {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	select {
		padding: 2px 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	select option {
		background: var(--surface);
		color: var(--text);
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

	/* Raster: zugeklappt eine Zeile, aufgeklappt span N (siehe StudentTile). */
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		grid-auto-rows: var(--row);
		grid-auto-flow: dense;
		gap: var(--gap);
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
		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		h1 {
			font-size: 18px;
		}
	}
</style>
