<script>
	import { clock } from '#lib/clock.svelte.js';
	import { atToday, formatDuration, formatRemaining } from '#lib/time.js';
	import Icon from './Icon.svelte';

	/** @type {{ settings: { roomName: string, startTime: string, returnTime: string }, warnMinutes: number }} */
	let { settings, warnMinutes } = $props();

	const now = $derived(clock.now);
	const start = $derived(now && settings.startTime ? atToday(settings.startTime, now) : null);
	const end = $derived(now && settings.returnTime ? atToday(settings.returnTime, now) : null);

	const elapsed = $derived(now && start ? Math.max(0, now.getTime() - start.getTime()) : null);
	const total = $derived(start && end && end > start ? end.getTime() - start.getTime() : null);
	const progress = $derived(total && elapsed !== null ? Math.min(1, elapsed / total) : 0);
	const remaining = $derived(now && end ? end.getTime() - now.getTime() : null);

	const remainingFraction = $derived(remaining === null || remaining <= 0 ? 0 : total ? 1 - progress : 1);
	const status = $derived(
		remaining === null ? '' : remaining <= 0 ? 'over' : remaining <= warnMinutes * 60000 ? 'soon' : ''
	);
</script>

<div class="bars">
	<div class="bar elapsed" title="Abgelaufene Zeit seit Beginn">
		<div class="fill" style:width="{progress * 100}%"></div>
		<div class="content">
			<Icon name="hourglass" size={28} />
			<span class="value">{elapsed === null ? '--:--:--' : formatDuration(elapsed)}</span>
			{#if total}<span class="sub">{Math.round(progress * 100)} %</span>{/if}
		</div>
	</div>

	<div class="bar return {status}" title="Rückkehr ins Hauptschulzimmer">
		<div class="fill" style:width="{remainingFraction * 100}%"></div>
		<div class="content">
			<span class="room">{settings.roomName}</span>
			<span class="sep">·</span>
			<span>zurück um <strong class="value">{settings.returnTime ? settings.returnTime.slice(0, 5) : '--:--'}</strong></span>
			{#if remaining !== null}<span class="sub">{formatRemaining(remaining)}</span>{/if}
		</div>
	</div>
</div>

<style>
	.bars {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.bar {
		position: relative;
		overflow: hidden;
		min-height: 64px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--accent-soft);
		transition: width 1s linear;
	}

	.return .fill {
		background: var(--ok-soft);
	}

	.return.soon .fill {
		background: var(--warn-soft);
	}

	.return.over {
		border-color: var(--danger);
		background: var(--danger-soft);
	}

	.content {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 4px 12px;
		min-height: 64px;
		padding: 8px 18px;
		font-size: 1.35rem;
		text-align: center;
	}

	.elapsed .content {
		color: var(--accent);
	}

	.value {
		font-size: 1.6rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.room {
		font-weight: 700;
	}

	.sep {
		color: var(--muted);
	}

	.sub {
		font-size: 1rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.soon .sub {
		color: var(--warn);
		font-weight: 600;
	}

	.over .sub {
		color: var(--danger);
		font-weight: 700;
	}

	@media (max-width: 640px) {
		.bars {
			gap: 8px;
		}

		.bar,
		.content {
			min-height: 46px;
		}

		.content {
			gap: 2px 8px;
			padding: 6px 12px;
			font-size: 1rem;
		}

		.value {
			font-size: 1.2rem;
		}

		.sub {
			font-size: 0.85rem;
		}
	}
</style>
