<script>
	import logo from '#lib/assets/logo.svg';

	let { form } = $props();
</script>

<svelte:head>
	<title>Anmelden · classRoom</title>
</svelte:head>

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

<style>
	.login {
		max-width: 380px;
		margin: 12vh auto 0;
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
