<script>
	import { onMount } from 'svelte';
	import { noise, startNoise, wantsAutoStart } from '#lib/noise.svelte.js';

	/** @type {Array<import('#lib/noise.svelte.js').NoiseStatus>} */
	const LAMPS = ['red', 'yellow', 'green'];
	const LABELS = { red: 'Zu laut', yellow: 'Etwas leiser', green: 'Gut' };

	// War die Ampel schon einmal an, ohne erneuten Klick starten (Erlaubnis ist dann bereits erteilt).
	onMount(() => {
		if (!noise.active && wantsAutoStart()) startNoise();
	});
</script>

<div class="wrap">
	<div
		class="ampel"
		class:inactive={!noise.active}
		role="img"
		aria-label={noise.active ? `Lautstärke-Ampel: ${LABELS[noise.status]}` : 'Lautstärke-Ampel aus'}
	>
		{#each LAMPS as color (color)}
			<span class="lamp {color}" class:on={noise.active && noise.status === color}></span>
		{/each}
		{#if !noise.active}
			<button class="start" onclick={startNoise} title="Mikrofon für die Lautstärke-Ampel einschalten">
				🎤 Ampel starten
			</button>
		{/if}
	</div>
	{#if noise.error}<p class="error">{noise.error}</p>{/if}
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	/* Senkrecht wie eine echte Ampel; Gehäuse bleibt in beiden Themes dunkel. */
	.ampel {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: clamp(6px, 0.7vw, 12px);
		padding: clamp(8px, 0.8vw, 12px);
		border-radius: 999px;
		background: #1b2029;
		box-shadow:
			inset 0 2px 6px rgb(0 0 0 / 50%),
			var(--shadow);
	}

	/* Drei Lampen zusammen etwa so hoch wie die Uhr daneben. */
	.lamp {
		width: clamp(40px, 4.2vw, 68px);
		aspect-ratio: 1;
		border-radius: 50%;
		transition:
			background 0.25s,
			box-shadow 0.25s;
	}

	.lamp.red {
		background: #4a1c1c;
	}

	.lamp.yellow {
		background: #4a3c14;
	}

	.lamp.green {
		background: #173a26;
	}

	.lamp.red.on {
		background: #ff3b3b;
		box-shadow: 0 0 24px 6px rgb(255 59 59 / 65%);
	}

	.lamp.yellow.on {
		background: #ffc531;
		box-shadow: 0 0 24px 6px rgb(255 197 49 / 60%);
	}

	.lamp.green.on {
		background: #2fdc76;
		box-shadow: 0 0 24px 6px rgb(47 220 118 / 55%);
	}

	.inactive .lamp {
		opacity: 0.45;
	}

	.start {
		position: absolute;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		white-space: nowrap;
		padding: 6px 10px;
		font-size: 0.85rem;
		border-radius: 999px;
		font-weight: 600;
		box-shadow: var(--shadow);
	}

	.error {
		max-width: 160px;
		margin: 0;
		color: var(--danger);
		font-size: 0.8rem;
		text-align: center;
	}
</style>
