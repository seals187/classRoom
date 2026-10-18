<script>
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$lib/api.js';
	import { formatClock } from '$lib/time.js';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { NAV } from '$lib/nav.js';

	/**
	 * @type {{
	 *   open: boolean,
	 *   gearAutoHide: boolean,
	 *   settings: { roomName: string, startTime: string, returnTime: string },
	 *   user: import('$lib/server/auth.js').User
	 * }}
	 */
	let { open = $bindable(false), gearAutoHide = $bindable(false), settings, user } = $props();

	const links = NAV;

	let form = $state({ roomName: '', startTime: '', returnTime: '' });
	let saving = $state(false);
	let message = $state('');

	// Beim Öffnen (und nach dem Speichern) die aktuellen Werte übernehmen.
	$effect(() => {
		if (open) form = { ...settings };
	});

	/** @param {() => Promise<unknown>} action */
	async function run(action, done = 'Gespeichert') {
		saving = true;
		message = '';
		try {
			await action();
			await invalidateAll();
			message = done;
		} catch (err) {
			message = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	/** @param {SubmitEvent} e */
	function save(e) {
		e.preventDefault();
		run(() => api('/api/settings', 'PUT', form));
	}

	function startNow() {
		form.startTime = formatClock(new Date());
		run(() => api('/api/settings', 'PUT', form), 'Stunde gestartet');
	}

	function clearTimes() {
		form.startTime = '';
		form.returnTime = '';
		run(() => api('/api/settings', 'PUT', form), 'Zeiten zurückgesetzt');
	}

	function persistGear() {
		try {
			localStorage.setItem('gearAutoHide', gearAutoHide ? '1' : '0');
		} catch {
			// Ignorieren – gilt dann nur bis zum Neuladen.
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

{#if open}
	<button class="backdrop" tabindex="-1" aria-label="Menü schließen" onclick={() => (open = false)}></button>

	<aside class="drawer" aria-label="Menü">
		<div class="drawer-head">
			<h2>Menü</h2>
			<button class="icon-btn" aria-label="Menü schließen" onclick={() => (open = false)}>
				<Icon name="close" size={18} />
			</button>
		</div>

		<nav>
			{#each links as link (link.href)}
				<a
					href={link.href}
					class:active={page.url.pathname === link.href}
					onclick={() => (open = false)}
				>
					<Icon name={link.icon} size={20} />
					{link.label}
				</a>
			{/each}
		</nav>

		<form onsubmit={save}>
			<h3>Unterrichtsstunde</h3>
			<label>
				Klassenraum
				<input type="text" bind:value={form.roomName} maxlength="60" required />
			</label>
			<label>
				Beginn
				<span class="row">
					<input type="time" step="1" bind:value={form.startTime} />
					<button type="button" onclick={startNow} disabled={saving}>Jetzt starten</button>
				</span>
			</label>
			<label>
				Zurück ins Hauptschulzimmer um
				<input type="time" bind:value={form.returnTime} />
			</label>
			<button type="submit" class="primary" disabled={saving}>Speichern</button>
			<button type="button" onclick={clearTimes} disabled={saving} title="Beginn und Rückkehrzeit leeren">
				Zeiten zurücksetzen
			</button>
			{#if message}<p class="message">{message}</p>{/if}
		</form>

		<label class="check">
			<input type="checkbox" bind:checked={gearAutoHide} onchange={persistGear} />
			Zahnrad ausblenden (erscheint beim Darüberfahren)
		</label>

		<div class="theme">
			<span>Darstellung</span>
			<ThemeToggle />
		</div>

		<form class="logout" method="POST" action="/logout">
			<span>Angemeldet als <strong>{user.username}</strong></span>
			<button type="submit">Abmelden</button>
		</form>
	</aside>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: rgb(20 30 50 / 25%);
		cursor: default;
	}

	.drawer {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: 11;
		width: min(360px, 100vw);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 20px;
		background: var(--surface);
		box-shadow: 4px 0 24px rgb(20 30 60 / 15%);
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 10px;
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
	}

	nav a:hover {
		background: var(--bg);
	}

	nav a.active {
		background: var(--accent-soft);
		color: var(--accent);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}

	h3 {
		font-size: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	label input {
		color: var(--text);
	}

	.row {
		display: flex;
		gap: 8px;
	}

	.row input {
		flex: 1;
	}

	.message {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.check {
		flex-direction: row;
		align-items: center;
		gap: 10px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}

	.theme {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.logout {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: auto;
		font-size: 0.9rem;
		color: var(--muted);
	}
</style>
