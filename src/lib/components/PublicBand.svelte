<script>
	import { clock } from '#lib/clock.svelte.js';
	import { lessonEnded, lessonSpan, pad } from '#lib/time.js';
	import logo from '#lib/assets/logo.svg';
	import Icon from './Icon.svelte';

	/**
	 * Zeitband der geteilten Seite: Arbeitsphase (schmales Band), Aufräumen (gelb-orange), Losgehen (groß,
	 * orange) oder ohne Stunde nur Logo und Uhrzeit. `phase` geht an die Seite (Auftrag treten zurück).
	 * @type {{ lesson: import('#lib/server/share.js').PublicLesson, phase?: 'none' | 'work' | 'soon' | 'go' }}
	 */
	let { lesson, phase = $bindable('none') } = $props();

	const now = $derived(clock.now ?? new Date());
	const span = $derived(lessonSpan(lesson.startTime, lesson.returnTime, now));
	const running = $derived(!!lesson.returnTime && !!span.end && !lessonEnded(span, now));
	const remaining = $derived(span.end ? span.end.getTime() - now.getTime() : 0);
	const minutes = $derived(Math.max(0, Math.ceil(remaining / 60000)));
	const before = $derived(!!span.start && now < span.start);
	const total = $derived(span.start && span.end ? span.end.getTime() - span.start.getTime() : 0);
	const progress = $derived(before || !total ? 0 : Math.min(1, Math.max(0, (now.getTime() - (span.start?.getTime() ?? 0)) / total)));

	$effect(() => {
		phase = !running
			? 'none'
			: remaining <= lesson.goMinutes * 60000
				? 'go'
				: remaining <= lesson.warnMinutes * 60000
					? 'soon'
					: 'work';
	});

	/** @param {Date} d */
	const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const end = $derived(lesson.returnTime.slice(0, 5));
	const big = $derived(minutes < 60 ? { value: String(minutes), unit: 'min' } : { value: `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`, unit: 'h' });
</script>

