<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { startClock } from '#lib/clock.svelte.js';
	import Header from '#lib/components/Header.svelte';

	let { data, children } = $props();

	// Im Test-Modus nur die großen Anzeigen, ohne Kopfzeile.
	const showHeader = $derived(!!data.user && !!data.settings && page.url.pathname !== '/test');

	onMount(startClock);
</script>

{#if showHeader && data.user && data.settings}
	<Header user={data.user} settings={data.settings} warnMinutes={data.warnMinutes} noise={data.noise} />
{/if}

<main>
	{@render children()}
</main>
