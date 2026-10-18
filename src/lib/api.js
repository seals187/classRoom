/**
 * Kleiner JSON-Helfer für die eigenen API-Routen. `FormData` wird unverändert gesendet (Uploads).
 * @param {string} url
 * @param {string} method
 * @param {unknown} [body]
 */
export async function api(url, method, body) {
	const isForm = body instanceof FormData;
	const res = await fetch(url, {
		method,
		headers: {
			accept: 'application/json',
			...(body === undefined || isForm ? {} : { 'content-type': 'application/json' })
		},
		body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const fallback = res.status === 413 ? 'Datei ist zu groß' : `Anfrage fehlgeschlagen (${res.status})`;
		throw new Error(data?.message ?? fallback);
	}
	return res.status === 204 ? null : res.json();
}