{#snippet brand()}
	<span class="brand"><img src={logo} alt="" width="28" height="28" /><span>class<span class="r">R</span>oom</span></span>
{/snippet}

{#snippet destination()}
	<Icon name="door" size={15} />
	{#if lesson.roomChange}Zurück in <b>{lesson.roomName}</b> um <b>{end}</b>{:else}Ende um <b>{end}</b>{/if}
{/snippet}

{#if phase === 'none'}
	<div class="pband none">
		{@render brand()}
		<span class="idle">Keine Stunde aktiv<span class="sep">{' · '}</span><span class="clock">jetzt <b>{hhmm(now)}</b></span></span>
	</div>
{:else if phase === 'go'}
	<div class="pband go" role="status">
		<span class="door"><Icon name="door" size={34} /></span>
		<div class="call">
			<span class="kicker">{remaining > 0 ? 'Jetzt losgehen' : 'Zeit um'}</span>
			<strong class="title">{lesson.roomChange ? `Zurück in ${lesson.roomName}` : 'Zusammenpacken'}</strong>
		</div>
		<div class="when">
			<span class="left"><b>{remaining > 0 ? big.value : '0'}</b>{' '}{big.unit}</span>
			<span class="sub"><span class="m">noch {remaining > 0 ? `${big.value} ${big.unit}` : '0 min'}{' · '}</span>um {end}<span class="d">{' · '}jetzt {hhmm(now)}</span></span>
			<span class="m now">jetzt {hhmm(now)}</span>
		</div>
	</div>
{:else}
	<div class="pband {phase}">
		{@render brand()}
		<span class="phase">
			{#if phase === 'soon'}🧹 Aufräumen{:else if before}Beginnt um {lesson.startTime.slice(0, 5)}{:else}Arbeitsphase{/if}
		</span>
		<span class="dest">{@render destination()}</span>
		<span class="big"><span class="m soon-only">noch{' '}</span><b>{big.value}</b>{' '}{big.unit}<span class="m work-only">{' '}übrig</span></span>
		<span class="now">jetzt {hhmm(now)}</span>
		<div class="bar" aria-hidden="true">
			<div class="fill" style:width="{progress * 100}%"></div>
			{#if progress > 0 && progress < 1}<span class="mark" style:left="{progress * 100}%"></span>{/if}
		</div>
	</div>
{/if}

<style>
	.pband {
		--band-text: var(--text);
		display: grid;
		align-items: center;
		color: var(--band-text);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		font-size: 1.05rem;
		font-weight: 800;
	}

	.brand img {
		border-radius: 7px;
	}

	.r {
		color: #f08a3c;
	}

	b {
		font-weight: 700;
	}

	/* --- Ohne Stunde --- */
	.none {
		grid-template-columns: auto 1fr;
		gap: 12px;
		padding: 2px 4px;
	}

	.idle {
		justify-self: end;
		color: var(--muted);
		font-size: 0.95rem;
	}

	.idle b {
		color: var(--text);
		font-size: 1.15rem;
	}

	/* --- Arbeitsphase / Aufräumen: schmales Band --- */
	.work,
	.soon {
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		grid-template-areas:
			'brand phase dest big'
			'brand bar bar now';
		gap: 6px 22px;
		padding: 14px 22px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.work .brand,
	.soon .brand {
		grid-area: brand;
		padding-right: 22px;
		border-right: 1px solid color-mix(in srgb, var(--band-text) 15%, transparent);
	}

	.phase {
		grid-area: phase;
		color: var(--lesson-accent);
		font-size: 0.9rem;
		font-weight: 700;
	}

	.dest {
		grid-area: dest;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.big {
		grid-area: big;
		justify-self: end;
		color: var(--muted);
		font-size: 0.95rem;
		line-height: 1;
	}

	.big b {
		color: var(--band-text);
		font-size: 1.9rem;
		font-weight: 800;
	}

	.now {
		grid-area: now;
		justify-self: end;
		color: var(--muted);
		font-size: 0.78rem;
	}

	.bar {
		grid-area: bar;
		position: relative;
		height: 12px;
		border-radius: 999px;
		background: var(--track);
	}

	.fill {
		height: 100%;
		border-radius: inherit;
		background: var(--lesson-accent);
		transition: width 1s linear;
	}

	.mark {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 3px;
		margin-left: -1px;
		border-radius: 2px;
		background: var(--band-text);
	}

	.m {
		display: none;
	}

	/* Aufräumen: ganzes Band gelb-orange, dunkle Schrift */
	.soon {
		--band-text: #1b1608;
		border-color: transparent;
		background: #f5b83d;
	}

	.soon .phase,
	.soon .big,
	.soon .now {
		color: var(--band-text);
	}

	.soon .dest {
		font-weight: 700;
	}

	.soon .bar {
		background: rgb(0 0 0 / 15%);
	}

	.soon .fill {
		background: #1b1608;
	}

	.soon .mark {
		background: #fff;
	}

	/* --- Losgehen: groß und orange --- */
	.go {
		--band-text: #1a0f04;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 30px;
		padding: 26px 28px;
		border: 3px solid #ffb27a;
		border-radius: var(--radius);
		background: #ff7a1a;
		box-shadow: 0 10px 40px rgb(255 122 26 / 35%);
	}

	.door {
		display: grid;
		place-items: center;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		background: rgb(0 0 0 / 12%);
	}

	.call {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.kicker {
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.title {
		font-size: clamp(1.6rem, 3.3vw, 2.7rem);
		font-weight: 900;
		line-height: 1.05;
	}

	.when {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		font-weight: 700;
	}

	.when .left {
		font-size: 1.2rem;
	}

	.when .left b {
		font-size: 3.2rem;
		font-weight: 900;
		line-height: 1;
	}

	.when .sub {
		font-size: 0.95rem;
	}

	/* --- Handy --- */
	@media (max-width: 640px) {
		.brand {
			display: none !important;
		}

		.none {
			grid-template-columns: 1fr;
			padding: 12px 14px;
			border-radius: 12px;
			background: color-mix(in srgb, var(--muted) 12%, var(--surface));
		}

		.idle {
			display: flex;
			justify-content: space-between;
			justify-self: stretch;
			font-size: 0.88rem;
		}

		.idle .sep {
			display: none;
		}

		.work,
		.soon {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'phase now'
				'big big'
				'bar bar'
				'dest dest';
			gap: 10px;
			padding: 16px;
		}

		.big {
			justify-self: start;
			font-size: 1.05rem;
		}

		.big b {
			font-size: 2.2rem;
		}

		.now {
			font-size: 0.85rem;
		}

		.work .work-only,
		.soon .soon-only {
			display: inline;
		}

		.soon .big {
			color: var(--band-text);
			font-size: 2.2rem;
			font-weight: 800;
		}

		.soon .big b {
			font-size: inherit;
		}

		.bar {
			height: 8px;
		}

		/* Aufräumen: ganze Breite oben, ohne Ecken */
		.soon {
			margin: calc(-1 * var(--gutter)) calc(-1 * var(--gutter)) 0;
			border-radius: 0;
			padding: 18px var(--gutter);
		}

		/* Losgehen füllt den Bildschirm */
		.go {
			grid-template-columns: 1fr;
			justify-items: center;
			gap: 14px;
			min-height: 55dvh;
			margin: calc(-1 * var(--gutter)) calc(-1 * var(--gutter)) 0;
			padding: 30px var(--gutter);
			border-radius: 0;
			text-align: center;
		}

		.door {
			order: 1;
			width: 64px;
			height: 64px;
		}

		.call {
			display: contents;
		}

		.kicker {
			order: 0;
		}

		.title {
			order: 2;
			font-size: 2.1rem;
		}

		.when {
			order: 3;
			align-items: center;
		}

		.when .left,
		.when .d {
			display: none;
		}

		.when .m {
			display: inline;
		}

		.when .sub {
			font-size: 1.05rem;
		}

		.when .now {
			font-size: 0.85rem;
			font-weight: 600;
			color: inherit;
			opacity: 0.8;
		}
	}
</style>
