// Upgrade 0.4.4 → mehrere Aufträge: "seed" auf der alten Version, "check" auf der neuen.
// Der bisherige Auftrag wird der erste, aktiv, für die aktive Klasse, mit demselben QR-Link; Bilder bleiben.
const fs = require('fs');
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  if (process.argv[2] === 'seed') {
    await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' });
    const k = (await admin.api('/api/classes', 'POST', { name: '5a', color: '#f08a3c' })).data;
    await admin.api('/api/settings', 'PUT', { classId: k.id });
    const img = await admin.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 30;
      c.getContext('2d').fillRect(0, 0, 40, 30);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const f = new FormData(); f.append('file', blob, 'a.png');
      return (await fetch('/api/files', { method: 'POST', body: f })).json();
    });
    await admin.api('/api/assignment', 'PUT', { title: 'Alter Auftrag', html: '<ol><li>Eins</li><li>Zwei</li></ol>', images: [img.id] });
    const code = (await admin.api('/api/share', 'PUT', {})).data.code;
    const anna = await session(browser, 'anna', 'annaanna1');
    await anna.api('/api/assignment', 'PUT', { title: 'Annas Auftrag', html: '<p>Holz</p>', images: [] });
    fs.writeFileSync('/out/upgrade-seed.json', JSON.stringify({ code, img: img.id }));
    console.log('seeded', code);
  } else {
    const { code, img } = JSON.parse(fs.readFileSync('/out/upgrade-seed.json', 'utf8'));
    await admin.goto(BASE + '/'); await wait(500);
    check('Startseite zeigt den alten Auftrag', (await admin.evaluate(() => document.querySelector('.assignment h2')?.textContent)) === 'Alter Auftrag');
    await admin.goto(BASE + '/auftraege'); await wait(500);
    const cards = await admin.evaluate(() => [...document.querySelectorAll('.card:not(.add)')].map((c) => ({
      title: c.querySelector('.title').textContent.trim(), cls: c.querySelector('.classes').textContent.trim(),
      active: c.classList.contains('active'), summary: c.querySelector('.summary').textContent.trim() })));
    check('Übersicht: ein Auftrag, aktiv, Klasse 5a, 2 Schritte · 1 Bild', cards.length === 1 && cards[0].active && cards[0].cls === '5a' && cards[0].summary === '2 Schritte · 1 Bild', JSON.stringify(cards));
    const pub = await (await browser.createBrowserContext()).newPage();
    await pub.goto(BASE + '/a/' + code); await wait(500);
    check('Alter QR-Link geht noch', (await pub.evaluate(() => document.querySelector('.assignment h2')?.textContent)) === 'Alter Auftrag');
    const r = await pub.evaluate(async (u) => (await fetch(u)).status, `/a/${code}/bild/${img}`);
    check('Bild über den Link', r === 200, String(r));
    const anna = await session(browser, 'anna', 'annaanna1');
    await anna.goto(BASE + '/'); await wait(400);
    check('Anna: ihr Auftrag aktiv', (await anna.evaluate(() => document.querySelector('.assignment h2')?.textContent)) === 'Annas Auftrag');
    // Neuer zweiter Auftrag, alter bleibt
    const n = (await admin.api('/api/assignments', 'POST', { title: 'Zweiter', html: '', images: [] })).data;
    check('Zweiter Auftrag dazu', n.id > 0);
    await admin.goto(BASE + '/auftraege'); await wait(400);
    check('Jetzt zwei Karten', (await admin.$$('.card:not(.add)')).length === 2);
    done();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
