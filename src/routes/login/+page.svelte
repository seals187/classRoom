<script>
	import logo from '#lib/assets/logo.svg';

	let { data, form } = $props();

	const REPO = 'https://github.com/seals187/classRoom';
</script>

<svelte:head>
	<title>Anmelden · classRoom</title>
</svelte:head>

<!-- Karte senkrecht und waagrecht mittig, darunter App-Name, Version, Fehler melden und Lizenz. -->
<div class="page">
<section class="card login">
	<div class="brand">
		<img src={logo} alt="" width="72" height="72" />
		<h1>class<span class="r">R</span>oom</h1>
		<p class="sub">Bitte melde dich an.</p>
	</div>

	<form method="POST">
		<label>
			Benutzername oder Vor- und Nachname
			<input
				type="text"
				name="username"
				value={form?.username ?? ''}
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
			/>
		</label>
		<label>
			Passwort
			<input type="password" name="password" autocomplete="current-password" required />
		</label>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<button type="submit" class="primary">Anmelden</button>
	</form>
</section>

<footer>
	<p><strong>class<span class="r">R</span>oom</strong> · Version {data.version} · <a href="{REPO}/issues" target="_blank" rel="noopener">Fehler melden</a></p>
	<p>© {data.years} Julien Kühne · <a href="{REPO}/blob/main/LICENSE" target="_blank" rel="noopener">Lizenz AGPL-3.0</a></p>
</footer>
</div>

<style>
	.page {
		min-height: calc(100dvh - 24px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 24px 0;
	}

	footer {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--muted);
		font-size: 0.82rem;
		text-align: center;
	}

	footer p {
		margin: 0;
	}

	footer strong {
		color: var(--text);
	}

	footer a {
		color: var(--muted);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	footer a:hover {
		color: var(--accent);
	}

	.login {
		width: 100%;
		max-width: 380px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	/* Logo, Schriftzug und Begrüßung mittig über dem Formular. */
	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		margin-bottom: 18px;
		text-align: center;
	}

	.brand img {
		margin-bottom: 4px;
		border-radius: 16px;
	}

	h1 {
		font-size: 1.8rem;
		font-weight: 800;
	}

	.r {
		color: #f08a3c;
	}

	.sub {
		margin: 0;
		color: var(--muted);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--muted);
	}

	input {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
	}

	.error {
		margin: 0;
		color: var(--danger);
	}

	button {
		padding: 10px;
	}
</style>
