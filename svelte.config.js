import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: adapter(),
		// Eigene Same-Origin-Prüfung in hooks.server.js: vergleicht nur den Host, damit die App
		// ohne feste ORIGIN unter localhost, der Schul-IP und hinter HTTPS gleichermaßen läuft.
		csrf: { checkOrigin: false }
	}
};
