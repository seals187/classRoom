<script>
	import { onMount } from 'svelte';
	import { autoRefresh } from '#lib/refresh.js';
	import AssignmentBox from '#lib/components/AssignmentBox.svelte';
	import PublicBand from '#lib/components/PublicBand.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	// Geteilter Auftrag ohne Anmeldung: Zeitband der Stunde und der Auftrag – nur lesen, kein Menü.
	let { data } = $props();

	/** @type {'none' | 'work' | 'soon' | 'go'} */
	let phase = $state('none');
	// Losgehen: auf dem Handy ist der Auftrag eingeklappt und lässt sich aufklappen.
	let expanded = $state(false);
	$effect(() => {
		if (phase !== 'go') expanded = false;
	});

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

<div class="shared {phase}">
	{#if data.state === 'ok'}
		<PublicBand lesson={data.lesson} bind:phase />
		{#if phase === 'go'}
			<button class="collapsed" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
				<span><b>Auftrag</b>{#if data.assignment.title}{' · '}{data.assignment.title}{/if}</span>
				<span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
			</button>
		{/if}
		<div class="task" class:open={expanded}>
			<AssignmentBox assignment={data.assignment} canEdit={false} plain fileBase="/a/{data.code}/bild/" />
		</div>
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
	<div class="theme"><ThemeToggle /></div>
</div>

<style>
	:global(main:has(> .shared)) {
		padding-top: 24px;
	}

	.shared {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 1000px;
		margin: 0 auto;
	}

	/* Die Karte nur so hoch wie der Inhalt (nicht bis zum Seitenende). */
	.task :global(.assignment) {
		flex: none;
	}

	/* Losgehen: Auftrag tritt zurück */
	.go .task {
		opacity: 0.4;
		transition: opacity 0.3s;
	}

	.go .task.open {
		opacity: 1;
	}

	.collapsed {
		display: none;
	}

	/* Hell/Dunkel ohne Menü: unten am Ende der Seite. */
	.theme {
		display: flex;
		justify-content: flex-end;
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

	@media (max-width: 640px) {
		:global(main:has(> .shared)) {
			padding-top: var(--gutter);
		}

		.shared {
			gap: 14px;
		}

		/* Losgehen: Anweisung füllt den Bildschirm, der Auftrag ist eingeklappt. */
		.collapsed {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 14px 16px;
			border-radius: 12px;
			color: var(--muted);
			font-size: 1rem;
			text-align: left;
		}

		.collapsed b {
			color: var(--text);
		}

		.go .task {
			display: none;
			opacity: 1;
		}

		.go .task.open {
			display: block;
		}

		.theme {
			justify-content: center;
			padding-bottom: 8px;
		}
	}
</style>
