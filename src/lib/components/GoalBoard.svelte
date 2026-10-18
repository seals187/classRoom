<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import Icon from './Icon.svelte';
	import StudentTile from './StudentTile.svelte';

	/**
	 * @type {{
	 *   students: import('#lib/server/db.js').Student[],
	 *   user: import('#lib/server/auth.js').User | null,
	 *   kind: 'self' | 'lesson',
	 *   collapsedByDefault?: boolean
	 * }}
	 */
	let { students, user, kind, collapsedByDefault = true } = $props();

	const STORAGE_KEY = 'goalsExpanded';

	const isTeacher = $derived(user?.role === 'teacher');
	const ownId = $derived(user?.studentId ?? null);
	// Schüler sehen ihre eigene Kachel zuerst.
	const sorted = $derived(
		ownId === null ? students : [...students].sort((a, b) => Number(b.id === ownId) - Number(a.id === ownId))
	);

	// Alle auf/zu (pro Gerät gemerkt) – einzelne Kacheln lassen sich davon abweichend umschalten.
	let expandAll = $state(false);
	/** @type {Record<number, boolean>} */
	let overrides = $state({});

	const totalGoals = $derived(students.reduce((sum, s) => sum + s.goals.length, 0));
	const doneGoals = $derived(students.reduce((sum, s) => sum + s.goals.filter((g) => g.done).length, 0));
	const finished = $derived(students.filter((s) => s.goals.length > 0 && s.goals.every((g) => g.done)).length);

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
		} catch {
			// Kein localStorage – Standard aus der .env.
		}
		return autoRefresh(5000);
	});
</script>

{#if sorted.length === 0}
	<section class="card empty">
		<h2>Noch keine Schüler</h2>
		{#if isTeacher}
			<p>Lege zuerst die Klasse unter <a href="/schueler">Schüler verwalten</a> an.</p>
		{/if}
	</section>
{:else}
	<div class="bar">
		<span class="stats">
			<strong>{doneGoals}/{totalGoals}</strong> Ziele erledigt · <strong>{finished}</strong> von {students.length} Schülern fertig
		</span>
		{#if isTeacher}
			<button
				class="toggle-all"
				aria-pressed={expandAll}
				title={expandAll ? 'Ziele aller Schüler einklappen' : 'Ziele aller Schüler aufklappen'}
				onclick={toggleAll}
			>
				<Icon name={expandAll ? 'collapse' : 'expand'} size={20} />
				{expandAll ? 'Alle einklappen' : 'Alle aufklappen'}
			</button>
		{/if}
	</div>

	<div class="tiles">
		{#each sorted as student (student.id)}
			<StudentTile
				{student}
				{kind}
				editable={isTeacher || student.id === ownId}
				own={student.id === ownId}
				open={isOpen(student.id)}
				onopenchange={(open) => (overrides[student.id] = open)}
			/>
		{/each}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		margin-bottom: 12px;
	}

	.toggle-all {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 600;
	}

	.stats {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.stats strong {
		color: var(--text);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 10px;
		align-items: start;
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
		color: var(--accent);
	}
</style>
