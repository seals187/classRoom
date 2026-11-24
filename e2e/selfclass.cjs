// Aktive Klasse ohne Stunde (Menü speichert sofort) + Selbstlernen: aktive Klasse oder „Alle meine Klassen“.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' });
  const c5a = (await admin.api('/api/classes', 'POST', { name: '5a', color: '#3b6fe0' })).data;
  const c5b = (await admin.api('/api/classes', 'POST', { name: '5b', color: '#f08a3c' })).data;
  await admin.api(`/api/classes/${c5a.id}/teachers`, 'PUT', { teacherId: 2, on: true });
  await admin.api(`/api/classes/${c5b.id}/teachers`, 'PUT', { teacherId: 2, on: true });
  const a = await admin.api('/api/students', 'POST', { classId: c5a.id, students: [
    { firstName: 'Anna', lastName: 'Muster' }, { firstName: 'Ben', lastName: 'Keller' }, { firstName: 'Clara', lastName: 'Frei' } ] });
  await admin.api('/api/students', 'POST', { classId: c5b.id, students: [
    { firstName: 'David', lastName: 'Huber' }, { firstName: 'Elif', lastName: 'Demir' } ] });
  const clara = a.data[2].student.id;
  await admin.api(`/api/classes/${c5b.id}/students`, 'POST', { studentIds: [clara] });

  const anna = await session(browser, 'anna', 'annaanna1');
  const names = async (path) => {
    await anna.goto(BASE + path); await wait(300);
    return anna.evaluate(() => [...document.querySelectorAll('.tile .name')].map((n) => n.innerText.trim()).sort());
  };

  // 1) Nur Klasse wählen (API) – keine Stunde wird gestartet
  const r = await anna.api('/api/settings', 'PUT', { classId: c5b.id });
  check('Nur classId: 200', r.status === 200, JSON.stringify(r.data));
  // (Antwort = unveränderte Stunde)

  check('Keine Stunde gestartet', r.data.startTime === '');
  let n = await names('/stundenziele');
  check('Stundenziele ohne Stunde: 5b', n.length === 3 && n.some((x) => x.startsWith('David')) && !n.some((x) => x.startsWith('Ben')), n.join(','));
  n = await names('/selbstlernen');
  check('Selbstlernen = aktive Klasse 5b', n.length === 3 && n.some((x) => x.startsWith('Elif')) && !n.some((x) => x.startsWith('Anna')), n.join(','));
  check('Kopf: 5b', await anna.evaluate(() => document.querySelector('.class-stats .label')?.innerText.toLowerCase().includes('5b')));

  // 2) Menü: Klasse wählen ohne „Stunde starten“
  await anna.goto(BASE + '/selbstlernen'); await wait(400);
  await (await anna.$('button[aria-label="Menü"]')).click(); await wait(400);
  await anna.select('.summary select.class-pick', String(c5a.id)); await wait(1000);
  const msg = await anna.evaluate(() => document.body.innerText.includes('Klasse gewählt'));
  check('Menü: „Klasse gewählt“', msg);
  await anna.keyboard.press('Escape'); await wait(300);
  n = await names('/selbstlernen');
  check('Nach Menü-Wahl: Selbstlernen 5a', n.length === 3 && n.some((x) => x.startsWith('Ben')) && !n.some((x) => x.startsWith('David')), n.join(','));
  n = await names('/stundenziele');
  check('Nach Menü-Wahl: Stundenziele 5a', n.some((x) => x.startsWith('Ben')) && !n.some((x) => x.startsWith('David')), n.join(','));
  check('Stunde läuft weiterhin nicht', await anna.evaluate(() => document.body.innerText.toLowerCase().includes('stunde starten')));

  // 3) Selbstlernen: „Alle meine Klassen“
  await anna.goto(BASE + '/selbstlernen'); await wait(400);
  await anna.select('.pick select', 'all'); await wait(1000);
  n = await anna.evaluate(() => [...document.querySelectorAll('.tile .name')].map((n) => n.innerText.trim()).sort());
  check('Alle Klassen: 5 Schüler', n.length === 5, n.join(','));
  const dots = await anna.evaluate(() => [...document.querySelectorAll('.tile')].map((t) => [t.querySelector('.name').innerText, t.querySelectorAll('.cdot').length]));
  check('Punkte: Clara 2, andere 1', dots.every(([nm, c]) => (nm.startsWith('Clara') ? c === 2 : c === 1)), JSON.stringify(dots));
  check('Kopf: „Alle Klassen“', await anna.evaluate(() => document.querySelector('.class-stats .label')?.innerText.toLowerCase().includes('alle klassen')));
  await anna.screenshot({ path: '/out/sc-alle-light.png' });
  await anna.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); await wait(300);
  await anna.screenshot({ path: '/out/sc-alle-dark.png' });
  await anna.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  check('Kein Scrollen 1280×720', await anna.evaluate(() => document.documentElement.scrollWidth <= 1280));
  n = await names('/stundenziele');
  check('Stundenziele bleiben 5a', n.length === 3 && !n.some((x) => x.startsWith('David')), n.join(','));
  check('Stundenziele ohne Punkte', await anna.evaluate(() => !document.querySelector('.tile .cdot')));

  // 4) Selbstlernen: Klasse 5b wählen → wieder eine Klasse, gilt überall
  await anna.goto(BASE + '/selbstlernen'); await wait(400);
  await anna.select('.pick select', String(c5b.id)); await wait(1000);
  n = await anna.evaluate(() => [...document.querySelectorAll('.tile .name')].map((n) => n.innerText.trim()).sort());
  check('Selbstlernen 5b, ohne Punkte', n.length === 3 && n.some((x) => x.startsWith('David')) && !(await Promise.resolve(false)), n.join(','));
  check('Keine Punkte bei einer Klasse', await anna.evaluate(() => !document.querySelector('.tile .cdot')));
  await anna.screenshot({ path: '/out/sc-5b.png' });
  n = await names('/stundenziele');
  check('Stundenziele jetzt 5b', n.some((x) => x.startsWith('David')) && !n.some((x) => x.startsWith('Ben')), n.join(','));

  // 5) Menü-Wahl hebt „Alle“ auf
  await anna.api('/api/settings', 'PUT', { selfAll: true });
  await anna.api('/api/settings', 'PUT', { classId: c5a.id, selfAll: false });
  n = await names('/selbstlernen');
  check('Klasse wählen hebt „Alle“ auf', n.length === 3, n.join(','));

  // 6) Laufende Stunde: Klasse wechseln beendet sie nicht
  await anna.api('/api/settings', 'PUT', { roomChange: false, startTime: '00:01', returnTime: '23:59', classId: c5a.id });
  const r6 = await anna.api('/api/settings', 'PUT', { classId: c5b.id });
  const after = JSON.stringify(r6.data);
  check('Stunde läuft nach Klassenwechsel weiter', after.includes('00:01') && after.includes('23:59'));

  // 7) Schüler sieht Selbstlernen wie bisher (inkl. sich selbst)
  const login = a.data[0].credentials;
  const st = await session(browser, login.username, login.password);
  await st.goto(BASE + '/selbstlernen'); await wait(400);
  const sn = await st.evaluate(() => [...document.querySelectorAll('.tile .name')].map((n) => n.innerText.trim()));
  check('Schüler sieht sich selbst', sn.some((x) => x.startsWith('Anna')), sn.join(','));
  check('Schüler: keine Klassenwahl', await st.evaluate(() => !document.querySelector('.pick select')));
  check('Schüler: Einstellung 403', (await st.api('/api/settings', 'PUT', { selfAll: true })).status === 403);

  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
