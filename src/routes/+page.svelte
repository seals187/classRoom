<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import AssignmentBox from '#lib/components/AssignmentBox.svelte';
	import { ui } from '#lib/ui.svelte.js';

	let { data } = $props();

	const students = $derived(data.lessonStudents ?? []);
	const totalGoals = $derived(students.reduce((sum, s) => sum + s.goals.length, 0));
	const doneGoals = $derived(students.reduce((sum, s) => sum + s.goals.filter((g) => g.done).length, 0));

	/** @param {import('#lib/server/db.js').Student} s */
	const share = (s) => (s.goals.length ? s.goals.filter((g) => g.done).length / s.goals.length : 0);

	const finished = $derived(students.filter((s) => s.goals.length > 0 && share(s) === 1).length);
	// Erst wenn wirklich jeder Schüler alle Ziele erledigt hat.
	const allDone = $derived(students.length > 0 && finished === students.length);

	/**
	 * Von hellgrün (erstes Ziel erledigt) zu immer kräftigerem Grün, ganz grün = alles erledigt.
	 * @param {import('#lib/server/db.js').Student} s
	 */
	const dotColor = (s) => {
		const p = share(s);
		if (p === 0) return 'var(--track)';
		if (p === 1) return 'var(--ok)';
		return `color-mix(in srgb, var(--ok) ${Math.round(25 + p * 55)}%, var(--track))`;
	};

	onMount(() => autoRefresh(10000));
</script>

<svelte:head>
	<title>Auftrag · classRoom</title>
</svelte:head>

<div class="home">
	<AssignmentBox assignment={data.assignment} canEdit={data.user?.role === 'teacher'} studentCount={students.length} />

	{#if !ui.focus}
		<!-- Stundenziele auf einen Blick: ein Quadrat pro Schüler -->
		<section class="goals" class:all-done={allDone}>
			{#if allDone}
				<h2><span aria-hidden="true">🎉</span> Alle Ziele erledigt</h2>
			{:else}
				<h2>Stundenziele</h2>
				<div class="dots" aria-label="{finished} von {students.length} Schülern fertig">
					{#each students as s (s.id)}
						<span
							class="dot"
							style:background={dotColor(s)}
							title="{s.firstName} {s.lastName}: {s.goals.filter((g) => g.done).length}/{s.goals.length}"
						></span>
					{/each}
				</div>
			{/if}
			<span class="stats">
				<strong>{doneGoals}/{totalGoals}</strong> Ziele ·
				{#if allDone}{finished} von {students.length} Schülern fertig{:else}<strong>{finished}</strong>/{students.length} fertig{/if}
			</span>
			<a class="open" href="/stundenziele">Öffnen →</a>
		</section>
	{/if}
</div>

<style>
	/* Auftrag füllt den Platz zwischen Kopfband und Stundenziel-Leiste. */
	.home {
		min-height: calc(100dvh - 178px);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.goals {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 14px 22px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.goals.all-done {
		border-color: color-mix(in srgb, var(--ok) 45%, transparent);
		background: color-mix(in srgb, var(--ok-soft) 70%, var(--surface));
	}

	h2 {
		flex-shrink: 0;
		font-size: 17px;
	}

	.all-done h2 {
		color: var(--ok);
	}

	/* Alles erledigt: Kennzahlen direkt hinter dem Titel, Knopf ganz rechts. */
	.all-done .stats {
		flex: 1;
	}

	.dots {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		transition: background 0.4s;
	}

	.stats {
		flex-shrink: 0;
		color: var(--muted);
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}

	.stats strong {
		color: var(--text);
	}

	.open {
		flex-shrink: 0;
		padding: 9px 18px;
		border-radius: 10px;
		background: var(--lesson-accent);
		color: var(--on-accent);
		font-weight: 700;
		text-decoration: none;
	}

	.all-done .open {
		background: var(--ok);
	}

	.open:hover {
		filter: brightness(1.08);
	}

	@media (max-width: 640px) {
		.goals {
			flex-wrap: wrap;
			gap: 10px 14px;
			padding: 12px 14px;
		}

		.dots {
			order: 3;
			flex-basis: 100%;
		}

		.stats {
			margin-left: auto;
		}

		.open {
			order: 4;
			flex-basis: 100%;
			text-align: center;
		}
	}
</style>
