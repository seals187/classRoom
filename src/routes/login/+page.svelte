<script>
	import logo from '$lib/assets/logo.svg';

	let { form } = $props();
</script>

<svelte:head>
	<title>Anmelden · classRoom</title>
</svelte:head>

<section class="card login">
	<h1><img src={logo} alt="" width="40" height="40" /> class<span class="r">R</span>oom</h1>
	<p class="sub">Bitte melde dich an.</p>

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

	h1 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 1.6rem;
		font-weight: 800;
	}

	h1 img {
		border-radius: 9px;
	}

	.r {
		color: #f08a3c;
	}

	.sub {
		margin: 0 0 12px;
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
