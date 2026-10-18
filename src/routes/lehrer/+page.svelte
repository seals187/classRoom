<script>
	import PageTitle from '#lib/components/PageTitle.svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask } from '#lib/dialog.svelte.js';
	import Icon from '#lib/components/Icon.svelte';

	let { data } = $props();

	let username = $state('');
	let password = $state('');
	let message = $state('');
	let error = $state('');
	/** @type {Record<number, string>} */
	let newPasswords = $state({});

	/**
	 * @param {() => Promise<unknown>} action
	 * @param {string} done
	 */
	async function run(action, done) {
		error = '';
		message = '';
		try {
			await action();
			message = done;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
		await invalidateAll();
	}

	/** @param {SubmitEvent} e */
	function add(e) {
		e.preventDefault();
		run(async () => {
			await api('/api/teachers', 'POST', { username, password });
			username = '';
			password = '';
		}, 'Lehrkraft angelegt');
	}

	/**
	 * @param {SubmitEvent} e
	 * @param {{ id: number, username: string }} teacher
	 */
	function setPassword(e, teacher) {
		e.preventDefault();
		run(async () => {
			await api(`/api/teachers/${teacher.id}`, 'PATCH', { password: newPasswords[teacher.id] ?? '' });
			newPasswords[teacher.id] = '';
		}, `Passwort von ${teacher.username} geändert`);
	}

	/** @param {{ id: number, username: string }} teacher */
	async function remove(teacher) {
		const ok = await ask({ title: `Lehrkraft ${teacher.username} löschen?`, confirmLabel: 'Löschen', danger: true });
		if (!ok) return;
		run(() => api(`/api/teachers/${teacher.id}`, 'DELETE'), `${teacher.username} gelöscht`);
	}
</script>

<svelte:head>
	<title>Lehrer verwalten · classRoom</title>
</svelte:head>

<section class="card">
	<PageTitle href="/lehrer">Lehrer verwalten</PageTitle>

	<form class="add" onsubmit={add}>
		<input type="text" bind:value={username} placeholder="Benutzername" maxlength="40" autocapitalize="none" required />
		<input type="password" bind:value={password} placeholder="Passwort (mind. 8 Zeichen)" minlength="8" autocomplete="new-password" required />
		<button type="submit" class="primary">Hinzufügen</button>
	</form>
	{#if error}<p class="error">{error}</p>{/if}
	{#if message}<p class="message">{message}</p>{/if}

	<ul>
		{#each data.teachers as teacher (teacher.id)}
			<li>
				<span class="username">
					{teacher.username}
					{#if teacher.id === data.user?.id}<span class="badge">Du</span>{/if}
				</span>
				<form onsubmit={(e) => setPassword(e, teacher)}>
					<input
						type="password"
						bind:value={newPasswords[teacher.id]}
						placeholder="Neues Passwort"
						minlength="8"
						autocomplete="new-password"
						required
					/>
					<button type="submit">Setzen</button>
				</form>
				<button
					class="icon-btn danger"
					aria-label="Lehrkraft löschen"
					disabled={teacher.id === data.user?.id || data.teachers.length <= 1}
					onclick={() => remove(teacher)}
				>
					<Icon name="close" size={16} />
				</button>
			</li>
		{/each}
	</ul>
	<p class="hint">
		Das Konto aus der <code>.env</code> (TEACHER_USERNAME) wird bei jedem Start der App auf das Passwort aus der
		<code>.env</code> gesetzt – so kommt man auch nach einem vergessenen Passwort wieder hinein.
	</p>
</section>

<style>
	.card {
		max-width: 760px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.add {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 8px;
	}

	input[type='password'] {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		min-width: 0;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 1fr 1.4fr auto;
		gap: 8px;
		align-items: center;
	}

	li form {
		display: flex;
		gap: 8px;
	}

	li form input {
		flex: 1;
	}

	.username {
		font-family: ui-monospace, monospace;
		font-weight: 600;
	}

	.badge {
		margin-left: 6px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-family: system-ui, sans-serif;
		font-size: 0.75rem;
	}

	.hint,
	.message {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
	}

	@media (max-width: 600px) {
		.add {
			grid-template-columns: 1fr;
		}

		/* Name und Löschen-Knopf oben, Passwortfeld darunter über die ganze Breite. */
		li {
			grid-template-columns: 1fr auto;
		}

		li form {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
