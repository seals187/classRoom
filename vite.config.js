import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
	plugins: [
		// Seit SvelteKit 3 steht die Konfiguration hier statt in svelte.config.js.
		sveltekit({
			adapter: adapter(),
			params: 'src/params.js',
			// Eigene Same-Origin-Prüfung in hooks.server.js: vergleicht nur den Host, damit die App
			// ohne feste ORIGIN unter localhost, der Schul-IP und hinter HTTPS gleichermaßen läuft.
			csrf: { trustedOrigins: ['*'] }
		})
	],
	server: {
		port: Number(loadEnv(mode, process.cwd(), '').PORT) || 3000
	}
}));
