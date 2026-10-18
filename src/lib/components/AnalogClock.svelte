<script>
	import { clock } from '$lib/clock.svelte.js';
	import { formatDate, pad } from '$lib/time.js';

	/** @type {{ size?: string, showDate?: boolean }} */
	// Groß genug, um am Beamer auch von hinten lesbar zu sein.
	let { size = 'clamp(160px, 17vw, 270px)', showDate = true } = $props();

	const WEEKDAYS =['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
	const ticks = Array.from({ length: 60 }, (_, i) => i);
	const numbers = Array.from({ length: 12 }, (_, i) => i + 1);

	const now = $derived(clock.now);
	const seconds = $derived(now ? now.getSeconds() : 0);
	const minutes = $derived(now ? now.getMinutes() + seconds / 60 : 0);
	const hours = $derived(now ? (now.getHours() % 12) + minutes / 60 : 0);
</script>

<div class="clock">
	<svg
		style:width={size}
		viewBox="0 0 200 200"
		role="img"
		aria-label={now ? `Uhrzeit ${pad(now.getHours())}:${pad(now.getMinutes())}` : 'Uhrzeit'}
	>
		<circle class="face" cx="100" cy="100" r="96" />
		{#each ticks as i (i)}
			<line
				class:major={i % 5 === 0}
				x1="100"
				y1="10"
				x2="100"
				y2={i % 5 === 0 ? 24 : 17}
				transform="rotate({i * 6} 100 100)"
			/>
		{/each}
		{#each numbers as n (n)}
			{@const angle = (n * Math.PI) / 6}
			<text x={100 + 64 * Math.sin(angle)} y={100 - 64 * Math.cos(angle)}>{n}</text>
		{/each}
		{#if now}
			<line class="hand hour" x1="100" y1="112" x2="100" y2="54" transform="rotate({hours * 30} 100 100)" />
			<line class="hand minute" x1="100" y1="116" x2="100" y2="30" transform="rotate({minutes * 6} 100 100)" />
			<line class="hand second" x1="100" y1="124" x2="100" y2="22" transform="rotate({seconds * 6} 100 100)" />
		{/if}
		<circle class="pin" cx="100" cy="100" r="5" />
	</svg>

	{#if showDate}
		<div class="date">
			<span class="weekday">{now ? WEEKDAYS[now.getDay()] : ''}</span>
			<span class="value">{now ? formatDate(now) : '--/--/----'}</span>
		</div>
	{/if}
</div>

<style>
	.clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	svg {
		height: auto;
		filter: drop-shadow(0 4px 10px rgb(20 30 60 / 12%));
	}

	.face {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 3;
	}

	line {
		stroke: var(--muted);
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	line.major {
		stroke: var(--text);
		stroke-width: 3;
	}

	text {
		font-size: 17px;
		font-weight: 600;
		fill: var(--text);
		text-anchor: middle;
		dominant-baseline: central;
	}

	.hand {
		stroke: var(--text);
	}

	.hour {
		stroke-width: 7;
	}

	.minute {
		stroke-width: 4.5;
	}

	.second {
		stroke: var(--danger);
		stroke-width: 2;
	}

	.pin {
		fill: var(--danger);
	}

	.date {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.2;
	}

	.weekday {
		font-size: clamp(1rem, 1.4vw, 1.5rem);
		font-weight: 600;
		color: var(--muted);
	}

	.date .value {
		font-size: clamp(1.6rem, 2.4vw, 2.6rem);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
</style>
