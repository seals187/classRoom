// Klassen: 2 Klassen (5a, 5b), Clara in beiden, 2 Lehrkräfte (anna → 5a, beat → 5b), Admin test.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' });
  await admin.api('/api/teachers', 'POST', { username: 'beat', password: 'beatbeat1' });
  const ids = { test: 1, anna: 2, beat: 3 };

  // Frische Installation: Admin hat „Meine Klasse“
  await admin.goto(BASE + '/verwaltung');
  check('Frisch: „Meine Klasse“ da', (await admin.evaluate(() => document.body.innerText)).includes('Meine Klasse'));

  const c5a = (await admin.api('/api/classes', 'POST', { name: '5a', color: '#3b6fe0' })).data;
  const c5b = (await admin.api('/api/classes', 'POST', { name: '5b', color: '#f08a3c' })).data;
  check('Klassen angelegt', c5a.id && c5b.id);
  await admin.api(`/api/classes/${c5a.id}/teachers`, 'PUT', { teacherId: ids.anna, on: true });
  await admin.api(`/api/classes/${c5b.id}/teachers`, 'PUT', { teacherId: ids.beat, on: true });

  const a = await admin.api('/api/students', 'POST', { classId: c5a.id, students: [
    { firstName: 'Anna', lastName: 'Muster' }, { firstName: 'Ben', lastName: 'Keller' }, { firstName: 'Clara', lastName: 'Frei' } ] });
  check('Liste in 5a: 3 Schüler mit Passwort', a.status === 201 && a.data.length === 3 && a.data.every((r) => r.credentials.password), JSON.stringify(a.data?.[0]?.credentials));
  const b = await admin.api('/api/students', 'POST', { classId: c5b.id, students: [
    { firstName: 'David', lastName: 'Huber' }, { firstName: 'Elif', lastName: 'Demir' } ] });
  const clara = a.data[2].student.id;
  check('Clara auch in 5b', (await admin.api(`/api/classes/${c5b.id}/students`, 'POST', { studentIds: [clara] })).status === 200);

  const anna = await session(browser, 'anna', 'annaanna1');
  const beat = await session(browser, 'beat', 'beatbeat1');
  const text = async (p, path) => { await p.goto(BASE + path); return p.evaluate(() => document.body.innerText); };

  // Rechte
  let t = await text(anna, '/verwaltung?tab=schueler');
  check('Anna sieht 5a-Schüler', t.includes('Anna Muster') && t.includes('Clara Frei'));
  check('Anna sieht 5b-Schüler nicht', !t.includes('David Huber') && !t.includes('Elif'));
  t = await text(anna, '/verwaltung');
  check('Anna sieht nur 5a als Klasse', t.includes('5a') && !t.includes('5b') && !t.includes('Meine Klasse'));
  check('Anna: fremde Klasse 404', (await anna.goto(BASE + `/verwaltung/klasse/${c5b.id}`)).status() === 404);
  check('Anna: keine Lehrkräfte zuweisen', (await anna.api(`/api/classes/${c5a.id}/teachers`, 'PUT', { teacherId: ids.beat, on: true })).status === 403);
  check('Anna: kein Schüler in fremde Klasse', (await anna.api('/api/students', 'POST', { classId: c5b.id, firstName: 'X', lastName: 'Y' })).status === 404);
  check('Anna: David nicht bearbeitbar', (await anna.api(`/api/students/${b.data[0].student.id}`, 'PATCH', { firstName: 'Z' })).status === 404);
  t = await text(beat, '/verwaltung?tab=schueler');
  check('Beat sieht 5b inkl. Clara', t.includes('David Huber') && t.includes('Clara Frei') && !t.includes('Ben Keller'));
  t = await text(admin, '/verwaltung?tab=schueler');
  check('Admin sieht alle', ['Anna Muster', 'Ben Keller', 'Clara Frei', 'David Huber', 'Elif Demir'].every((n) => t.includes(n)));
  check('„Lehrkräfte: …“ unter Schülern entfernt', !t.includes('Lehrkräfte:'));

  // Stunde mit Klasse
  await anna.api('/api/settings', 'PUT', { roomChange: false, startTime: '08:00', returnTime: '23:59', classId: c5a.id });
  await beat.api('/api/settings', 'PUT', { roomChange: false, startTime: '08:00', returnTime: '23:59', classId: c5b.id });
  check('Anna darf 5b nicht wählen', (await anna.api('/api/settings', 'PUT', { classId: c5b.id })).status === 404);
  t = await text(anna, '/stundenziele');
  check('Anna: Kacheln nur 5a', t.includes('Anna') && t.includes('Clara') && !t.includes('David'));
  check('Kopfband zeigt 5a', await anna.evaluate(() => document.querySelector('header .klass')?.innerText.includes('5a')));
  const g1 = await anna.api('/api/goals', 'POST', { kind: 'lesson', texts: ['Seite 10 lesen'] });
  check('Ziele an alle = 3 Schüler der 5a', g1.data.students === 3, JSON.stringify(g1.data));
  const g2 = await beat.api('/api/goals', 'POST', { kind: 'lesson', texts: ['Werken'] });
  check('Beat: Ziele an 3 Schüler der 5b', g2.data.students === 3, JSON.stringify(g2.data));
  t = await text(beat, '/stundenziele');
  check('Beat: Kacheln 5b', t.includes('David') && t.includes('Clara') && !t.includes('Ben'));

  // Klasse wechseln (Admin unterrichtet 5a und 5b)
  await admin.api('/api/settings', 'PUT', { roomChange: false, startTime: '08:00', returnTime: '23:59', classId: c5b.id });
  t = await text(admin, '/stundenziele');
  check('Admin mit 5b: nur 5b', t.includes('Elif') && !t.includes('Ben'));
  await admin.api('/api/goals', 'POST', { kind: 'self', texts: ['Vokabeln'] });
  await admin.api('/api/settings', 'PUT', { classId: c5a.id });
  t = await text(admin, '/stundenziele');
  check('Admin mit 5a: nur 5a', t.includes('Ben') && !t.includes('Elif'));
  t = await text(admin, '/selbstlernen');
  check('Selbstlernen = aktive Klasse (seit 0.4.6)', t.includes('Ben') && !t.includes('Elif'));
  await admin.api('/api/settings', 'PUT', { selfAll: true });
  t = await text(admin, '/selbstlernen');
  check('Selbstlernen „Alle meine Klassen“', t.includes('Ben') && t.includes('Elif'));
  await admin.api('/api/settings', 'PUT', { selfAll: false });

  // Löschen / Entfernen
  check('Anna darf Clara nicht löschen (auch in 5b)', (await anna.api(`/api/students/${clara}`, 'DELETE')).status === 409);
  check('Anna entfernt Ben aus 5a', (await anna.api(`/api/classes/${c5a.id}/students`, 'DELETE', { studentIds: [a.data[1].student.id] })).status === 200);
  t = await text(anna, '/verwaltung?tab=schueler');
  check('Ben weg bei Anna', !t.includes('Ben Keller'));
  t = await text(admin, '/verwaltung?tab=schueler');
  check('Ben beim Admin „ohne Klasse“', t.includes('Ben Keller') && t.includes('ohne Klasse'));

  // Archivieren
  await admin.api(`/api/classes/${c5b.id}`, 'PATCH', { archived: true });
  t = await text(beat, '/verwaltung?tab=schueler');
  check('Archiviert: Beat sieht keine Schüler', !t.includes('David'));
  await admin.api(`/api/classes/${c5b.id}`, 'PATCH', { archived: false });
  t = await text(beat, '/verwaltung?tab=schueler');
  check('Wiederhergestellt', t.includes('David'));

  // Passwörter der Klasse
  const pw = await anna.api(`/api/classes/${c5a.id}/passwords`, 'POST');
  check('Alle Passwörter neu (5a: 2)', pw.data.length === 2 && pw.data[0].password, JSON.stringify(pw.data));

  // Lehrkraft legt eigene Klasse an
  const f = await anna.api('/api/classes', 'POST', { name: 'Förderkurs' });
  t = await text(anna, '/verwaltung');
  check('Anna: eigene Klasse Förderkurs', f.status === 201 && t.includes('Förderkurs'));

  // Schüler-Login: Clara sieht Kacheln der Klasse ihrer Lehrkraft
  const resetC = (await admin.api(`/api/students/${clara}/password`, 'POST')).data;
  const cl = await session(browser, resetC.username, resetC.password);
  t = await text(cl, '/stundenziele');
  check('Clara (Schüler) sieht eine Klasse', t.includes('Clara'));
  check('Schüler kommt nicht in Verwaltung', !(await cl.goto(BASE + '/verwaltung')) || !cl.url().includes('/verwaltung'));

  // --- Screenshots (dunkel wie die Vorlagen, dazu hell) ---
  await admin.evaluate(() => localStorage.setItem('theme', 'dark'));
  await admin.goto(BASE + '/verwaltung'); await wait(300);
  await admin.screenshot({ path: '/out/k1-klassen-dark.png' });
  await admin.goto(BASE + `/verwaltung/klasse/${c5a.id}`); await wait(300);
  await admin.screenshot({ path: '/out/k2-klasse-dark.png' });
  await (await admin.$$('xpath/.//button[contains(., "Schüler aus Liste einfügen")]'))[0].click();
  await wait(300);
  await admin.type('textarea', 'Anna Muster\nBen Keller\nClara Frei\nDavid Huber');
  await wait(200);
  await admin.screenshot({ path: '/out/k3-liste-dark.png' });
  const preview = await admin.evaluate(() => [...document.querySelectorAll('.preview code')].map((c) => c.innerText));
  check('Vorschau mit hochgezählten Kürzeln', preview.length === 4 && preview[0] === 'annmu2', JSON.stringify(preview));
  await admin.keyboard.press('Escape');
  await admin.goto(BASE + '/verwaltung?tab=lehrer'); await wait(300);
  await admin.screenshot({ path: '/out/k4-lehrer-dark.png' });
  await admin.goto(BASE + '/verwaltung?tab=schueler'); await wait(300);
  await admin.screenshot({ path: '/out/k5-schueler-dark.png' });
  await admin.evaluate(() => localStorage.setItem('theme', 'light'));
  await admin.goto(BASE + '/verwaltung'); await wait(300);
  await admin.screenshot({ path: '/out/k1-klassen-light.png' });
  await admin.goto(BASE + `/verwaltung/klasse/${c5a.id}`); await wait(300);
  await admin.screenshot({ path: '/out/k2-klasse-light.png' });
  // Menü mit Klassenwahl, Kopfband
  await admin.api('/api/settings', 'PUT', { roomChange: false, startTime: '', returnTime: '' });
  await admin.goto(BASE + '/'); await wait(300);
  await admin.screenshot({ path: '/out/k6-kopfband.png' });
  await (await admin.$('button[aria-label="Menü"]')).click(); await wait(300);
  await admin.screenshot({ path: '/out/k7-menu.png' });
  const chips = await admin.evaluate(() => [...document.querySelectorAll('.class-pick option')].map((o) => o.innerText));
  check('Menü: Klassen zur Wahl, 5a gewählt', (await admin.evaluate(() => document.querySelector('.class-pick')?.selectedOptions[0]?.innerText)) === '5a', JSON.stringify(chips));
  // Phone
  await admin.setViewport({ width: 390, height: 844 });
  await admin.goto(BASE + `/verwaltung/klasse/${c5a.id}`); await wait(300);
  check('Handy: kein waagrechtes Scrollen', await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await admin.screenshot({ path: '/out/k8-handy.png' });

  done();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
