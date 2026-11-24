// Feste Schritt-Schlüssel (nach 0.4.7): Schritte aus „- “-Zeilen bekommen data-step, Ziele aus Schritten den
// Schlüssel; der Fortschritt (✓ x/y) bleibt am Schritt, auch wenn die Lehrkraft dessen Text ändert – per API und
// im Editor. „Als Stundenziele“ sendet die Schlüssel mit; Schritte zählen in der Übersicht.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await open();
  const t = await session(browser, 'test', 'testtest123');
  const klass = (await t.api('/api/classes', 'POST', { name: '5a' })).data;
  await t.api('/api/class', 'PUT', { classId: klass.id });
  await t.api('/api/students', 'POST', { classId: klass.id, students: [
    { firstName: 'Anna', lastName: 'Muster' }, { firstName: 'Ben', lastName: 'Keller' } ] });

  const created = await t.api('/api/assignments', 'POST', {
    title: 'Brüche', html: '<p>- Seite 10 lesen</p><p>- Aufgabe 3 lösen</p><p>Viel Erfolg</p>', images: [], classIds: [klass.id] });
  const a = created.data;
  check('Anlegen: 2 Schritte mit Schlüssel', created.status === 200 && a.steps.length === 2 && a.steps.every((s) => /^[a-z0-9]+$/.test(s.key)), JSON.stringify(a.steps));
  check('HTML enthält data-step und eine Liste', a.html.includes(`data-step="${a.steps[0].key}"`) && a.html.includes('<ol>'));
  await t.api(`/api/assignments/${a.id}/show`, 'POST');

  // „Als Stundenziele“ über das Fenster senden
  await t.goto(BASE + '/'); await wait(600);
  const btn = await t.$$eval('button', (bs) => bs.findIndex((b) => b.innerText.includes('Als Stundenziele')));
  check('Knopf „Als Stundenziele“', btn >= 0);
  await t.evaluate((i) => document.querySelectorAll('button')[i].click(), btn); await wait(500);
  await t.evaluate(() => [...document.querySelectorAll('button.primary')].find((b) => b.innerText.includes('Ziele an'))?.click());
  await wait(1200);

  const goals = (await t.api('/api/goals', 'POST', { kind: 'lesson', goals: a.steps.map((s) => ({ text: s.text, stepKey: s.key })) })).data;
  check('Fenster hat mit Schlüsseln gesendet (erneut senden fügt nichts hinzu)', goals.added === 0, JSON.stringify(goals));

  // Ein Ziel bei Anna abhaken (als Anna)
  const pw = (await t.api(`/api/students/${(await t.api('/api/students', 'POST', { classId: klass.id, firstName: 'Clara', lastName: 'Frei' })).data.student.id}/password`, 'POST')).data;
  const clara = await session(browser, pw.username, pw.password);
  await t.api('/api/goals', 'POST', { kind: 'lesson', goals: a.steps.map((s) => ({ text: s.text, stepKey: s.key })) });
  await clara.goto(BASE + '/stundenziele'); await wait(600);
  // Abhaken per Klick auf das erste Ziel der eigenen Kachel (Kachel evtl. erst aufklappen)
  await clara.evaluate(() => { if (!document.querySelector('.tile.own input[type=checkbox]')) document.querySelector('.tile.own .summary')?.click(); });
  await wait(400);
  const clicked = await clara.evaluate(() => {
    const el = document.querySelector('.tile.own input[type=checkbox]:not(:disabled)');
    if (!el) return false;
    el.click();
    return true;
  });
  check('Clara hakt ein Ziel ab', clicked);
  await wait(800);

  const badges = async () => {
    await t.goto(BASE + '/'); await wait(800);
    return t.evaluate(() => [...document.querySelectorAll('.content li[data-step]')].map((li) => li.querySelector('.step-count')?.innerText ?? ''));
  };
  let b = await badges();
  check('Badges an beiden Schritten', b.length === 2 && b.every((x) => x.includes('/3')), JSON.stringify(b));
  const before = b[0];

  // Text eines Schritts per API ändern – Schlüssel bleibt, Badge bleibt
  const html2 = a.html.replace('Seite 10 lesen', 'Seite 12 lesen');
  const upd = (await t.api(`/api/assignments/${a.id}`, 'PUT', { title: a.title, html: html2, images: [] })).data;
  check('Geänderter Text, gleicher Schlüssel', upd.steps[0].key === a.steps[0].key && upd.steps[0].text === 'Seite 12 lesen', JSON.stringify(upd.steps));
  b = await badges();
  check('Badge bleibt nach Textänderung', b[0] === before && b[0] !== '', JSON.stringify(b));

  // Im Editor ändern und speichern
  await t.click('button[aria-label="Bearbeiten"]'); await wait(500);
  const keysInEditor = await t.evaluate(() => [...document.querySelectorAll('[aria-label="Auftragstext"] li[data-step]')].map((li) => li.getAttribute('data-step')));
  check('Editor kennt die Schlüssel', JSON.stringify(keysInEditor) === JSON.stringify(a.steps.map((s) => s.key)), JSON.stringify(keysInEditor));
  await t.evaluate(() => {
    const li = document.querySelector('[aria-label="Auftragstext"] li[data-step]');
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode();
    text.textContent = text.textContent.replace('Seite 12', 'Seite 14');
  });
  await t.evaluate(() => [...document.querySelectorAll('button.primary')].find((x) => x.innerText.includes('Speichern'))?.click());
  await wait(1200);
  b = await badges();
  const texts = await t.evaluate(() => [...document.querySelectorAll('.content li[data-step]')].map((li) => li.innerText));
  check('Nach Editor-Speichern: Text neu, Badge bleibt', texts[0].includes('Seite 14') && b[0] === before, JSON.stringify([texts, b]));

  // Übersicht zählt die Schritte
  await t.goto(BASE + '/auftraege'); await wait(600);
  check('Übersicht: „2 Schritte“', await t.evaluate(() => document.body.innerText.includes('2 Schritte')));

  // Neuer Schritt im Editor davor: alte Badges bleiben am alten Schritt
  const upd2 = (await t.api(`/api/assignments/${a.id}`, 'PUT', { title: a.title, html: (await t.api(`/api/assignments/${a.id}`, 'PUT', { archived: false })).data.html.replace('<ol>', '<ol><li>Neu: Material holen</li>'), images: [] })).data;
  check('Neuer Schritt davor: alte Schlüssel bleiben', upd2.steps[1].key === a.steps[0].key && upd2.steps.length === 3, JSON.stringify(upd2.steps));
  b = await badges();
  check('Badge am alten Schritt, keiner am neuen', b[0] === '' && b[1] === before, JSON.stringify(b));

  // Stunde per /api/lesson starten und beenden
  let r = await t.api('/api/lesson', 'PUT', await t.clock(45));
  check('PUT /api/lesson startet', r.status === 200 && r.data.startTime !== '', JSON.stringify(r.data));
  await t.goto(BASE + '/'); await wait(600);
  check('Kopfband: Arbeitsphase', await t.evaluate(() => document.body.innerText.toLowerCase().includes('arbeitsphase')));
  r = await t.api('/api/lesson', 'DELETE');
  check('DELETE /api/lesson beendet', r.status === 200 && r.data.startTime === '' && r.data.returnTime === '');
  r = await clara.api('/api/lesson', 'PUT', { startTime: '10:00', returnTime: '10:45' });
  check('Schüler darf keine Stunde starten', r.status === 403);

  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
