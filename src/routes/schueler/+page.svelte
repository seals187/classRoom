<script>
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/api.js';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { autoRefresh } from '$lib/refresh.js';
	import { onMount } from 'svelte';
	import { suggestUsername } from '$lib/username.js';

	let { data } = $props();

	const EMPTY = { done: 0, total: 0 };

	// Schüler legen Ziele auf ihren Geräten an – Zahlen regelmäßig nachladen.
	onMount(() => autoRefresh(10000));

	let firstName = $state('');
	let lastName = $state('');
	// Benutzername wird aus dem Namen vorbelegt, bis man ihn selbst ändert (leeren → wieder automatisch).
	let customUsername = $state('');
	const taken = $derived(new Set(data.usernames));
	const suggestedUsername = $derived(
		firstName.trim() || lastName.trim() ? suggestUsername(firstName, lastName, (name) => taken.has(name)) : ''
	);
	const username = $derived(customUsername.trim() ? customUsername : suggestedUsername);
	let error = $state('');
	/** @type {{ name: string, username: string, password: string } | null} */
	let credentials = $state(null);
	/** @type {HTMLInputElement | undefined} */
	let firstInput = $state();

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

	/** @param {SubmitEvent} e */
	async function add(e) {
		e.preventDefault();
		await run(async () => {
			const result = await api('/api/students', 'POST', { firstName, lastName, username });
			credentials = { name: `${result.student.firstName} ${result.student.lastName}`, ...result.credentials };
			firstName = '';
			lastName = '';
			customUsername = '';
		});
		firstInput?.focus();
	}

	// --- Bearbeiten eines bestehenden Schülers (immer nur eine Zeile) ---

	/** @type {import('$lib/server/db.js').Student | null} */
	let editing = $state(null);
	let draft = $state({ firstName: '', lastName: '', customUsername: '' });

	// Kürzel folgt dem geänderten Namen, solange man es nicht selbst überschreibt.
	// Das bisherige Kürzel des Schülers zählt dabei nicht als vergeben.
	const draftUsername = $derived.by(() => {
		if (!editing) return '';
		if (draft.customUsername.trim()) return draft.customUsername;
		if (!editing.username) return '';
		const unchanged = draft.firstName.trim() === editing.firstName && draft.lastName.trim() === editing.lastName;
		if (unchanged) return editing.username;
		const own = editing.username.toLowerCase();
		return suggestUsername(draft.firstName, draft.lastName, (name) => name !== own && taken.has(name));
	});

	/** @param {import('$lib/server/db.js').Student} student */
	function startEdit(student) {
		editing = student;
		draft = { firstName: student.firstName, lastName: student.lastName, customUsername: '' };
		error = '';
	}

	/** @param {SubmitEvent} e */
	async function saveEdit(e) {
		e.preventDefault();
		if (!editing) return;
		const { id, username } = editing;
		const changes = { firstName: draft.firstName, lastName: draft.lastName, ...(username ? { username: draftUsername } : {}) };
		let ok = false;
		await run(async () => {
			await api(`/api/students/${id}`, 'PATCH', changes);
			ok = true;
		});
		if (ok) editing = null;
	}

	/** @param {import('$lib/server/db.js').Student} student */
	function resetPassword(student) {
		const hasLogin = !!student.username;
		if (hasLogin && !confirm(`Neues Passwort für ${student.firstName} ${student.lastName} erzeugen? Das alte gilt dann nicht mehr.`)) return;
		run(async () => {
			const result = await api(`/api/students/${student.id}/password`, 'POST');
			credentials = { name: `${student.firstName} ${student.lastName}`, ...result };
		});
	}

	/** @param {import('$lib/server/db.js').Student} student */
	function remove(student) {
		if (!confirm(`${student.firstName} ${student.lastName} wirklich löschen? Zugang und alle Ziele gehen dabei verloren.`)) return;
		run(() => api(`/api/students/${student.id}`, 'DELETE'));
	}
</script>

