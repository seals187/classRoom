<script>
	import PageTitle from '#lib/components/PageTitle.svelte';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask } from '#lib/dialog.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { autoRefresh } from '#lib/refresh.js';
	import { atToday, pad } from '#lib/time.js';
	import AnalogClock from '#lib/components/AnalogClock.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let { data } = $props();

	const PRESETS = [15, 20, 30, 45, 60, 90];

	let customMinutes = $state(45);
	let untilTime = $state('');
	let error = $state('');

	const now = $derived(clock.now);
	const test = $derived(data.test);
	const nowMs = $derived(now?.getTime() ?? 0);
	const total = $derived(test ? test.end - test.start : 0);
	const elapsed = $derived(test && now ? Math.min(total, Math.max(0, nowMs - test.start)) : 0);
	const remaining = $derived(test && now ? test.end - nowMs : 0);
	const progress = $derived(total ? elapsed / total : 0);
	const status = $derived(
		!test || !now ? '' : remaining <= 0 ? 'over' : remaining <= data.warnMinutes * 60000 ? 'soon' : ''
	);

	/** Unter einer Stunde mm:ss, sonst h:mm:ss. @param {number} ms */
	function duration(ms) {
		const s = Math.max(0, Math.ceil(ms / 1000));
		const h = Math.floor(s / 3600);
		const rest = `${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
		return h ? `${h}:${rest}` : rest;
	}

	/** @param {number} ms */
	const clockOf = (ms) => {
		const d = new Date(ms);
		return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	};

	/** @param {() => Promise<unknown>} action */
	async function run(action) {
		error = '';
		try {
			await action();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
		await invalidateAll();
	}

	/** @param {number} minutes */
	function startFor(minutes) {
		if (!(minutes > 0)) {
			error = 'Bitte eine Dauer in Minuten angeben.';
			return;
		}
		const start = Date.now();
		run(() => api('/api/test', 'PUT', { start, end: start + minutes * 60000 }));
	}

	function startUntil() {
		if (!untilTime) {
			error = 'Bitte eine Endzeit wählen.';
			return;
		}
		const start = Date.now();
		const end = atToday(untilTime, new Date(start)).getTime();
		if (end <= start) {
			error = 'Die Endzeit liegt in der Vergangenheit.';
			return;
		}
		run(() => api('/api/test', 'PUT', { start, end }));
	}

	/** @param {number} minutes */
	function extend(minutes) {
		if (!test) return;
		// War die Zeit schon um, zählt die Verlängerung ab jetzt.
		const end = Math.max(test.end, Date.now()) + minutes * 60000;
		run(() => api('/api/test', 'PUT', { start: test.start, end }));
	}

	async function stop() {
		if (!(await ask({ title: 'Test beenden?', message: 'Die Anzeige wird zurückgesetzt.', confirmLabel: 'Beenden', danger: true }))) return;
		run(() => api('/api/test', 'DELETE'));
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else document.documentElement.requestFullscreen?.();
	}

	// Falls der Test auf einem anderen Gerät gestartet/verlängert wird.
	onMount(() => autoRefresh(10000));
</script>

<svelte:head>
	<title>Test · classRoom</title>
</svelte:head>

<div class="test" class:running={!!test}>
	<nav class="controls">
		<a href="/" class="ctrl">← Zurück</a>
		<span class="spacer"></span>
		{#if test}
			<button class="ctrl" onclick={() => extend(5)}>+5 Min</button>
			<button class="ctrl" onclick={() => extend(10)}>+10 Min</button>
		{/if}
		<button class="ctrl" onclick={toggleFullscreen}>Vollbild</button>
		{#if test}
			<button class="ctrl danger" onclick={stop}>Test beenden</button>
		{/if}
	</nav>

	<!-- Groß, aber so, dass beide Balken darunter noch auf den Bildschirm passen. -->
	<AnalogClock size={test ? 'min(38vh, 70vw)' : 'min(30vh, 60vw)'} showDate={false} />

	{#if test}
		<div class="bars">
			<div class="bar elapsed">
				<div class="fill" style:width="{progress * 100}%"></div>
				<div class="content">
					<span class="label">
						<Icon name="hourglass" size={36} />
						<span class="word">Vergangen</span>
						{#if now}<small>Start {clockOf(test.start)}</small>{/if}
					</span>
					<span class="value">{duration(elapsed)}</span>
				</div>
			</div>

			<div class="bar remaining {status}">
				<div class="fill" style:width="{(1 - progress) * 100}%"></div>
				<div class="content">
					<span class="label">
						<Icon name="timer" size={36} />
						<span class="word">{status === 'over' ? 'Zeit ist um' : 'Verbleibend'}</span>
						<!-- Erst im Browser rechnen – der Server läuft evtl. in einer anderen Zeitzone (Docker: UTC). -->
						{#if now}<small>Ende {clockOf(test.end)}</small>{/if}
					</span>
					<span class="value">{duration(remaining)}</span>
				</div>
			</div>
		</div>
	{:else}
		<section class="card setup">
			<PageTitle href="/test">Test starten</PageTitle>
			<div class="presets">
				{#each PRESETS as minutes (minutes)}
					<button class="primary" onclick={() => startFor(minutes)}>{minutes} Min</button>
				{/each}
			</div>
			<div class="row">
				<label>
					Eigene Dauer
					<span class="inline">
						<input type="number" min="1" max="480" bind:value={customMinutes} /> Min
					</span>
				</label>
				<button onclick={() => startFor(customMinutes)}>Starten</button>
			</div>
			<div class="row">
				<label>
					Oder bis
					<input type="time" bind:value={untilTime} />
				</label>
				<button onclick={startUntil}>Starten</button>
			</div>
		</section>
	{/if}

	{#if error}<p class="error">{error}</p>{/if}
</div>

<style>
	.test {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3vh;
		padding: 16px 4vw 4vh;
		margin: 0 calc(-1 * var(--gutter)) -32px;
		background: var(--bg);
	}

	/* Bedienelemente dezent, damit sie im Test nicht ablenken. */
	.controls {
		align-self: stretch;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		opacity: 0.35;
		transition: opacity 0.2s;
	}

	.controls:hover,
	.controls:focus-within,
	.test:not(.running) .controls {
		opacity: 1;
	}

	.spacer {
		flex: 1;
	}

	.ctrl {
		padding: 8px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font-size: 0.95rem;
		text-decoration: none;
	}

	.ctrl.danger:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.bars {
		width: min(1400px, 100%);
		display: flex;
		flex-direction: column;
		gap: 3vh;
	}

	.bar {
		position: relative;
		overflow: hidden;
		min-height: clamp(90px, 15vh, 170px);
		border: 2px solid var(--border);
		border-radius: 24px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--accent-soft);
		transition: width 1s linear;
	}

	.remaining .fill {
		background: var(--ok-soft);
	}

	.remaining.soon {
		border-color: var(--warn);
	}

	.remaining.soon .fill {
		background: var(--warn-soft);
	}

	.remaining.over {
		border-color: var(--danger);
		background: var(--danger-soft);
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 10px rgb(220 60 60 / 15%);
		}
	}

	.content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		min-height: inherit;
		padding: 0 clamp(20px, 3vw, 48px);
	}

	.label {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: clamp(1.4rem, 3vw, 2.6rem);
		font-weight: 700;
	}

	/* Feste Breite (passt für das längste Wort), damit „Start“ und „Ende“ in beiden Balken
	   an derselben Stelle beginnen. */
	.word {
		min-width: 6.6em;
	}

	.label small {
		font-size: 0.55em;
		font-weight: 500;
		color: var(--muted);
	}

	.elapsed .label {
		color: var(--accent);
	}

	.soon .label {
		color: var(--warn);
	}

	.over .label {
		color: var(--danger);
	}

	.value {
		font-size: clamp(2.6rem, 8vw, 7rem);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.setup {
		width: min(560px, 100%);
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.presets button {
		padding: 16px;
		font-size: 1.2rem;
		font-weight: 700;
	}

	.row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text);
	}

	input[type='number'] {
		width: 90px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}

	.error {
		margin: 0;
		color: var(--danger);
	}

	/* Smartphone: Beschriftung über der Zeit statt daneben. */
	@media (max-width: 640px) {
		.test {
			margin-bottom: -20px;
			padding: 12px var(--gutter) 24px;
		}

		.content {
			flex-direction: column;
			align-items: flex-start;
			justify-content: center;
			gap: 4px;
			padding: 12px 16px;
		}

		.word {
			min-width: 0;
		}

		.bar {
			border-radius: 16px;
		}

		.presets button {
			padding: 12px 8px;
			font-size: 1.05rem;
		}

		.row {
			flex-wrap: wrap;
		}
	}
</style>
