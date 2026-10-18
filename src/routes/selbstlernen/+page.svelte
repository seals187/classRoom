<script>
	import GoalBoard from '#lib/components/GoalBoard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Selbstlern-Modus · classRoom</title>
</svelte:head>

<GoalBoard students={data.students} user={data.user} kind="self" collapsedByDefault={data.goalsCollapsed}>
	{#snippet title()}
		Selbstlernen <span class="sub">· jeder in seinem Tempo</span>
	{/snippet}
</GoalBoard>

<style>
	.sub {
		color: var(--muted);
		font-size: 16px;
		font-weight: 400;
	}
</style>
