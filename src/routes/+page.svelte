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
	function state(s) {
		const done = s.goals.filter((g) => g.done).length;
		return s.goals.length > 0 && done === s.goals.length ? 'done' : done > 0 ? 'busy' : 'idle';
	}

	const finished = $derived(students.filter((s) => state(s) === 'done').length);

	onMount(() => autoRefresh(10000));
</script>

<svelte:head>
	<title>Auftrag · classRoom</title>
</svelte:head>

<div class="home">
	<AssignmentBox assignment={data.assignment} canEdit={data.user?.role === 'teacher'} />

	{#if !ui.focus}
		<!-- Stundenziele auf einen Blick: ein Punkt pro Schüler -->
		<section class="goals">
			<h2>Stundenziele</h2>
			<div class="dots" aria-label="{finished} von {students.length} Schülern fertig">
				{#each students as s (s.id)}
					<span class="dot {state(s)}" title="{s.firstName} {s.lastName}"></span>
				{/each}
			</div>
			<span class="stats"><strong>{doneGoals}/{totalGoals}</strong> Ziele · <strong>{finished}</strong> fertig</span>
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
		gap: 18px;
	}

	.goals {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 14px 22px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	h2 {
		flex-shrink: 0;
		font-size: 17px;
	}

	.dots {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.dot {
		width: 13px;
		height: 13px;
		border-radius: 3px;
		background: var(--track);
	}

	.dot.busy {
		background: var(--lesson-accent);
		opacity: 0.75;
	}

	.dot.done {
		background: var(--ok);
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
		color: #0d1424;
		font-weight: 700;
		text-decoration: none;
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
