<script>
	import logo from '#lib/assets/logo.svg';
	import Icon from '#lib/components/Icon.svelte';

	let { data, form } = $props();

	const REPO = 'https://github.com/seals187/classRoom';

	let showPassword = $state(false);
</script>

<svelte:head>
	<title>Anmelden · classRoom</title>
</svelte:head>

<!-- Dunkler Hintergrund mit weichen Farbflächen, darauf eine Glas-Karte – in beiden Themes gleich. -->
<div class="glow" aria-hidden="true"></div>

<div class="page">
	<section class="login">
		<div class="brand">
			<img src={logo} alt="" width="64" height="64" />
			<h1>class<span class="r">R</span>oom</h1>
			<p class="sub">Schön, dass du da bist.</p>
		</div>

		<form method="POST">
			<label>
				Benutzername oder Vor- und Nachname
				<input
					type="text"
					name="username"
					value={form?.username ?? ''}
					placeholder="z. B. annmu oder Anna Muster"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					required
				/>
			</label>
			<label>
				Passwort
				<span class="password">
					<input type={showPassword ? 'text' : 'password'} name="password" autocomplete="current-password" required />
					<button
						type="button"
						class="eye"
						aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
						title={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
						onclick={() => (showPassword = !showPassword)}
					>
						<Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
					</button>
				</span>
			</label>
			{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
			<button type="submit" class="submit">Anmelden →</button>
		</form>
	</section>

	<footer>
		<p>
			<strong>class<span class="r">R</span>oom</strong> · Version {data.version} ·
			<a href="{REPO}/issues" target="_blank" rel="noopener">Fehler melden</a>
		</p>
		<p>© {data.years} Julien Kühne · <a href="{REPO}/blob/main/LICENSE" target="_blank" rel="noopener">Lizenz AGPL-3.0</a></p>
		<a class="github" href={REPO} target="_blank" rel="noopener" aria-label="classRoom auf GitHub" title="classRoom auf GitHub">
			<Icon name="github" size={20} />
		</a>
	</footer>
</div>

<style>
	/* Hintergrund: dunkel mit blauem, lila und orangem Licht */
	/* Der Body darf nichts über das Licht malen (z-index -1 liegt darunter). */
	:global(html:has(.glow)) {
		background: #0d1018;
	}

	:global(body:has(.glow)) {
		background: transparent;
	}

	.glow {
		position: fixed;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(ellipse 50% 70% at 10% 30%, rgb(52 104 214 / 90%), transparent 72%),
			radial-gradient(ellipse 44% 62% at 92% 48%, rgb(130 76 200 / 85%), transparent 72%),
			radial-gradient(ellipse 38% 34% at 50% 104%, rgb(214 120 52 / 75%), transparent 72%),
			#0d1018;
		filter: blur(30px);
		transform: scale(1.08);
	}

	.page {
		min-height: calc(100dvh - 24px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 28px;
		padding: 24px 0;
		color: #fff;
	}

	/* Glas-Karte */
	.login {
		width: 100%;
		max-width: 400px;
		padding: 26px 28px 28px;
		border: 1px solid rgb(255 255 255 / 14%);
		border-radius: 20px;
		background: rgb(22 26 36 / 62%);
		box-shadow: 0 24px 60px rgb(0 0 0 / 40%);
		backdrop-filter: blur(18px);
	}

	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		margin-bottom: 20px;
		text-align: center;
	}

	.brand img {
		margin-bottom: 8px;
		border-radius: 14px;
	}

	h1 {
		margin: 0;
		color: #fff;
		font-size: 1.85rem;
		font-weight: 800;
	}

	.r {
		color: #f08a3c;
	}

	.sub {
		margin: 0;
		color: rgb(255 255 255 / 78%);
		font-size: 0.98rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 7px;
		color: rgb(255 255 255 / 85%);
		font-size: 0.85rem;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 11px 13px;
		border: 1px solid rgb(255 255 255 / 14%);
		border-radius: 10px;
		background: rgb(10 13 20 / 55%);
		color: #fff;
		font-size: 0.95rem;
	}

	input::placeholder {
		color: rgb(255 255 255 / 38%);
	}

	input:focus {
		outline: none;
		border-color: rgb(255 255 255 / 45%);
		box-shadow: 0 0 0 3px rgb(255 255 255 / 10%);
	}

	.password {
		position: relative;
		display: block;
	}

	.password input {
		padding-right: 42px;
	}

	.eye {
		position: absolute;
		top: 50%;
		right: 6px;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: rgb(255 255 255 / 55%);
		transform: translateY(-50%);
	}

	.eye:hover {
		color: #fff;
	}

	.error {
		margin: 0;
		color: #ff8f8f;
		font-size: 0.9rem;
	}

	/* Weißer Knopf mit dunkler Schrift */
	.submit {
		margin-top: 6px;
		padding: 12px;
		border: 0;
		border-radius: 10px;
		background: #fff;
		color: #111521;
		font-size: 1rem;
		font-weight: 700;
	}

	.submit:hover {
		background: #e9ecf3;
	}

	footer {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: rgb(255 255 255 / 72%);
		font-size: 0.85rem;
		text-align: center;
	}

	footer p {
		margin: 0;
	}

	footer strong {
		color: #fff;
	}

	footer a {
		color: rgb(255 255 255 / 85%);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	footer a:hover {
		color: #fff;
	}

	/* Rundes GitHub-Symbol unter der Fußzeile */
	footer .github {
		align-self: center;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		margin-top: 8px;
		border: 1px solid rgb(255 255 255 / 18%);
		border-radius: 50%;
		background: rgb(255 255 255 / 6%);
		color: rgb(255 255 255 / 80%);
		text-decoration: none;
		transition:
			background 0.2s,
			color 0.2s;
	}

	footer .github:hover {
		background: rgb(255 255 255 / 14%);
		color: #fff;
	}

	@media (max-width: 480px) {
		.login {
			padding: 22px 18px 24px;
			border-radius: 16px;
		}
	}
</style>
