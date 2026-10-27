<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { api } from '#lib/api.js';
	import { ask, askText, showError } from '#lib/dialog.svelte.js';
	import { actAs } from '#lib/act-as.js';
	import { deleteStudent, newPassword } from '#lib/student-actions.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import RowMenu from '#lib/components/RowMenu.svelte';
	import ClassDialog from '#lib/components/admin/ClassDialog.svelte';
	import AddStudents from '#lib/components/admin/AddStudents.svelte';
	import Credentials from '#lib/components/admin/Credentials.svelte';
	import StudentEdit from '#lib/components/admin/StudentEdit.svelte';

	let { data } = $props();

	const user = $derived(/** @type {import('#lib/server/auth.js').User} */ (data.user));
	const isAdmin = $derived(user.isAdmin);
	const active = $derived(data.classes.filter((c) => !c.archived));
	const archived = $derived(data.classes.filter((c) => c.archived));
	const classById = $derived(new Map(data.classes.map((c) => [c.id, c])));

	/** @param {'klassen' | 'schueler' | 'lehrer'} tab */
	const tabHref = (tab) => (tab === 'klassen' ? '/verwaltung' : `/verwaltung?tab=${tab}`);
	const TABS = /** @type {const} */ ([
		{ id: 'klassen', label: 'Klassen', icon: 'users' },
		{ id: 'schueler', label: 'Schüler', icon: 'users' },
		{ id: 'lehrer', label: 'Lehrkräfte', icon: 'briefcase' }
	]);

	// --- Klassen ---
	let classDialog = $state(false);
	/** @type {{ id: number, name: string, color: string } | null} */
	let editingClass = $state(null);

	function newClass() {
		editingClass = null;
		classDialog = true;
	}

	/** @param {import('#lib/server/classes.js').SchoolClass} c @param {boolean} value */
	async function archive(c, value) {
		if (value) {
			const ok = await ask({
				title: `${c.name} archivieren?`,
				message: 'Die Klasse verschwindet aus der Stunde und den Listen der Lehrkräfte. Schüler und Ziele bleiben – wiederherstellen geht jederzeit.',
				confirmLabel: 'Archivieren'
			});
			if (!ok) return;
		}
		await run(() => api(`/api/classes/${c.id}`, 'PATCH', { archived: value }));
	}

	/** @param {import('#lib/server/classes.js').SchoolClass} c */
	async function removeClass(c) {
		const ok = await ask({
			title: `${c.name} löschen?`,
			message: 'Die Klasse wird gelöscht. Die Schüler bleiben erhalten (in ihren anderen Klassen bzw. beim Admin).',
			confirmLabel: 'Löschen',
			danger: true
		});
		if (ok) await run(() => api(`/api/classes/${c.id}`, 'DELETE'));
	}

	/** @param {() => Promise<unknown>} action */
	async function run(action) {
		try {
			await action();
		} catch (err) {
			showError(err);
		}
		await invalidateAll();
	}

	// --- Schüler ---
	let filter = $state(0);
	let search = $state('');
	const filtered = $derived(
		data.students.filter((s) => {
			if (filter && !(data.studentClasses[s.id] ?? []).includes(filter)) return false;
			const q = search.trim().toLowerCase();
			return !q || `${s.firstName} ${s.lastName} ${s.username ?? ''}`.toLowerCase().includes(q);
		})
	);
	const EMPTY = { done: 0, total: 0 };

	let addOpen = $state(false);
	/** @type {'single' | 'list' | 'other'} */
	let addTab = $state('single');
	const addClass = $derived(classById.get(filter) ?? active[0] ?? null);

	/** @type {{ name: string, username: string, password: string }[]} */
	let credentials = $state([]);
	let credentialsOpen = $state(false);
	/** @param {{ name: string, username: string, password: string }[] | null} list */
	function showCredentials(list) {
		if (!list?.length) return;
		credentials = list;
		credentialsOpen = true;
	}

	let editOpen = $state(false);
	/** @type {import('#lib/server/db.js').Student | null} */
	let editing = $state(null);

	// --- Lehrkräfte ---
	let teacherOpen = $state(false);
	let newName = $state('');
	let newPw = $state('');
	let teacherError = $state('');

	/** @param {SubmitEvent} e */
	async function addTeacher(e) {
		e.preventDefault();
		teacherError = '';
		try {
			await api('/api/teachers', 'POST', { username: newName, password: newPw });
			await invalidateAll();
			teacherOpen = false;
			newName = newPw = '';
		} catch (err) {
			teacherError = err instanceof Error ? err.message : String(err);
		}
	}

	/** @param {import('#lib/server/auth.js').TeacherInfo} t @param {number} classId @param {boolean} on */
	const assign = (t, classId, on) => run(() => api(`/api/classes/${classId}/teachers`, 'PUT', { teacherId: t.id, on }));

	/** @param {import('#lib/server/auth.js').TeacherInfo} t */
	async function setPassword(t) {
		const self = t.id === user.id;
		const password = await askText({
			title: self ? 'Neues eigenes Passwort' : `Neues Passwort für ${t.username}`,
			placeholder: 'mind. 8 Zeichen',
			confirmLabel: 'Setzen'
		});
		if (password) await run(() => api(`/api/teachers/${t.id}`, 'PATCH', { password }));
	}

	/** @param {import('#lib/server/auth.js').TeacherInfo} t */
	async function rename(t) {
		const username = await askText({ title: `${t.username} umbenennen`, value: t.username, confirmLabel: 'Speichern' });
		if (username && username !== t.username) await run(() => api(`/api/teachers/${t.id}`, 'PATCH', { username }));
	}

	/** @param {import('#lib/server/auth.js').TeacherInfo} t */
	async function removeTeacher(t) {
		const ok = await ask({
			title: `${t.username} löschen?`,
			message: 'Auftrag, Ziele, Gruppen und Einstellungen der Lehrkraft werden gelöscht. Klassen und Schüler bleiben.',
			confirmLabel: 'Löschen',
			danger: true
		});
		if (ok) await run(() => api(`/api/teachers/${t.id}`, 'DELETE'));
	}
