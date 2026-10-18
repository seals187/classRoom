<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import AssignmentBox from '#lib/components/AssignmentBox.svelte';
	import { ui } from '#lib/ui.svelte.js';

	let { data } = $props();

	onMount(() => autoRefresh(10000));
</script>

<svelte:head>
	<title>Auftrag · classRoom</title>
</svelte:head>

<div class="home">
	<AssignmentBox assignment={data.assignment} canEdit={data.user?.role === 'teacher'} />

	{#if !ui.focus}
		<a class="goals-button" href="/stundenziele">
			Stundenziele
			<span aria-hidden="true">→</span>
		</a>
	{/if}
</div>

<style>
	.home {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.goals-button {
		align-self: center;
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 16px 36px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 1.35rem;
		font-weight: 700;
		text-decoration: none;
		box-shadow: var(--shadow);
		transition: transform 0.15s;
	}

	.goals-button:hover {
		transform: translateY(-2px);
	}
</style>
