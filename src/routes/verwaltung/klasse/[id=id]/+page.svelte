<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask, showError } from '#lib/dialog.svelte.js';
	import { actAs } from '#lib/act-as.js';
	import { deleteStudent, newPassword, removeFromClass } from '#lib/student-actions.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import RowMenu from '#lib/components/RowMenu.svelte';
	import ClassDialog from '#lib/components/admin/ClassDialog.svelte';
	import AddStudents from '#lib/components/admin/AddStudents.svelte';
	import Credentials from '#lib/components/admin/Credentials.svelte';
	import StudentEdit from '#lib/components/admin/StudentEdit.svelte';

	let { data } = $props();

	const user = $derived(/** @type {import('#lib/server/auth.js').User} */ (data.user));
	const klass = $derived(data.klass);
	const EMPTY = { done: 0, total: 0 };

	let search = $state('');
	const shown = $derived(
		data.students.filter((s) => {
			const q = search.trim().toLowerCase();
			return !q || `${s.firstName} ${s.lastName} ${s.username ?? ''}`.toLowerCase().includes(q);
		})
	);
	// Wie in der Karte: nach Vorname
	const sorted = $derived(
		[...shown].sort((a, b) => a.firstName.localeCompare(b.firstName, 'de') || a.lastName.localeCompare(b.lastName, 'de'))
	);

	let addOpen = $state(false);
	/** @type {'single' | 'list' | 'other'} */
	let addTab = $state('single');
	/** @param {'single' | 'list' | 'other'} tab */
	function openAdd(tab) {
		addTab = tab;
		addOpen = true;
	}

	/** @type {{ name: string, username: string, password: string }[]} */
	let credentials = $state([]);
	let credentialsOpen = $state(false);
	let credentialsTitle = $state('Zugangsdaten');
	/** @param {{ name: string, username: string, password: string }[] | null} list @param {string} [title] */
	function showCredentials(list, title = 'Zugangsdaten') {
		if (!list?.length) return;
		credentials = list;
		credentialsTitle = title;
		credentialsOpen = true;
	}

	let editOpen = $state(false);
	/** @type {import('#lib/server/db.js').Student | null} */
	let editing = $state(null);
	let classDialog = $state(false);

	/** @param {() => Promise<unknown>} action */
	async function run(action) {
		try {
			await action();
		} catch (err) {
			showError(err);
		}
		await invalidateAll();
	}

	// Sammel-Aktionen
	async function allPasswords(print = false) {
		const ok = await ask({
			title: print ? `Zugangsdaten für ${klass.name} drucken?` : `Alle Passwörter in ${klass.name} neu?`,
			message: `Alle ${klass.students.length} Schüler bekommen ein neues Passwort – die alten gelten nicht mehr (auch in anderen Klassen).`,
			confirmLabel: print ? 'Neue Passwörter und drucken' : 'Neue Passwörter'
		});
		if (!ok) return;
		try {
			showCredentials(await api(`/api/classes/${klass.id}/passwords`, 'POST'), `Zugangsdaten ${klass.name}`);
		} catch (err) {
			showError(err);
		}
	}

	async function archive() {
		const value = !klass.archived;
		if (value) {
			const ok = await ask({
				title: `${klass.name} archivieren?`,
				message: 'Die Klasse verschwindet aus der Stunde und den Listen der Lehrkräfte. Schüler und Ziele bleiben – wiederherstellen geht jederzeit.',
				confirmLabel: 'Archivieren'
			});
			if (!ok) return;
		}
		await run(() => api(`/api/classes/${klass.id}`, 'PATCH', { archived: value }));
	}

	async function removeClass() {
		const ok = await ask({
			title: `${klass.name} löschen?`,
			message: 'Die Klasse wird gelöscht. Die Schüler bleiben erhalten.',
			confirmLabel: 'Löschen',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/api/classes/${klass.id}`, 'DELETE');
			goto('/verwaltung');
		} catch (err) {
			showError(err);
		}
	}

	// Lehrkräfte (nur Admin)
	let assigning = $state(false);
	const unassigned = $derived(data.teachers.filter((t) => !klass.teachers.some((k) => k.id === t.id)));
	/** @param {number} teacherId @param {boolean} on */
	const assign = (teacherId, on) => run(() => api(`/api/classes/${klass.id}/teachers`, 'PUT', { teacherId, on }));
	/** @param {number} id */
	const roleOf = (id) => (data.teachers.find((t) => t.id === id)?.isAdmin ? 'Admin' : 'Lehrkraft');
</script>

<svelte:head>
	<title>{klass.name} · Verwaltung · classRoom</title>
</svelte:head>

<div class="klass">
	<div class="bar">
		<div class="crumb">
			<a href="/verwaltung">Klassen ›</a>
			<span class="dot" style:background={klass.color}></span>
			<h1>{klass.name}</h1>
			<span class="count">{klass.students.length} Schüler</span>
			{#if klass.archived}<span class="badge">archiviert</span>{/if}
		</div>
		<div class="bar-right">
			<input type="search" class="search" bind:value={search} placeholder="🔍 Suchen…" aria-label="Schüler suchen" />
			<button class="primary" onclick={() => openAdd('single')}>+ Schüler</button>
		</div>
	</div>

	<div class="layout">
		<div class="table">
			<div class="row head" aria-hidden="true">
				<span></span><span>Name / Kürzel</span><span>Stunde</span><span>Selbst</span><span></span>
			</div>
			{#each sorted as s (s.id)}
				{@const stats = data.goalStats[s.id]}
				<div class="row">
					<Avatar id={s.id} name="{s.firstName} {s.lastName}" />
					<span class="who"><strong>{s.firstName} {s.lastName}{#if s.isTest}<span class="testtag" title="Test-Schüler – sieht nur der Admin">Test</span>{/if}</strong><code>{s.username ?? 'kein Zugang'}</code></span>
					<span class="num">◎ {(stats?.lesson ?? EMPTY).done}/{(stats?.lesson ?? EMPTY).total}</span>
					<span class="num">📖 {(stats?.self ?? EMPTY).done}/{(stats?.self ?? EMPTY).total}</span>
					<span class="actions">
						<button class="act" title={s.username ? 'Neues Passwort' : 'Zugang anlegen'} aria-label="Neues Passwort für {s.firstName} {s.lastName}" onclick={async () => showCredentials(await newPassword(s))}>🔑</button>
						<button
							class="act"
							title="Bearbeiten"
							aria-label="{s.firstName} {s.lastName} bearbeiten"
							onclick={() => {
								editing = s;
								editOpen = true;
							}}>✎</button
						>
						<RowMenu
							label="Weitere Aktionen für {s.firstName} {s.lastName}"
							items={[
								{ label: `Aus ${klass.name} entfernen`, action: () => removeFromClass(klass, s) },
								{ label: `Als ${s.firstName} anmelden`, action: () => actAs({ studentId: s.id }), hidden: !user.isAdmin, disabled: !s.username || !!user.actingAdmin },
								{ label: 'Löschen', action: () => deleteStudent(s), danger: true }
							]}
						/>
					</span>
				</div>
			{:else}
				<p class="empty">
					{data.students.length ? 'Keine Treffer.' : 'Noch keine Schüler – über „+ Schüler“ einzeln, als Liste oder aus einer anderen Klasse hinzufügen.'}
				</p>
			{/each}
		</div>

		<aside>
			<section class="box">
				<h2>Lehrkräfte dieser Klasse</h2>
				<ul class="people">
					{#each klass.teachers as t (t.id)}
						<li>
							<Avatar id={t.id} name={t.username} />
							<span class="who"><strong>{t.username}</strong><small>{user.isAdmin ? roleOf(t.id) : 'Lehrkraft'}</small></span>
							{#if user.isAdmin}
								<button class="x" aria-label="{t.username} aus der Klasse entfernen" title="Entfernen" onclick={() => assign(t.id, false)}>✕</button>
							{/if}
						</li>
					{:else}
						<li class="muted">Noch keine Lehrkraft</li>
					{/each}
				</ul>
				{#if user.isAdmin}
					{#if assigning}
						<div class="assign">
							{#each unassigned as t (t.id)}
								<button
									onclick={() => {
										assigning = false;
										assign(t.id, true);
									}}><Avatar id={t.id} name={t.username} size={20} />{t.username}</button
								>
							{:else}
								<span class="muted">Alle Lehrkräfte sind zugewiesen.</span>
							{/each}
						</div>
					{:else}
						<button class="link" onclick={() => (assigning = true)}>+ Lehrkraft zuweisen</button>
					{/if}
				{/if}
			</section>

			<section class="box">
				<h2>Schnell-Aktionen</h2>
				<ul class="quick">
					<li><button onclick={() => allPasswords(true)} disabled={!klass.students.length}>📄 Zugangsdaten drucken</button></li>
					<li><button onclick={() => openAdd('list')}>📥 Schüler aus Liste einfügen</button></li>
					<li><button onclick={() => allPasswords(false)} disabled={!klass.students.length}>🔑 Alle Passwörter neu</button></li>
					<li><button onclick={() => (classDialog = true)}>🎨 Name und Farbe ändern</button></li>
					<li><button onclick={archive}>📦 {klass.archived ? 'Klasse wiederherstellen' : 'Klasse archivieren'}</button></li>
					{#if klass.archived}<li><button class="danger" onclick={removeClass}>🗑 Klasse löschen</button></li>{/if}
				</ul>
			</section>
		</aside>
	</div>
</div>

<AddStudents bind:open={addOpen} bind:tab={addTab} {klass} classes={data.classes} usernames={data.usernames} onadded={(list) => showCredentials(list, `Neue Schüler in ${klass.name}`)} />
<Credentials bind:open={credentialsOpen} title={credentialsTitle} list={credentials} />
<StudentEdit
	bind:open={editOpen}
	student={editing}
	classes={data.classes.filter((c) => !c.archived)}
	classIds={editing ? data.classes.filter((c) => c.students.some((s) => s.id === editing?.id)).map((c) => c.id) : []}
/>
<ClassDialog bind:open={classDialog} {klass} />

<style>
	.klass {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.crumb {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.crumb a {
		color: var(--muted);
		font-size: 1.05rem;
		text-decoration: none;
	}

	.crumb a:hover {
		color: var(--text);
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	h1 {
		font-size: 1.6rem;
	}

	.count {
		color: var(--muted);
	}

	.badge {
		padding: 1px 9px;
		border-radius: 999px;
		background: var(--warn-soft);
		font-size: 0.8rem;
	}

	.bar-right {
		display: flex;
		gap: 10px;
	}

	.search {
		width: 280px;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	.bar-right .primary {
		padding: 9px 16px;
		white-space: nowrap;
		border-radius: 10px;
		font-weight: 700;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		align-items: start;
		gap: 14px;
	}

	.table,
	.box {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.row {
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr) 90px 90px auto;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-top: 1px solid var(--border);
	}

	.row.head {
		border-top: 0;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.who strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Test-Schüler (nur für den Admin sichtbar) */
	.testtag {
		margin-left: 8px;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--warn-soft);
		color: var(--warn);
		font-size: 0.72rem;
		font-weight: 700;
		vertical-align: middle;
	}

	.who code,
	.who small {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.num {
		color: var(--muted);
		font-size: 0.88rem;
		font-variant-numeric: tabular-nums;
	}

	.actions {
		display: flex;
		gap: 6px;
	}

	.act {
		display: inline-grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border-radius: 8px;
		color: var(--muted);
	}

	.empty {
		margin: 0;
		padding: 18px;
		color: var(--muted);
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.box {
		padding: 16px 16px 12px;
	}

	.box h2 {
		margin-bottom: 10px;
		font-size: 1.05rem;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.people li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
	}

	.people .who {
		flex: 1;
	}

	.x {
		padding: 2px 6px;
		border: 0;
		background: none;
		color: var(--muted);
	}

	.muted {
		color: var(--muted);
		font-size: 0.88rem;
	}

	.link {
		margin-top: 4px;
		padding: 2px 0;
		border: 0;
		background: none;
		color: var(--accent);
		font-size: 0.92rem;
	}

	.assign {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}

	.assign button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px 3px 3px;
		border-radius: 999px;
		font-size: 0.88rem;
	}

	.quick li {
		border-top: 1px solid var(--border);
	}

	.quick button {
		width: 100%;
		padding: 9px 0;
		border: 0;
		border-radius: 0;
		background: none;
		color: var(--text);
		font-size: 0.93rem;
		text-align: left;
	}

	.quick button:hover:not(:disabled) {
		color: var(--accent);
	}

	.quick .danger {
		color: var(--danger);
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.bar-right,
		.search {
			width: 100%;
		}

		.row {
			grid-template-columns: 30px minmax(0, 1fr) auto;
		}

		.row.head,
		.row .num {
			display: none;
		}
	}
</style>
