// Eigene Dialoge statt confirm()/alert()/prompt() des Browsers – im Stil der App, hell und dunkel.
// Angezeigt werden sie von Dialog.svelte im Layout.

/**
 * @typedef {{
 *   kind: 'confirm' | 'alert' | 'prompt',
 *   title: string,
 *   message: string,
 *   confirmLabel: string,
 *   cancelLabel: string,
 *   danger: boolean,
 *   value: string,
 *   placeholder: string,
 *   resolve: (result: boolean | string | null) => void
 * }} DialogRequest
 */

export const dialog = $state({ /** @type {DialogRequest | null} */ current: null });

/** @param {Partial<DialogRequest> & { kind: DialogRequest['kind'], title: string }} request */
function open(request) {
	// Ein noch offener Dialog gilt als abgebrochen.
	dialog.current?.resolve(request.kind === 'confirm' ? false : null);
	return new Promise((resolve) => {
		dialog.current = {
			message: '',
			confirmLabel: 'OK',
			cancelLabel: 'Abbrechen',
			danger: false,
			value: '',
			placeholder: '',
			...request,
			resolve
		};
	});
}

/**
 * Ja/Nein-Frage. Ergebnis: true bei Bestätigen.
 * @param {{ title: string, message?: string, confirmLabel?: string, danger?: boolean }} options
 * @returns {Promise<boolean>}
 */
export const ask = (options) => /** @type {Promise<boolean>} */ (open({ kind: 'confirm', ...options }));

/**
 * Hinweis mit einem OK-Knopf.
 * @param {string} message
 * @param {string} [title]
 * @returns {Promise<void>}
 */
export const notify = (message, title = 'Hinweis') =>
	/** @type {Promise<void>} */ (open({ kind: 'alert', title, message }).then(() => undefined));

/**
 * Text abfragen. Ergebnis: der Text oder null bei Abbrechen.
 * @param {{ title: string, message?: string, placeholder?: string, value?: string, confirmLabel?: string }} options
 * @returns {Promise<string | null>}
 */
export const askText = (options) => /** @type {Promise<string | null>} */ (open({ kind: 'prompt', ...options }));

/** @param {unknown} err */
export const showError = (err) => notify(err instanceof Error ? err.message : String(err), 'Das hat nicht geklappt');
