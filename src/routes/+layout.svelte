<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { startClock } from '#lib/clock.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import Header from '#lib/components/Header.svelte';
	import BackgroundPicker from '#lib/components/BackgroundPicker.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import ActingAs from '#lib/components/ActingAs.svelte';

	let { data, children } = $props();

	// Im Test-Modus nur die großen Anzeigen, ohne Kopfzeile.
	const showHeader = $derived(!!data.user && !!data.settings && page.url.pathname !== '/test');

	// Hintergrund auf Auftrag, Stundenziele und Selbstlernen.
	const BACKGROUND_PAGES = ['/', '/stundenziele', '/selbstlernen'];
	const backgroundCss = $derived(
		BACKGROUND_PAGES.includes(page.url.pathname) ? (data.background?.css ?? null) : null
	);

	onMount(startClock);
</script>

{#if backgroundCss}
	<div class="page-bg" style:background={backgroundCss} aria-hidden="true"></div>
{/if}

{#if showHeader && data.user && data.settings}
	<Header user={data.user} settings={data.settings} warnMinutes={data.warnMinutes} goMinutes={data.goMinutes} noise={data.noise} />
{/if}

<main data-bg={backgroundCss ? '' : undefined}>
	{@render children()}
</main>

<Dialog />

{#if data.user?.actingAdmin}<ActingAs user={data.user} />{/if}

{#if data.user && data.background?.canChoose}
	<BackgroundPicker bind:open={ui.backgroundPicker} isTeacher={data.user.role === 'teacher'} />
{/if}

<style>
	/* Sonst malt der Body seine Farbe über den Hintergrund (z-index -1 liegt darunter). */
	:global(body:has(.page-bg)) {
		background: transparent;
	}

	.page-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
	}
</style>
