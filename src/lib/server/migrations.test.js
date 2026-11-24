import { describe, expect, it } from 'vitest';
import { getAssignment } from './assignment.js';
import { getDb, writeSettings } from './db.js';
import { runMigrations } from './migrations.js';
import { classWith, teacher } from './test-fixtures.js';

describe('Umstellungen nach einem Update', () => {
	it('laufen auf einer leeren Datenbank und lassen sich wiederholen', () => {
		expect(() => {
			runMigrations();
			runMigrations();
		}).not.toThrow();
	});

	it('feste Schritt-Schlüssel: Aufträge bekommen data-step, alte Ziele den Schlüssel ihres Schritts', () => {
		const db = getDb();
		// Stand vor dem Update: Auftrag als Markdown, Ziele nur mit Text.
		db.prepare("DELETE FROM settings WHERE key = 'migrated.stepKeys'").run();
		const t = teacher();
		const { studentIds: [anna] } = classWith(t, ['Anna']);
		const id = Number(
			db
				.prepare("INSERT INTO assignment_items (teacher_id, title, body, format) VALUES (?, 'Alt', ?, 'markdown')")
				.run(t.owner, '1. Seite 10 lesen\n2. Aufgabe 3').lastInsertRowid
		);
		writeSettings(t.owner, { assignmentId: String(id) });
		const insert = db.prepare("INSERT INTO goals (student_id, teacher_id, text, kind) VALUES (?, ?, ?, 'lesson')");
		insert.run(anna, t.owner, 'Seite 10 lesen');
		insert.run(anna, t.owner, 'Eigenes Ziel');

		runMigrations();

		const row = /** @type {{ body: string, format: string }} */ (db.prepare('SELECT body, format FROM assignment_items WHERE id = ?').get(id));
		expect(row.format).toBe('html');
		const { steps } = getAssignment(t.owner, id);
		expect(steps.map((s) => s.text)).toEqual(['Seite 10 lesen', 'Aufgabe 3']);
		for (const s of steps) expect(row.body).toContain(`data-step="${s.key}"`);

		const goals = /** @type {{ text: string, stepKey: string | null }[]} */ (
			db.prepare('SELECT text, step_key AS stepKey FROM goals WHERE student_id = ? ORDER BY id').all(anna)
		);
		expect(goals).toEqual([
			{ text: 'Seite 10 lesen', stepKey: steps[0].key },
			{ text: 'Eigenes Ziel', stepKey: null }
		]);

		// Ein zweiter Lauf ändert nichts mehr.
		runMigrations();
		expect(db.prepare('SELECT body FROM assignment_items WHERE id = ?').get(id)).toEqual({ body: row.body });
	});
});
