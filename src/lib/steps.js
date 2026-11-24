// Fortschritt an den Schritten eines Auftrags. Was ein Schritt ist und welchen Schlüssel er hat, bestimmt der
// Server (#lib/server/assignment-content.js): Schritte stehen als <li data-step="…"> im HTML und als
// `assignment.steps`. Ziele aus einem Schritt tragen denselben Schlüssel (`stepKey`).

/** @typedef {{ done: number, total: number }} StepCount */

/**
 * Wie viele Schüler ein Ziel aus jedem Schritt haben und erledigt haben. Spätere Listen gewinnen
 * (z. B. Selbstlernen zuerst, dann die Stundenziele).
 * @param {...{ goals: { stepKey: string | null, done: boolean }[] }[]} lists
 * @returns {Record<string, StepCount>} nach Schritt-Schlüssel
 */
export function countByStep(...lists) {
	/** @type {Record<string, StepCount>} */
	const result = {};
	for (const list of lists) {
		/** @type {Record<string, StepCount>} */
		const counts = {};
		for (const student of list) {
			for (const goal of student.goals) {
				if (!goal.stepKey) continue;
				const entry = (counts[goal.stepKey] ??= { done: 0, total: 0 });
				entry.total++;
				if (goal.done) entry.done++;
			}
		}
		Object.assign(result, counts);
	}
	return result;
}
