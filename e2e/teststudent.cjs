// Test-Schüler: nur der Admin sieht ihn – andere Lehrkräfte nirgends (Listen, Klasse, Kacheln, Ziele, Passwörter).
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const annaR = await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' });
  const c = (await admin.api('/api/classes', 'POST', { name: '5a' })).data;
  await admin.api(`/api/classes/${c.id}/teachers`, 'PUT', { teacherId: annaR.data.id, on: true });
  await admin.api('/api/students', 'POST', { classId: c.id, firstName: 'Ben', lastName: 'Keller' });
  const tom = (await admin.api('/api/students', 'POST', { classId: c.id, students: [{ firstName: 'Tom', lastName: 'Probe', isTest: true }] })).data[0];
  check('Admin legt Test-Schüler an', tom?.student?.isTest === true, JSON.stringify(tom?.student));
  const anna = await session(browser, 'anna', 'annaanna1');
  const text = async (p, path) => { await p.goto(BASE + path); await wait(200); return p.evaluate(() => document.body.innerText); };

  check('Anna: kein Test-Schüler anlegen', (await anna.api('/api/students', 'POST', { classId: c.id, firstName: 'X', lastName: 'Y', isTest: true })).status === 403);
  check('Anna: auch nicht per Liste', (await anna.api('/api/students', 'POST', { classId: c.id, students: [{ firstName: 'X', lastName: 'Y', isTest: true }] })).status === 403);
  let t = await text(anna, '/verwaltung?tab=schueler');
  check('Anna: Schülerliste ohne Tom', t.includes('Ben Keller') && !t.includes('Tom'));
  t = await text(anna, `/verwaltung/klasse/${c.id}`);
  check('Anna: Klasse ohne Tom, „1 Schüler“', !t.includes('Tom') && t.includes('1 Schüler'));
  t = await text(anna, '/verwaltung');
  check('Anna: Klassenkarte zählt 1', t.includes('1 Schüler'));
  await anna.api('/api/settings', 'PUT', { classId: c.id });
  t = await text(anna, '/stundenziele');
  check('Anna: Kacheln ohne Tom', t.includes('Ben') && !t.includes('Tom'));
  const g = await anna.api('/api/goals', 'POST', { kind: 'lesson', texts: ['Lesen'] });
  check('Anna: Ziele an alle = 1 Schüler', g.data.students === 1, JSON.stringify(g.data));
  check('Anna: Tom nicht bearbeitbar', (await anna.api(`/api/students/${tom.student.id}`, 'PATCH', { firstName: 'Z' })).status === 404);
  const pw = await anna.api(`/api/classes/${c.id}/passwords`, 'POST');
  check('Anna: „Alle Passwörter neu“ ohne Tom', pw.data.length === 1 && pw.data[0].name === 'Ben Keller', JSON.stringify(pw.data));
  await anna.goto(BASE + `/verwaltung/klasse/${c.id}`); await wait(200);
  await (await anna.$$('xpath/.//button[contains(., "+ Schüler")]'))[0].click(); await wait(200);
  check('Anna: keine Test-Checkbox im Dialog', !(await anna.evaluate(() => document.body.innerText.includes('Test-Schüler'))));

  t = await text(admin, `/verwaltung/klasse/${c.id}`);
  check('Admin: Tom mit „Test“-Etikett', t.includes('Tom Probe') && !!(await admin.$('.testtag')));
  await admin.api('/api/settings', 'PUT', { classId: c.id });
  t = await text(admin, '/stundenziele');
  check('Admin: Kacheln mit Tom', t.includes('Tom'));
  await admin.goto(BASE + `/verwaltung/klasse/${c.id}`); await wait(200);
  await (await admin.$$('xpath/.//button[contains(., "+ Schüler")]'))[0].click(); await wait(300);
  check('Admin: Test-Checkbox im Dialog', await admin.evaluate(() => document.body.innerText.includes('Test-Schüler')));
  await admin.screenshot({ path: '/out/t-dialog.png' });
  await admin.keyboard.press('Escape');

  // Tom selbst kann sich anmelden
  const cred = (await admin.api(`/api/students/${tom.student.id}/password`, 'POST')).data;
  const tp = await session(browser, cred.username, cred.password);
  t = await text(tp, '/stundenziele');
  check('Tom (Schüler) sieht die Kacheln', t.includes('Tom'));

  // Umschalten
  await admin.api(`/api/students/${tom.student.id}`, 'PATCH', { isTest: false });
  t = await text(anna, '/verwaltung?tab=schueler');
  check('Kein Test-Schüler mehr → Anna sieht Tom', t.includes('Tom Probe'));
  await admin.api(`/api/students/${tom.student.id}`, 'PATCH', { isTest: true });
  t = await text(anna, '/verwaltung?tab=schueler');
  check('Wieder Test-Schüler → weg', !t.includes('Tom'));
  check('Anna darf isTest nicht setzen (Ben)', (await anna.api('/api/students/1', 'PATCH', { isTest: true })).status === 403);
  await admin.api(`/api/teachers/${annaR.data.id}`, 'PATCH', { isAdmin: true });
  t = await text(anna, '/verwaltung?tab=schueler');
  check('Anna als Admin sieht Tom', t.includes('Tom Probe'));
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
