<script>
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import AssignmentBox from '#lib/components/AssignmentBox.svelte';

	let { data } = $props();

	// ✎ aus der Übersicht (?edit): gleich im Editor – danach ohne ?edit in der Adresse, damit Neuladen nicht wieder öffnet.
	const startEditing = $derived(page.url.searchParams.has('edit'));
	$effect(() => {
		// Erst nachdem der Editor offen ist (und der Router bereit).
		if (startEditing) setTimeout(() => replaceState(page.url.pathname, {}));
	});
</script>

<svelte:head>
	<title>{data.assignment.title || 'Auftrag'} · classRoom</title>
</svelte:head>

<div class="detail">
	<!-- Neu aufbauen, wenn ein anderer Auftrag geöffnet wird (Editor-Zustand gehört zum Auftrag). -->
	{#key data.assignment.id}
		<AssignmentBox
			assignment={data.assignment}
			canEdit
			students={data.lessonStudents}
			groups={data.groups}
			teachers={data.teachers}
			share={data.share}
			{startEditing}
		/>
	{/key}
</div>

<style>
	:global(main:has(> .detail)) {
		display: flex;
		flex-direction: column;
	}

	.detail {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
