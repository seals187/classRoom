<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { NAV } from '#lib/nav.js';
	import Menu from './Menu.svelte';
	import TimeBars from './TimeBars.svelte';
	import AnalogClock from './AnalogClock.svelte';
	import logo from '#lib/assets/logo.svg';
	import NoiseLight from './NoiseLight.svelte';
	import { noise as noiseState, watchRemoteNoise } from '#lib/noise.svelte.js';
	import { ui } from '#lib/ui.svelte.js';

	/**
	 * @type {{
	 *   user: import('#lib/server/auth.js').User,
	 *   settings: { roomName: string, startTime: string, returnTime: string },
	 *   warnMinutes: number,
	 *   noise: import('#lib/server/db.js').NoiseSettings | { enabled: boolean } | null
	 * }}
	 */
	let { user, settings, warnMinutes, noise } = $props();

	const isTeacher = $derived(user.role === 'teacher');

	// Verwaltungsseiten brauchen keine Unterrichtsanzeigen – nur Menü und Logo.
	const ADMIN_PAGES = ['/schueler', '/lehrer'];
	// Im Fokus-Modus (Auftrag bearbeiten) ebenfalls ausblenden, damit der Editor ganz sichtbar ist.
	const showLessonInfo = $derived(!ADMIN_PAGES.includes(page.url.pathname) && !ui.focus);

	const studentLinks = NAV.filter((item) => !item.teacherOnly);

	let menuOpen = $state(false);
	let gearAutoHide = $state(false);

	// Schüler sehen die Ampel nur, solange das Lehrer-Gerät misst.
	const showNoise = $derived(Boolean(noise?.enabled) && (isTeacher || noiseState.active));

	onMount(() => {
		try {
			gearAutoHide = localStorage.getItem('gearAutoHide') === '1';
		} catch {
			// Kein localStorage verfügbar – Standard bleibt.
		}
		if (!isTeacher && noise?.enabled) return watchRemoteNoise();
	});
</script>

<header class="topbar">
	<div class="left">
		<!-- Zahnrad und Logo in einer gemeinsamen Leiste -->
		<div class="brandbar">
			{#if isTeacher}
				<button
					class="gear"
					class:open={menuOpen}
					class:autohide={gearAutoHide}
					aria-label="Menü"
					aria-expanded={menuOpen}
					title="Menü"
					onclick={() => (menuOpen = !menuOpen)}
				>
					<Icon name="gear" size={24} />
				</button>
				<span class="divider" aria-hidden="true"></span>
			{/if}
			<a href="/" class="brand" aria-label="classRoom – zur Startseite">
				<img src={logo} alt="" width="40" height="40" />
				<span class="wordmark">class<span class="r">R</span>oom</span>
			</a>
		</div>
		{#if !isTeacher}
			<div class="me">
				<span class="name">{user.displayName}</span>
				<nav>
					{#each studentLinks as link (link.href)}
						<a href={link.href} class:active={page.url.pathname === link.href}>
							<Icon name={link.icon} size={18} />
							{link.short ?? link.label}
						</a>
					{/each}
				</nav>
				<ThemeToggle />
				<form method="POST" action="/logout">
					<button type="submit">Abmelden</button>
				</form>
			</div>
		{/if}
	</div>

	{#if showLessonInfo}
		<div class="center">
			<TimeBars {settings} {warnMinutes} />
		</div>

		<!-- Ampel und Uhr in einer gemeinsamen Karte, passend zur Leiste oben links -->
		<div class="right">
			{#if showNoise}
				<NoiseLight remote={!isTeacher} />
				<span class="divider tall" aria-hidden="true"></span>
			{/if}
			<AnalogClock />
		</div>
	{/if}
</header>

{#if isTeacher}
	<Menu bind:open={menuOpen} bind:gearAutoHide {settings} {user} noiseSettings={noise} />
{/if}

<style>
	.topbar {
		display: grid;
		grid-template-columns: 1fr minmax(0, 680px) 1fr;
		align-items: start;
		gap: 24px;
		padding: 20px 24px 28px;
	}

	/* Senkrechte Ampel links neben der Uhr, beide in einer Karte im Stil der Logo-Leiste. */
	.right {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: clamp(14px, 1.4vw, 24px);
		padding: clamp(12px, 1.2vw, 18px) clamp(14px, 1.4vw, 22px);
		border: 1px solid var(--border);
		border-radius: 20px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.left {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}

	/* Eine Leiste für Menü-Knopf und Logo, im Stil der übrigen Karten. */
	.brandbar {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px 6px 6px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	/* Ohne Zahnrad (Schüler) gleichmäßiger Rand. */
	.brandbar:not(:has(.gear)) {
		padding-left: 12px;
	}

	.divider {
		width: 1px;
		height: 28px;
		background: var(--border);
	}

	.divider.tall {
		align-self: stretch;
		height: auto;
		margin: 8px 0;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 2px 4px;
		border-radius: 10px;
		color: var(--text);
		text-decoration: none;
	}

	.brand img {
		width: 38px;
		height: 38px;
		border-radius: 9px;
	}

	.wordmark {
		font-size: 1.4rem;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	/* Wie im Banner: das „R“ in Orange. */
	.wordmark .r {
		color: #f08a3c;
	}

	.gear {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--muted);
		transition:
			opacity 0.25s,
			transform 0.3s,
			color 0.2s,
			background 0.2s;
	}

	.gear:hover,
	.gear.open {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.gear.open {
		transform: rotate(60deg);
	}

	/* Ausgeblendet, bis man mit der Maus darüberfährt oder es per Tastatur/Touch fokussiert. */
	.gear.autohide:not(:hover):not(:focus-visible):not(.open) {
		opacity: 0;
	}

	.me {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.name {
		font-weight: 700;
		font-size: 1.1rem;
	}

	.me nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-self: stretch;
	}

	.me nav a {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		color: var(--text);
		text-decoration: none;
	}

	.me nav a:hover {
		background: var(--bg);
	}

	.me nav a.active {
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 600;
	}

	@media (max-width: 900px) {
		.topbar {
			grid-template-columns: auto 1fr;
		}

		.center {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
