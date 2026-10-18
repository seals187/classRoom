<script>
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask, showError } from '#lib/dialog.svelte.js';
	import GoalBoard from '#lib/components/GoalBoard.svelte';

	let { data } = $props();

	const isTeacher = $derived(data.user?.role === 'teacher');

	async function newLesson() {
		const ok = await ask({
			title: 'Neue Stunde beginnen?',
			message:
				'Alle Stundenziele aller Schüler werden gelöscht, damit die Klasse mit leeren Kacheln startet.\nSelbstlern-Ziele und der Auftrag bleiben erhalten.',
			confirmLabel: 'Stundenziele löschen',
			danger: true
		});
		if (!ok) return;
		try {
			await api('/api/goals?kind=lesson', 'DELETE');
		} catch (err) {
			showError(err);
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Stundenziele · classRoom</title>
</svelte:head>

<GoalBoard students={data.students} user={data.user} kind="lesson" collapsedByDefault={data.goalsCollapsed}>
	{#snippet title()}
		Stundenziele
		{#if data.assignmentTitle}
			<a class="sub" href="/" title="Zum Auftrag">· {data.assignmentTitle}</a>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if isTeacher}
			<button
				class="new-lesson"
				onclick={newLesson}
				title="Löscht die Stundenziele aller Schüler, damit die nächste Stunde mit leeren Kacheln beginnt. Selbstlern-Ziele und der Auftrag bleiben erhalten."
			>
				Neue Stunde
			</button>
		{/if}
	{/snippet}
</GoalBoard>

<style>
	.sub {
		overflow: hidden;
		color: var(--muted);
		font-size: 16px;
		font-weight: 400;
		text-decoration: none;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.sub:hover {
		color: var(--lesson-accent);
	}

	/* Dezent neben „Alle aufklappen“. */
	.new-lesson {
		padding: 3px 10px;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font-size: 13px;
	}

	.new-lesson:hover {
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
