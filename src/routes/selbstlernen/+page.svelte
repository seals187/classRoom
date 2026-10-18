<script>
	import PageTitle from '$lib/components/PageTitle.svelte';
	import GoalBoard from '$lib/components/GoalBoard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Selbstlern-Modus · classRoom</title>
</svelte:head>

<div class="page-head">
	<PageTitle href="/selbstlernen">Selbstlern-Modus</PageTitle>
</div>

<GoalBoard students={data.students} user={data.user} kind="self" collapsedByDefault={data.goalsCollapsed} />
