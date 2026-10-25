<script>
	import PageTitle from '#lib/components/PageTitle.svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask } from '#lib/dialog.svelte.js';
	import Icon from '#lib/components/Icon.svelte';

	let { data } = $props();

	// Der Admin verwaltet alle Lehrkräfte; alle anderen sehen nur ihr eigenes Konto.
	const isAdmin = $derived(!!data.user?.isAdmin);

	let username = $state('');
	let password = $state('');
	let message = $state('');
	let error = $state('');
	/** @type {Record<number, string>} */
	let newPasswords = $state({});

	/** @typedef {import('#lib/server/auth.js').TeacherInfo} Teacher */

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
	 * @param {Teacher} teacher
	 */
	function setPassword(e, teacher) {
		e.preventDefault();
		run(async () => {
			await api(`/api/teachers/${teacher.id}`, 'PATCH', { password: newPasswords[teacher.id] ?? '' });
			newPasswords[teacher.id] = '';
		}, teacher.id === data.user?.id ? 'Dein Passwort wurde geändert' : `Passwort von ${teacher.username} geändert`);
	}

	/**
	 * Das Häkchen ist schon die Rückmeldung – keine Meldung über der Liste, sonst springt sie bei jedem Klick.
	 * Nur ein Fehler wird angezeigt.
	 * @param {Teacher} teacher
	 * @param {'isAdmin' | 'seesAll'} right
	 * @param {boolean} value
	 */
	async function setRight(teacher, right, value) {
		try {
			await api(`/api/teachers/${teacher.id}`, 'PATCH', { [right]: value });
		} catch (err) {
			message = '';
			error = err instanceof Error ? err.message : String(err);
		}
		await invalidateAll();
	}

	/** @param {Teacher} teacher */
	async function remove(teacher) {
		const ok = await ask({
			title: `Lehrkraft ${teacher.username} löschen?`,
			message: 'Auftrag, Ziele, Gruppen und Einstellungen dieser Lehrkraft gehen verloren. Ihre Schüler ohne andere Lehrkraft gehen an den Admin.',
			confirmLabel: 'Löschen',
			danger: true
		});
		if (!ok) return;
		run(() => api(`/api/teachers/${teacher.id}`, 'DELETE'), `${teacher.username} gelöscht`);
	}
</script>

<svelte:head>
	<title>{isAdmin ? 'Lehrer verwalten' : 'Mein Konto'} · classRoom</title>
</svelte:head>

<section class="card">
	<PageTitle href="/lehrer">{isAdmin ? 'Lehrer verwalten' : 'Mein Konto'}</PageTitle>

	{#if isAdmin}
		<form class="add" onsubmit={add}>
			<input type="text" bind:value={username} placeholder="Benutzername" maxlength="40" autocapitalize="none" required />
			<input type="password" bind:value={password} placeholder="Passwort (mind. 8 Zeichen)" minlength="8" autocomplete="new-password" required />
			<button type="submit" class="primary">Hinzufügen</button>
		</form>
	{/if}
	{#if error}<p class="error">{error}</p>{/if}
	{#if message}<p class="message">{message}</p>{/if}

	<ul class:admin={isAdmin}>
		{#each data.teachers as teacher (teacher.id)}
			{@const self = teacher.id === data.user?.id}
			<li>
				<span class="who">
					<span class="username">
						{teacher.username}
						{#if self}<span class="badge">Du</span>{/if}
						{#if teacher.isAdmin}<span class="badge admin">Admin</span>{/if}
					</span>
					<small>{teacher.seesAll ? 'sieht alle Schüler' : `${teacher.students} Schüler`}</small>
				</span>
				{#if isAdmin}
					<span class="rights">
						<label title="Darf Lehrkräfte verwalten, Passwörter ändern und Schüler zuordnen">
							<input
								type="checkbox"
								checked={teacher.isAdmin}
								disabled={self}
								onchange={(e) => setRight(teacher, 'isAdmin', e.currentTarget.checked)}
							/>
							Admin
						</label>
						<label title="Sieht auf allen Seiten alle Schüler, nicht nur die eigenen">
							<input
								type="checkbox"
								checked={teacher.seesAll}
								onchange={(e) => setRight(teacher, 'seesAll', e.currentTarget.checked)}
							/>
							Sieht alle Schüler
						</label>
					</span>
				{/if}
				<form onsubmit={(e) => setPassword(e, teacher)}>
					<input
						type="password"
						bind:value={newPasswords[teacher.id]}
						placeholder={self ? 'Neues eigenes Passwort' : 'Neues Passwort'}
						aria-label="Neues Passwort für {teacher.username}"
						minlength="8"
						autocomplete="new-password"
						required
					/>
					<button type="submit">Setzen</button>
				</form>
				{#if isAdmin}
					<button
						class="icon-btn danger"
						aria-label="Lehrkraft {teacher.username} löschen"
						title="Löschen"
						disabled={self || data.teachers.length <= 1}
						onclick={() => remove(teacher)}
					>
						<Icon name="close" size={16} />
					</button>
				{/if}
			</li>
		{/each}
	</ul>
	{#if isAdmin}
		<ul class="info">
			<li><strong>Schüler:</strong> Jede Lehrkraft sieht nur ihre eigenen Schüler – außer bei „Sieht alle Schüler“. Zuordnen unter „Schüler verwalten“.</li>
			<li><strong>Getrennt:</strong> Auftrag, Ziele, Stunde, Wochenplan, Gruppen, Test, Ampel und Hintergrund hat jede Lehrkraft für sich.</li>
			<li>
				<strong>.env-Konto:</strong> Das Konto aus der <code>.env</code> (TEACHER_USERNAME) ist immer Admin und wird bei jedem
				Start auf das Passwort aus der <code>.env</code> gesetzt – so kommt man auch nach einem vergessenen Passwort wieder hinein.
			</li>
		</ul>
	{:else}
		<p class="hint">Andere Lehrkräfte und deren Passwörter verwaltet der Admin.</p>
	{/if}
</section>

<style>
	.card {
		max-width: 900px;
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
		grid-template-columns: 1fr 1.4fr;
		gap: 8px 12px;
		align-items: center;
	}

	ul.admin li {
		grid-template-columns: 1fr auto 1.2fr auto;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}

	li form {
		display: flex;
		gap: 8px;
	}

	li form input {
		flex: 1;
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.who small {
		color: var(--muted);
		font-size: 0.8rem;
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

	.badge.admin {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.rights {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.88rem;
	}

	.rights label {
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		cursor: pointer;
	}

	.info {
		gap: 4px;
		padding: 10px 14px;
		border-radius: 10px;
		background: var(--bg);
		color: var(--muted);
		font-size: 0.9rem;
	}

	.info li {
		display: block;
	}

	.info strong {
		color: var(--text);
		font-weight: 600;
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

	@media (max-width: 700px) {
		.add {
			grid-template-columns: 1fr;
		}

		/* Name und Löschen-Knopf oben, Rechte und Passwortfeld darunter über die ganze Breite. */
		li,
		ul.admin li {
			grid-template-columns: 1fr auto;
		}

		li .rights,
		li form {
			grid-column: 1 / -1;
		}

		li .icon-btn {
			grid-area: 1 / 2;
		}

		.rights {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 4px 16px;
		}
	}
</style>