{#snippet counts(id)}
	{@const stats = data.goalStats[id] ?? { lesson: EMPTY, self: EMPTY }}
	{#each [stats.lesson, stats.self] as count, i (i)}
		<span
			class="count"
			class:complete={count.total > 0 && count.done === count.total}
			title="{i === 0 ? 'Stundenziele' : 'Selbstlern-Ziele'}: {count.done} von {count.total} erledigt"
		>
			{count.done}/{count.total}
		</span>
	{/each}
{/snippet}

<svelte:head>
	<title>Schüler verwalten · classRoom</title>
</svelte:head>

<section class="card">
	<div class="head">
		<PageTitle href="/schueler">Schüler verwalten</PageTitle>
		<span class="count-badge" aria-label="{data.students.length} Schüler">
			<strong>{data.students.length}</strong> Schüler
		</span>
	</div>

	<form class="add" onsubmit={add}>
		<input type="text" bind:this={firstInput} bind:value={firstName} placeholder="Vorname" maxlength="60" required />
		<input type="text" bind:value={lastName} placeholder="Nachname" maxlength="60" required />
		<input
			type="text"
			class="username"
			value={username}
			oninput={(e) => (customUsername = e.currentTarget.value)}
			placeholder="Benutzername"
			title="Wird automatisch vorgeschlagen (3 Buchstaben Vorname + 2 Nachname) und kann geändert werden"
			aria-label="Benutzername"
			maxlength="40"
			autocapitalize="none"
			spellcheck="false"
		/>
		<button type="submit" class="primary">Hinzufügen</button>
	</form>
	<ul class="info">
		<li><strong>Kürzel:</strong> wird aus dem Namen vorgeschlagen (Anna Muster → <code>annmu</code>) und lässt sich ändern.</li>
		<li><strong>Anmelden:</strong> mit dem Kürzel oder mit „Vorname Nachname“.</li>
	</ul>
	{#if error}<p class="error">{error}</p>{/if}

	{#if credentials}
		<div class="credentials" role="status">
			<div>
				<strong>Zugangsdaten für {credentials.name}</strong> – jetzt notieren, das Passwort wird nur einmal angezeigt.
			</div>
			<div class="pair">
				<span>
					Benutzername: <code>{credentials.username}</code>
					<CopyButton text={credentials.username} label="Benutzername kopieren" />
				</span>
				<span>
					Passwort: <code>{credentials.password}</code>
					<CopyButton text={credentials.password} label="Passwort kopieren" />
				</span>
				<CopyButton
					text={`Benutzername: ${credentials.username}\nPasswort: ${credentials.password}`}
					label="Beides kopieren"
					showLabel
				/>
			</div>
			<button class="icon-btn" aria-label="Schließen" onclick={() => (credentials = null)}>
				<Icon name="close" size={16} />
			</button>
		</div>
	{/if}

	{#if data.students.length === 0}
		<p class="hint">Noch keine Schüler angelegt.</p>
	{:else}
		<div class="row list-head" aria-hidden="true">
			<span>Vorname</span>
			<span>Nachname</span>
			<span>Kürzel</span>
			<span class="right" title="Stundenziele erledigt/gesamt">Stunde</span>
			<span class="right" title="Selbstlern-Ziele erledigt/gesamt">Selbst</span>
			<span class="actions-head">Aktionen</span>
		</div>
		<ul>
			{#each data.students as student (student.id)}
				{#if editing?.id === student.id}
					<li class="editing">
						<form
							class="row"
							onsubmit={saveEdit}
							onkeydown={(e) => e.key === 'Escape' && (editing = null)}
						>
							<!-- svelte-ignore a11y_autofocus -->
							<input type="text" bind:value={draft.firstName} aria-label="Vorname" maxlength="60" required autofocus />
							<input type="text" bind:value={draft.lastName} aria-label="Nachname" maxlength="60" required />
							{#if student.username}
								<input
									type="text"
									class="username"
									value={draftUsername}
									oninput={(e) => (draft.customUsername = e.currentTarget.value)}
									aria-label="Benutzername"
									maxlength="40"
									autocapitalize="none"
									spellcheck="false"
								/>
							{:else}
								<span class="no-login">kein Zugang</span>
							{/if}
							{@render counts(student.id)}
							<span></span>
							<button type="submit" class="icon-btn primary" aria-label="Speichern" title="Speichern (Enter)">
								<Icon name="check" size={16} />
							</button>
							<button
								type="button"
								class="icon-btn"
								aria-label="Abbrechen"
								title="Abbrechen (Esc)"
								onclick={() => (editing = null)}
							>
								<Icon name="undo" size={16} />
							</button>
						</form>
					</li>
				{:else}
					<li>
						<div class="row">
							<span class="name">{student.firstName}</span>
							<span class="name">{student.lastName}</span>
							{#if student.username}
								<code class="username">{student.username}</code>
							{:else}
								<span class="no-login">kein Zugang</span>
							{/if}
							{@render counts(student.id)}
							<button
								class="icon-btn"
								aria-label="{student.username ? 'Neues Passwort erzeugen' : 'Zugang anlegen'} für {student.firstName} {student.lastName}"
								title={student.username ? 'Neues Passwort erzeugen' : 'Zugang anlegen'}
								onclick={() => resetPassword(student)}
							>
								<Icon name={student.username ? 'key' : 'user-plus'} size={16} />
							</button>
							<button
								class="icon-btn"
								aria-label="{student.firstName} {student.lastName} bearbeiten"
								title="Bearbeiten"
								onclick={() => startEdit(student)}
							>
								<Icon name="pencil" size={16} />
							</button>
							<button
								class="icon-btn danger"
								aria-label="{student.firstName} {student.lastName} löschen"
								title="Löschen"
								onclick={() => remove(student)}
							>
								<Icon name="close" size={16} />
							</button>
						</div>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</section>

<style>
	.card {
		max-width: 980px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.count-badge {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		padding: 6px 16px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 600;
	}

	.count-badge strong {
		font-size: 1.5rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	/* Beide Hinweise einheitlich in einem Kasten. */
	.info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 10px 14px;
		list-style: none;
		border-radius: 10px;
		background: var(--bg);
		color: var(--muted);
		font-size: 0.9rem;
	}

	.info strong {
		color: var(--text);
		font-weight: 600;
	}

	.info code {
		padding: 1px 6px;
		font-size: 0.85rem;
		font-weight: 600;
		background: var(--surface);
	}

	.add {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr auto;
		gap: 8px;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Gleiche Spalten im Lese- und Bearbeitungsmodus, damit beim Umschalten nichts springt. */
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 60px 60px 34px 34px 34px;
		gap: 8px;
		align-items: center;
		min-height: 42px;
		padding: 0 4px;
	}

	.list-head {
		min-height: 0;
		margin-bottom: -8px;
		padding-bottom: 6px;
		border-bottom: 2px solid var(--border);
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.list-head .right {
		text-align: right;
	}

	/* „Aktionen“ über Passwort-, Bearbeiten- und Löschen-Knopf. */
	.list-head .actions-head {
		grid-column: 6 / -1;
		text-align: center;
	}

	li:not(.editing) .row {
		border-bottom: 1px solid var(--border);
	}

	li.editing .row {
		padding: 6px 4px;
		border-radius: 10px;
		background: var(--accent-soft);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.username {
		font-family: ui-monospace, monospace;
	}

	code.username {
		justify-self: start;
		padding: 2px 8px;
		font-size: 0.95rem;
		font-weight: 600;
		background: var(--bg);
	}

	.no-login {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.count {
		color: var(--muted);
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.count.complete {
		color: var(--ok);
		font-weight: 700;
	}

	.credentials {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px 12px;
		align-items: start;
		padding: 14px 16px;
		border: 1px solid var(--ok);
		border-radius: 10px;
		background: var(--ok-soft);
	}

	.credentials .pair {
		grid-column: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 24px;
	}

	.credentials button {
		grid-column: 2;
		grid-row: 1 / span 2;
	}

	code {
		padding: 2px 8px;
		border-radius: 6px;
		background: var(--surface);
		font-size: 1.05rem;
		font-weight: 700;
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
	}

	@media (max-width: 760px) {
		.add,
		.row {
			grid-template-columns: 1fr 1fr;
		}

		.list-head {
			display: none;
		}
	}
</style>
