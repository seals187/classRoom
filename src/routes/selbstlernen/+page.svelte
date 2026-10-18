<script>
	import PageTitle from '#lib/components/PageTitle.svelte';
	import GoalBoard from '#lib/components/GoalBoard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Selbstlern-Modus · classRoom</title>
</svelte:head>

<div class="page-head">
	<!-- Untertitel wie bei den Stundenzielen, damit beide Seiten gleich aufgebaut sind -->
	<div>
		<PageTitle href="/selbstlernen">Selbstlern-Modus</PageTitle>
		<span class="sub">Eigene Ziele · im eigenen Tempo</span>
	</div>
</div>

<GoalBoard students={data.students} user={data.user} kind="self" collapsedByDefault={data.goalsCollapsed} />
