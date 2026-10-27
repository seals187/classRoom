<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import AssignmentBox from '#lib/components/AssignmentBox.svelte';

	// Geteilter Auftrag ohne Anmeldung: nur lesen, kein Menü, keine Navigation.
	let { data } = $props();

	// Alle 30 s nachladen, damit Änderungen der Lehrkraft erscheinen – nach einem beendeten Link nicht mehr.
	/** @type {(() => void) | null} */
	let stop = null;
	onMount(() => {
		stop = autoRefresh(30000);
		return () => stop?.();
	});
	$effect(() => {
		if (data.state !== 'ok') stop?.();
	});
</script>

<svelte:head>
	<title>{data.state === 'ok' && data.assignment.title ? data.assignment.title : 'Auftrag'} · classRoom</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<div class="shared">
	{#if data.state === 'ok'}
		<AssignmentBox assignment={data.assignment} canEdit={false} fileBase="/a/{data.code}/bild/" />
	{:else}
		<div class="gone">
			<h1>{data.state === 'blocked' ? 'Zu viele ungültige Versuche' : 'Dieser Link ist nicht mehr gültig'}</h1>
			<p>
				{data.state === 'blocked'
					? 'Bitte in ein paar Minuten nochmals versuchen.'
					: 'Die Lehrkraft hat das Teilen beendet oder der Link ist abgelaufen.'}
			</p>
		</div>
	{/if}
</div>

<style>
	:global(main:has(> .shared)) {
		display: flex;
		flex-direction: column;
		padding-top: var(--gutter);
	}

	.shared {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.gone {
		margin: 18vh auto 0;
		max-width: 420px;
		padding: 0 8px;
		text-align: center;
	}

	h1 {
		font-size: 1.4rem;
	}

	p {
		margin-top: 10px;
		color: var(--muted);
		line-height: 1.5;
	}
</style>
