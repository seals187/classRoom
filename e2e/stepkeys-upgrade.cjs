// Upgrade 0.4.7 → feste Schritt-Schlüssel. seed (alte Version): Auftrag mit „- “-Zeilen, Ziele per Text, eins
// abgehakt. check (neue Version, gleiches Volume): Schritte haben Schlüssel, Badge am Schritt, Textänderung behält ihn.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mode = process.argv[2];

(async () => {
  const browser = await open();
  const t = await session(browser, 'test', 'testtest123');
  if (mode === 'seed') {
    const klass = (await t.api('/api/classes', 'POST', { name: '5a' })).data;
    await t.api('/api/settings', 'PUT', { classId: klass.id });
    await t.api('/api/students', 'POST', { classId: klass.id, students: [{ firstName: 'Anna', lastName: 'M' }, { firstName: 'Ben', lastName: 'K' }] });
    const a = (await t.api('/api/assignments', 'POST', { title: 'Alt', html: '<p>- Seite 10 lesen</p><p>- Aufgabe 3</p>', images: [], classIds: [klass.id] })).data;
    await t.api(`/api/assignments/${a.id}/show`, 'POST');
    const g = (await t.api('/api/goals', 'POST', { kind: 'lesson', texts: ['Seite 10 lesen', 'Aufgabe 3'] })).data;
    await t.api(`/api/goals/${g.goalIds[0]}`, 'PATCH', { done: true });
    console.log('seed', a.steps, JSON.stringify(g));
  } else {
    await t.goto(BASE + '/'); await wait(800);
    const b = await t.evaluate(() => [...document.querySelectorAll('.content li[data-step]')].map((li) => li.querySelector('.step-count')?.innerText ?? ''));
    check('Nach Update: Badges an beiden Schritten', b.length === 2 && b[0] === '✓ 1/2' && b[1] === '✓ 0/2', JSON.stringify(b));
    const list = (await t.api('/api/assignments/1', 'PUT', { archived: false })).data;
    check('Schritte mit Schlüsseln', list.steps.length === 2 && list.steps.every((s) => s.key), JSON.stringify(list.steps));
    await t.api('/api/assignments/1', 'PUT', { title: 'Alt', html: list.html.replace('Seite 10', 'Seite 11'), images: [] });
    await t.goto(BASE + '/'); await wait(800);
    const b2 = await t.evaluate(() => [...document.querySelectorAll('.content li[data-step]')].map((li) => li.querySelector('.step-count')?.innerText ?? ''));
    check('Textänderung nach Update: Badge bleibt', b2[0] === '✓ 1/2', JSON.stringify(b2));
  }
  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
