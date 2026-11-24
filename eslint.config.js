import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

// npm run lint – läuft auch beim Docker-Build und in .github/workflows/check.yml.
// Fängt vor allem, was der Vite-Build durchlässt: unbekannte Namen (no-undef), z. B. eine Variable, die ein
// verirrter Kommentar verschluckt hat, und ungenutzte Variablen.
export default [
	{ ignores: ['build/', '.svelte-kit/', 'node_modules/', 'e2e/out/'] },
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// `const { a, ...rest } = x` – `a` nur, um es aus `rest` herauszunehmen.
			'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
			// Bewusst anders gelöst: keine Basis-URL (Links ohne resolve()), `{' · '}` für Leerzeichen im Markup,
			// {@html} nur mit serverseitig bereinigtem HTML (sanitize.js), Anzeige des Auftrags baut DOM selbst
			// (assignment-display.js), Date/Set in Funktionen sind nicht reaktiv gemeint.
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/no-useless-mustaches': 'off',
			'svelte/no-at-html-tags': 'off',
			'svelte/no-dom-manipulating': 'off',
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		files: ['e2e/**/*.cjs'],
		languageOptions: { sourceType: 'commonjs' }
	}
];
