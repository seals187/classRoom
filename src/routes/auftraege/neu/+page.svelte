<script>
	import AssignmentBox from '#lib/components/AssignmentBox.svelte';

	// Neuer Auftrag: gleich im Editor, gespeichert wird er erst mit „Speichern“.
	const empty = { title: '', html: '', images: [] };
</script>

<svelte:head>
	<title>Neuer Auftrag · classRoom</title>
</svelte:head>

<div class="detail">
	<AssignmentBox assignment={empty} canEdit startEditing />
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