</script>

<svelte:head>
	<title>Verwaltung · classRoom</title>
</svelte:head>

<div class="admin">
	<div class="bar">
		<nav class="tabs" aria-label="Verwaltung">
			{#each TABS as t (t.id)}
				<a href={tabHref(t.id)} class:on={data.tab === t.id} aria-current={data.tab === t.id ? 'page' : undefined}>
					<Icon name={t.icon} size={17} />{t.id === 'lehrer' && !isAdmin ? 'Mein Konto' : t.label}
				</a>
			{/each}
		</nav>
		{#if data.tab === 'klassen'}
			<button class="primary" onclick={newClass}>+ Neue Klasse</button>
		{:else if data.tab === 'schueler'}
			<button
				class="primary"
				disabled={!addClass}
				title={addClass ? `Zu ${addClass.name} hinzufügen` : 'Zuerst eine Klasse anlegen'}
				onclick={() => {
					addTab = 'single';
					addOpen = true;
				}}>+ Schüler</button
			>
		{:else if isAdmin}
			<button class="primary" onclick={() => (teacherOpen = true)}>+ Lehrkraft</button>
		{/if}
	</div>

	{#if data.tab === 'klassen'}
		<div class="cards">
			{#each active as c (c.id)}
				<article class="card" style:--c={c.color}>
					<a class="open" href="/verwaltung/klasse/{c.id}" aria-label="{c.name} öffnen"></a>
					<div class="card-head">
						<div>
							<h2>{c.name}</h2>
							<span class="count">{c.students.length} Schüler</span>
						</div>
						<RowMenu
							label="Aktionen für {c.name}"
							plain
							items={[
								{
									label: 'Bearbeiten',
									action: () => {
										editingClass = c;
										classDialog = true;
									}
								},
								{ label: 'Archivieren', action: () => archive(c, true) },
								{ label: 'Löschen', action: () => removeClass(c), danger: true }
							]}
						/>
					</div>
					<div class="faces">
						{#each c.students.slice(0, 5) as s (s.id)}
							<Avatar id={s.id} name="{s.firstName} {s.lastName}" size={26} />
						{/each}
						{#if c.students.length > 5}<span class="more">+{c.students.length - 5}</span>{/if}
						{#if c.students.length === 0}<span class="more">noch keine Schüler</span>{/if}
					</div>
					<div class="teachers">
						<span class="label">Lehrkräfte</span>
						<div class="pills">
							{#each c.teachers as t (t.id)}
								<span class="pill"><Avatar id={t.id} name={t.username} size={20} />{t.username}</span>
							{:else}
								<span class="more">keine</span>
							{/each}
						</div>
					</div>
				</article>
			{/each}
			<button class="card new" onclick={newClass}><span>+</span>Neue Klasse</button>
		</div>

		{#if archived.length > 0}
			<h3 class="section">Archiviert</h3>
			<ul class="archived">
				{#each archived as c (c.id)}
					<li>
						<span class="dot" style:background={c.color}></span>
						<a href="/verwaltung/klasse/{c.id}">{c.name}</a>
						<small>{c.students.length} Schüler</small>
						<button onclick={() => archive(c, false)}>Wiederherstellen</button>
						<button class="danger" onclick={() => removeClass(c)}>Löschen</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if data.tab === 'schueler'}
		<div class="filters">
			<div class="chips" role="radiogroup" aria-label="Nach Klasse filtern">
				<button role="radio" aria-checked={filter === 0} class:on={filter === 0} onclick={() => (filter = 0)}>
					Alle <small>{data.students.length}</small>
				</button>
				{#each active as c (c.id)}
					<button role="radio" aria-checked={filter === c.id} class:on={filter === c.id} onclick={() => (filter = c.id)}>
						<span class="dot" style:background={c.color}></span>{c.name} <small>{c.students.length}</small>
					</button>
				{/each}
			</div>
			<input type="search" class="search" bind:value={search} placeholder="🔍 Suchen…" aria-label="Schüler suchen" />
		</div>

		<div class="table">
			<div class="row head" aria-hidden="true">
				<span></span><span>Name / Kürzel</span><span>Klassen</span><span>Stunde</span><span>Selbst</span><span></span>
			</div>
			{#each filtered as s (s.id)}
				{@const stats = data.goalStats[s.id]}
				<div class="row">
					<Avatar id={s.id} name="{s.firstName} {s.lastName}" />
					<span class="who"><strong>{s.firstName} {s.lastName}{#if s.isTest}<span class="testtag" title="Test-Schüler – sieht nur der Admin">Test</span>{/if}</strong><code>{s.username ?? 'kein Zugang'}</code></span>
					<span class="labels">
						{#each data.studentClasses[s.id] ?? [] as id (id)}
							{@const c = classById.get(id)}
							{#if c}<span class="tag" style:--c={c.color}>{c.name}</span>{/if}
						{:else}
							<small class="muted">ohne Klasse</small>
						{/each}
					</span>
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
								{ label: `Als ${s.firstName} anmelden`, action: () => actAs({ studentId: s.id }), hidden: !isAdmin, disabled: !s.username || !!user.actingAdmin },
								{ label: 'Löschen', action: () => deleteStudent(s), danger: true }
							]}
						/>
					</span>
				</div>
			{:else}
				<p class="empty">{data.students.length ? 'Keine Treffer.' : 'Noch keine Schüler – in einer Klasse über „+ Schüler“ hinzufügen.'}</p>
			{/each}
		</div>
	{:else}
		<div class="table matrix" style:--cols={active.length}>
			<div class="row head">
				<span>Lehrkraft</span>
				{#each active as c (c.id)}
					<span class="col"><span class="dot" style:background={c.color}></span>{c.name}</span>
				{/each}
				<span></span>
			</div>
			{#each data.teachers as t (t.id)}
				{@const self = t.id === user.id}
				<div class="row">
					<span class="who-cell">
						<Avatar id={t.id} name={t.username} />
						<span class="who"><strong>{t.username}{#if self}<span class="you">du</span>{/if}</strong><small>{t.isAdmin ? 'Admin' : 'Lehrkraft'}</small></span>
					</span>
					{#each active as c (c.id)}
						<span class="col">
							<input
								type="checkbox"
								class="check"
								checked={t.classIds.includes(c.id)}
								disabled={!isAdmin}
								aria-label="{t.username} unterrichtet {c.name}"
								onchange={(e) => assign(t, c.id, e.currentTarget.checked)}
							/>
						</span>
					{/each}
					<span class="actions plain">
						<button class="act plain" title="Passwort ändern" aria-label="Passwort von {t.username} ändern" onclick={() => setPassword(t)}>🔑</button>
						{#if isAdmin}
							<button class="act plain" title="Umbenennen" aria-label="{t.username} umbenennen" onclick={() => rename(t)}>✎</button>
							<RowMenu
								label="Weitere Aktionen für {t.username}"
								plain
								items={[
									{ label: t.isAdmin ? 'Admin-Recht entziehen' : 'Zum Admin machen', action: () => run(() => api(`/api/teachers/${t.id}`, 'PATCH', { isAdmin: !t.isAdmin })), disabled: self },
									{ label: `Als ${t.username} anmelden`, action: () => actAs({ teacherId: t.id }), disabled: self || !!user.actingAdmin },
									{ label: 'Löschen', action: () => removeTeacher(t), danger: true, disabled: self || data.teachers.length <= 1 }
								]}
							/>
						{/if}
					</span>
				</div>
			{/each}
		</div>
		<p class="foot-note">
			{isAdmin
				? 'Häkchen setzen = Lehrkraft sieht diese Klasse. Eine Klasse kann mehrere Lehrkräfte haben.'
				: 'Deine Klassen. Zuweisen kann der Admin.'}
		</p>
	{/if}
</div>

<ClassDialog bind:open={classDialog} klass={editingClass} count={data.classes.length} onsaved={(id) => !editingClass && goto(`/verwaltung/klasse/${id}`)} />
{#if addClass}
	<AddStudents bind:open={addOpen} bind:tab={addTab} klass={addClass} classes={active} usernames={data.usernames} onadded={showCredentials} />
{/if}
<Credentials bind:open={credentialsOpen} title="Zugangsdaten" list={credentials} />
<StudentEdit bind:open={editOpen} student={editing} classes={active} classIds={editing ? (data.studentClasses[editing.id] ?? []) : []} />

<Modal bind:open={teacherOpen} title="Neue Lehrkraft" width={420}>
	<form id="teacher-form" class="form" onsubmit={addTeacher}>
		<label>Benutzername<input type="text" bind:value={newName} required autocomplete="off" /></label>
		<label>Passwort<input type="password" bind:value={newPw} minlength="8" required autocomplete="new-password" placeholder="mind. 8 Zeichen" /></label>
		{#if teacherError}<p class="error">{teacherError}</p>{/if}
	</form>
	{#snippet footer()}
		<span class="note">Klassen danach in der Tabelle anhaken</span>
		<button onclick={() => (teacherOpen = false)}>Abbrechen</button>
		<button type="submit" form="teacher-form" class="primary">Hinzufügen</button>
	{/snippet}
</Modal>

<style>
	.admin {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.bar > .primary {
		padding: 9px 16px;
		border-radius: 10px;
		font-weight: 700;
	}

	.tabs {
		display: inline-flex;
		gap: 4px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}

	.tabs a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 16px;
		border-radius: 9px;
		color: var(--muted);
		font-size: 0.95rem;
		text-decoration: none;
	}

	.tabs a.on {
		background: var(--bg);
		color: var(--text);
		font-weight: 700;
	}

	/* --- Klassen-Karten --- */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 18px 16px;
		border: 1px solid var(--border);
		border-top: 4px solid var(--c);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.card:hover {
		border-color: color-mix(in srgb, var(--c) 50%, var(--border));
		border-top-color: var(--c);
	}

	/* Ganze Karte klickbar, ⋯ liegt darüber. */
	.open {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.card-head :global(.wrap) {
		z-index: 1;
	}

	h2 {
		font-size: 1.6rem;
		line-height: 1.1;
	}

	.count,
	.more,
	.label {
		color: var(--muted);
		font-size: 0.88rem;
	}

	.faces {
		display: flex;
		align-items: center;
	}

	.faces :global(.avatar) {
		margin-right: -5px;
		box-shadow: 0 0 0 2px var(--surface);
	}

	.faces .more {
		margin-left: 12px;
		font-size: 0.8rem;
	}

	.teachers {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px 3px 3px;
		border-radius: 999px;
		background: var(--bg);
		font-size: 0.88rem;
	}

	.card.new {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 4px;
		min-height: 200px;
		border: 2px dashed var(--border);
		background: transparent;
		box-shadow: none;
		color: var(--muted);
	}

	.card.new span {
		font-size: 1.6rem;
		line-height: 1;
	}

	.card.new:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.section {
		margin-top: 8px;
		color: var(--muted);
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.archived {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.archived li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
	}

	.archived a {
		color: var(--text);
		font-weight: 600;
	}

	.archived small {
		flex: 1;
		color: var(--muted);
	}

	.archived button {
		padding: 4px 12px;
		font-size: 0.85rem;
	}

	.dot {
		flex-shrink: 0;
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	/* --- Schüler --- */
	.filters {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chips button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: 999px;
		font-size: 0.9rem;
	}

	.chips small {
		color: var(--muted);
	}

	.chips button.on {
		border-color: var(--accent);
		background: var(--accent-soft);
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

	.table {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		overflow: hidden;
	}

	.row {
		display: grid;
		grid-template-columns: 30px minmax(0, 1.4fr) minmax(0, 1.4fr) 70px 70px auto;
		align-items: center;
		gap: 14px;
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

	.labels {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tag {
		padding: 1px 9px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--c) 18%, transparent);
		color: color-mix(in srgb, var(--c) 75%, var(--text));
		font-size: 0.8rem;
		font-weight: 600;
	}

	.muted {
		color: var(--muted);
	}

	.num {
		color: var(--muted);
		font-size: 0.88rem;
		font-variant-numeric: tabular-nums;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
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

	.act.plain {
		width: 24px;
		height: 24px;
		border: 0;
		background: transparent;
	}

	.empty {
		margin: 0;
		padding: 18px;
		color: var(--muted);
	}

	/* --- Lehrkräfte × Klassen --- */
	.matrix .row {
		grid-template-columns: minmax(200px, 1.6fr) repeat(var(--cols), minmax(70px, 1fr)) 100px;
	}

	.who-cell {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.you {
		margin-left: 6px;
		padding: 0 7px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.72rem;
		vertical-align: middle;
	}

	.row.head .col {
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.85rem;
	}

	.col {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.check {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.check:disabled {
		cursor: default;
	}

	.foot-note {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.form label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.form input {
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--bg);
		color: var(--text);
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.88rem;
	}

	@media (max-width: 760px) {
		.bar {
			flex-wrap: wrap;
		}

		.row {
			grid-template-columns: 30px minmax(0, 1fr) auto;
		}

		.row.head,
		.row .labels,
		.row .num {
			display: none;
		}

		.matrix {
			overflow-x: auto;
		}

		.matrix .row {
			min-width: max-content;
		}

		.search {
			width: 100%;
		}
	}
</style>
