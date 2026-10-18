<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { NAV } from '$lib/nav.js';
	import Menu from './Menu.svelte';
	import TimeBars from './TimeBars.svelte';
	import AnalogClock from './AnalogClock.svelte';
	import logo from '$lib/assets/logo.svg';

	/**
	 * @type {{
	 *   user: import('$lib/server/auth.js').User,
	 *   settings: { roomName: string, startTime: string, returnTime: string },
	 *   warnMinutes: number
	 * }}
	 */
	let { user, settings, warnMinutes } = $props();

	const isTeacher = $derived(user.role === 'teacher');

	const studentLinks = NAV.filter((item) => !item.teacherOnly);

	let menuOpen = $state(false);
	let gearAutoHide = $state(false);

	onMount(() => {
		try {
			gearAutoHide = localStorage.getItem('gearAutoHide') === '1';
		} catch {
			// Kein localStorage verfügbar – Standard bleibt.
		}
	});
</script>

<header class="topbar">
	<div class="left">
		<div class="top-row">
			{#if isTeacher}
				<button
					class="gear"
					class:open={menuOpen}
					class:autohide={gearAutoHide}
					aria-label="Menü"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = !menuOpen)}
				>
					<Icon name="gear" size={30} />
				</button>
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

	<div class="center">
		<TimeBars {settings} {warnMinutes} />
	</div>

	<div class="right">
		<AnalogClock />
	</div>
</header>

{#if isTeacher}
	<Menu bind:open={menuOpen} bind:gearAutoHide {settings} {user} />
{/if}

<style>
	.topbar {
		display: grid;
		grid-template-columns: 1fr minmax(0, 680px) 1fr;
		align-items: start;
		gap: 24px;
		padding: 20px 24px 28px;
	}

	.right {
		justify-self: end;
	}

	.left {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}

	.top-row {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		text-decoration: none;
	}

	.brand img {
		width: 40px;
		height: 40px;
		border-radius: 9px;
	}

	.wordmark {
		font-size: 1.5rem;
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
		width: 58px;
		height: 58px;
		padding: 0;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: var(--shadow);
		color: var(--muted);
		transition:
			opacity 0.25s,
			transform 0.3s,
			color 0.2s;
	}

	.gear:hover,
	.gear.open {
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
