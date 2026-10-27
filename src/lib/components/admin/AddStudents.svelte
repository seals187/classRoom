<script>
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { suggestUsername } from '#lib/username.js';
	import Avatar from '../Avatar.svelte';
	import Modal from '../Modal.svelte';

	/**
	 * Schüler zu einer Klasse hinzufügen: einzeln, als eingefügte Liste (ein Name pro Zeile, Vorschau mit
	 * Kürzel) oder aus einer anderen Klasse übernehmen. Neue Zugangsdaten gehen an `onadded` (zum Drucken).
	 * @type {{
	 *   open: boolean,
	 *   klass: { id: number, name: string },
	 *   classes: import('#lib/server/classes.js').SchoolClass[],
	 *   usernames: string[],
	 *   tab?: 'single' | 'list' | 'other',
	 *   onadded: (credentials: { name: string, username: string, password: string }[]) => void
	 * }}
	 */
	let { open = $bindable(false), klass, classes, usernames, tab = $bindable('single'), onadded } = $props();

	let firstName = $state('');
	let lastName = $state('');
	let customUsername = $state('');
	let text = $state('');
	let fromClass = $state(0);
	/** @type {number[]} */
	let picked = $state([]);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if (!open) return;
		untrack(() => {
			firstName = lastName = customUsername = text = '';
			picked = [];
			error = '';
			fromClass = others[0]?.id ?? 0;
		});
	});

	const taken = $derived(new Set(usernames));

	// Einzeln: Kürzel aus dem Namen, bis man es selbst ändert.
	const suggested = $derived(firstName.trim() || lastName.trim() ? suggestUsername(firstName, lastName, (n) => taken.has(n)) : '');

	/**
	 * Eine Zeile → Vor- und Nachname. „Anna Muster“, „Anna Maria Muster“ (letztes Wort = Nachname),
	 * „Muster, Anna“ und aus Excel „Anna⇥Muster“.
	 * @param {string} line
	 */
	function parse(line) {
		const tabbed = line.split('\t').map((s) => s.trim()).filter(Boolean);
		if (tabbed.length >= 2) return { firstName: tabbed[0], lastName: tabbed.slice(1).join(' ') };
		if (line.includes(',')) {
			const [last, ...first] = line.split(',').map((s) => s.trim());
			return { firstName: first.join(' '), lastName: last };
		}
		const words = line.trim().split(/\s+/);
		return { firstName: words.slice(0, -1).join(' '), lastName: words.length > 1 ? words[words.length - 1] : '' };
	}

	// Liste: Vorschau mit Kürzel; auch doppelte Kürzel innerhalb der Liste werden hochgezählt.
	const preview = $derived.by(() => {
		const used = new Set(taken);
		return text
			.split(/\r?\n/)
			.filter((l) => l.trim())
			.slice(0, 200)
			.map((line, i) => {
				const p = parse(line);
				const ok = !!p.firstName && !!p.lastName && p.firstName.length <= 60 && p.lastName.length <= 60;
				const username = ok ? suggestUsername(p.firstName, p.lastName, (n) => used.has(n)) : '';
				if (username) used.add(username);
				return { key: i, ...p, ok, username };
			});
	});
	const valid = $derived(preview.filter((p) => p.ok));

	// Aus anderer Klasse: Schüler, die noch nicht in dieser Klasse sind.
	const others = $derived(classes.filter((c) => c.id !== klass.id));
	const here = $derived(new Set(classes.find((c) => c.id === klass.id)?.students.map((s) => s.id) ?? []));
	const candidates = $derived((others.find((c) => c.id === fromClass)?.students ?? []).filter((s) => !here.has(s.id)));

	const action = $derived(
		tab === 'single'
			? 'Hinzufügen'
			: tab === 'list'
				? `${valid.length} Schüler hinzufügen`
				: `${picked.length} Schüler übernehmen`
	);
	const canSubmit = $derived(
		!busy && (tab === 'single' ? !!firstName.trim() && !!lastName.trim() : tab === 'list' ? valid.length > 0 : picked.length > 0)
	);

	/** @param {{ student: { firstName: string, lastName: string }, credentials: { username: string, password: string } }[]} results */
	const toCredentials = (results) =>
		results.map((r) => ({ name: `${r.student.firstName} ${r.student.lastName}`, ...r.credentials }));

	async function submit() {
		busy = true;
		error = '';
		try {
			if (tab === 'other') {
				await api(`/api/classes/${klass.id}/students`, 'POST', { studentIds: picked });
				await invalidateAll();
				open = false;
				return;
			}
			const students =
				tab === 'single'
					? [{ firstName, lastName, username: customUsername.trim() || suggested }]
					: valid.map(({ firstName, lastName, username }) => ({ firstName, lastName, username }));
			const results = await api('/api/students', 'POST', { classId: klass.id, students });
			await invalidateAll();
			open = false;
			onadded(toCredentials(results));
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title="Schüler zu {klass.name} hinzufügen" width={780}>
	<div class="tabs" role="tablist">
		<button role="tab" aria-selected={tab === 'single'} class:on={tab === 'single'} onclick={() => (tab = 'single')}>Einzeln</button>
		<button role="tab" aria-selected={tab === 'list'} class:on={tab === 'list'} onclick={() => (tab = 'list')}>Liste einfügen</button>
		<button role="tab" aria-selected={tab === 'other'} class:on={tab === 'other'} onclick={() => (tab = 'other')} disabled={others.length === 0}>
			Aus anderer Klasse
		</button>
	</div>

	{#if tab === 'single'}
		<div class="single">
			<label>Vorname<input type="text" bind:value={firstName} maxlength="60" /></label>
			<label>Nachname<input type="text" bind:value={lastName} maxlength="60" /></label>
			<label>
				Kürzel
				<input type="text" class="mono" bind:value={customUsername} placeholder={suggested || 'automatisch'} maxlength="40" />
			</label>
		</div>
	{:else if tab === 'list'}
		<div class="list">
			<label class="paste">
				<span>Ein Name pro Zeile (z. B. aus Excel kopiert)</span>
				<!-- svelte-ignore a11y_autofocus -->
				<textarea bind:value={text} placeholder={'Anna Muster\nBen Keller\n…'} autofocus></textarea>
			</label>
			<div class="preview">
				<span>Vorschau · Kürzel automatisch</span>
				<ul>
					{#each preview as p (p.key)}
						<li class:bad={!p.ok}>
							{#if p.ok}
								<Avatar id={p.key} name="{p.firstName} {p.lastName}" size={26} />
								<span class="name">{p.firstName} {p.lastName}</span>
								<code>{p.username}</code>
								<span class="ok" aria-label="in Ordnung">✓</span>
							{:else}
								<span class="name">{p.firstName || p.lastName}</span>
								<small>Vor- und Nachname nötig</small>
							{/if}
						</li>
					{:else}
						<li class="empty">Noch keine Namen</li>
					{/each}
				</ul>
			</div>
		</div>
	{:else}
		<div class="other">
			<div class="chips" role="radiogroup" aria-label="Klasse">
				{#each others as c (c.id)}
					<button
						role="radio"
						aria-checked={fromClass === c.id}
						class:on={fromClass === c.id}
						onclick={() => {
							fromClass = c.id;
							picked = [];
						}}><span class="dot" style:background={c.color}></span>{c.name}</button
					>
				{/each}
			</div>
			<ul class="pick">
				{#each candidates as s (s.id)}
					<li>
						<label>
							<input type="checkbox" value={s.id} bind:group={picked} />
							<Avatar id={s.id} name="{s.firstName} {s.lastName}" size={26} />
							{s.firstName} {s.lastName}
						</label>
					</li>
				{:else}
					<li class="empty">Alle Schüler dieser Klasse sind schon in {klass.name}.</li>
				{/each}
			</ul>
			{#if candidates.length > 1}
				<button class="link" onclick={() => (picked = candidates.map((s) => s.id))}>Alle auswählen</button>
			{/if}
		</div>
	{/if}
	{#if error}<p class="error">{error}</p>{/if}

	{#snippet footer()}
		<span class="note">
			{tab === 'other' ? 'Die Schüler bleiben auch in ihrer bisherigen Klasse' : 'Passwörter werden erzeugt und können danach gedruckt werden'}
		</span>
		<button onclick={() => (open = false)}>Abbrechen</button>
		<button class="primary" disabled={!canSubmit} onclick={submit}>{action}</button>
	{/snippet}
</Modal>

<style>
	.tabs {
		display: inline-flex;
		gap: 2px;
		margin-bottom: 16px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.tabs button {
		padding: 6px 14px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--muted);
		font-size: 0.92rem;
	}

	.tabs button.on {
		background: var(--bg);
		color: var(--text);
		font-weight: 700;
	}

	label,
	.paste span,
	.preview > span {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.single {
		display: grid;
		grid-template-columns: 1fr 1fr 0.8fr;
		gap: 12px;
	}

	.single label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	input[type='text'],
	textarea {
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}

	.mono,
	code {
		font-family: ui-monospace, monospace;
	}

	.list {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
	}

	.paste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	textarea {
		height: 190px;
		resize: vertical;
		line-height: 1.6;
	}

	textarea:focus {
		border-color: var(--accent);
		outline: none;
	}

	.preview {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	ul {
		max-height: 230px;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.preview li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--border);
	}

	.preview .name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview code {
		padding: 2px 8px;
		border-radius: 6px;
		background: var(--bg);
	}

	.ok {
		color: var(--ok);
	}

	.bad small {
		color: var(--danger);
	}

	.empty {
		color: var(--muted);
		font-size: 0.88rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}

	.chips button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: 999px;
	}

	.chips button.on {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	.pick li label {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 4px;
		border-top: 1px solid var(--border);
		color: var(--text);
		font-size: 0.95rem;
		cursor: pointer;
	}

	.link {
		margin-top: 8px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font-size: 0.88rem;
	}

	.error {
		margin: 12px 0 0;
		color: var(--danger);
		font-size: 0.88rem;
	}

	@media (max-width: 640px) {
		.single,
		.list {
			grid-template-columns: 1fr;
		}
	}
</style>
