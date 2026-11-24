// Geteilte Seite am Handy: Bilder −/+ in sichtbaren Stufen (ganze Breite, ¾, ½, ⅓), „+“ aus bei ganzer Breite.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const img = await admin.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 400, 300);
    const f = new FormData(); f.append('file', await new Promise((r) => c.toBlob(r, 'image/png')), 'a.png');
    return (await fetch('/api/files', { method: 'POST', body: f })).json();
  });
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte', html: '<ol><li>Seite 10–15 lesen</li></ol>', images: [img.id] });
  const code = (await admin.api('/api/share', 'PUT', {})).data.code;
  const pub = await (await browser.createBrowserContext()).newPage();
  await pub.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pub.goto(BASE + '/a/' + code); await wait(500);
  const state = () => pub.evaluate(() => {
    const w = document.querySelector('.media img').getBoundingClientRect().width;
    const full = document.querySelector('.assignment').getBoundingClientRect().width;
    return { pct: Math.round((w / full) * 100), plus: document.querySelector('button[aria-label="Bilder größer"]').disabled, minus: document.querySelector('button[aria-label="Bilder kleiner"]').disabled };
  });
  let s = await state();
  check('Start: ganze Breite, „+“ ausgegraut', s.pct >= 98 && s.plus && !s.minus, JSON.stringify(s));
  const seen = [s.pct];
  for (let i = 0; i < 3; i++) { await pub.tap('button[aria-label="Bilder kleiner"]'); await wait(150); seen.push((await state()).pct); }
  s = await state();
  check('„−“ dreimal: deutlich kleiner bis ⅓, dann „−“ aus', seen[1] < 80 && seen[2] < 55 && seen[3] < 38 && s.minus, JSON.stringify(seen));
  await pub.tap('button[aria-label="Bilder größer"]'); await wait(150);
  check('„+“ macht wieder größer', (await state()).pct > seen[3] + 10);
  await pub.reload(); await wait(500);
  check('Bleibt nach Neuladen', Math.abs((await state()).pct - seen[2]) < 3, String((await state()).pct));
  await pub.screenshot({ path: '/out/ps2-handy.png' });
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
