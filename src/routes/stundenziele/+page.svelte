<script>
	import PageTitle from '#lib/components/PageTitle.svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import GoalBoard from '#lib/components/GoalBoard.svelte';

	let { data } = $props();

	const isTeacher = $derived(data.user?.role === 'teacher');

	async function newLesson() {
		if (
			!confirm(
				'Neue Stunde beginnen?\n\nAlle Stundenziele aller Schüler werden gelöscht, damit die Klasse mit leeren Kacheln startet.\nSelbstlern-Ziele und der Auftrag bleiben erhalten.'
			)
		)
			return;
		try {
			await api('/api/goals?kind=lesson', 'DELETE');
		} catch (err) {
			alert(err instanceof Error ? err.message : String(err));
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Stundenziele · classRoom</title>
</svelte:head>

<div class="page-head">
	<div>
		<PageTitle href="/stundenziele">Stundenziele</PageTitle>
		{#if data.assignmentTitle}
			<a class="sub" href="/">← {data.assignmentTitle}</a>
		{:else}
			<a class="sub" href="/">← zum Auftrag</a>
		{/if}
	</div>
	{#if isTeacher}
		<div class="new-lesson">
			<button
				onclick={newLesson}
				aria-describedby="new-lesson-help"
				title="Löscht die Stundenziele aller Schüler, damit die nächste Stunde mit leeren Kacheln beginnt. Selbstlern-Ziele und der Auftrag bleiben erhalten."
			>
				Neue Stunde
			</button>
			<small id="new-lesson-help">Leert alle Stundenziele · Selbstlern-Ziele bleiben</small>
		</div>
	{/if}
</div>

<GoalBoard students={data.students} user={data.user} kind="lesson" collapsedByDefault={data.goalsCollapsed} />

<style>
	.new-lesson {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.new-lesson small {
		color: var(--muted);
		font-size: 0.8rem;
		text-align: right;
	}
</style>
