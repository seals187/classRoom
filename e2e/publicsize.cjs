// Geteilte Seite: A− / A+ und Bilder − / + wirken (Desktop und Handy), Vollbild-Knopf da.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const up = async () => admin.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    c.getContext('2d').fillRect(0, 0, 400, 300);
    const f = new FormData(); f.append('file', await new Promise((r) => c.toBlob(r, 'image/png')), 'a.png');
    return (await fetch('/api/files', { method: 'POST', body: f })).json();
  });
  const img = await up();
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte', html: '<ol><li>Seite 10–15 lesen</li><li>Zusammenfassung</li></ol>', images: [img.id] });
  const code = (await admin.api('/api/share', 'PUT', {})).data.code;
  const pub = await (await browser.createBrowserContext()).newPage();
  for (const [dev, vp] of [['Desktop', { width: 1280, height: 720 }], ['Handy', { width: 390, height: 844 }]]) {
    await pub.setViewport(vp);
    await pub.goto(BASE + '/a/' + code); await wait(500);
    const size = () => pub.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.content ol > li')).fontSize));
    const imgW = () => pub.evaluate(() => document.querySelector('.media img').getBoundingClientRect().width);
    check(`${dev}: Knöpfe A−/A+, Bilder −/+, Vollbild da`, !!(await pub.$('button[title="Schrift größer"]')) && !!(await pub.$('button[aria-label="Bilder kleiner"]')) && !!(await pub.$('button[aria-label="Vollbild"]')));
    check(`${dev}: kein Bearbeiten/Teilen`, !(await pub.$('[aria-label="Bearbeiten"]')) && !(await pub.$('[aria-label*="QR"]')));
    const s0 = await size(); await pub.click('button[title="Schrift größer"]'); await wait(150);
    const s1 = await size(); await pub.click('button[title="Schrift kleiner"]'); await pub.click('button[title="Schrift kleiner"]'); await wait(150);
    const s2 = await size();
    check(`${dev}: Schrift größer/kleiner`, s1 > s0 && s2 < s0, `${s0} → ${s1} → ${s2}`);
    const w0 = await imgW(); await pub.click('button[aria-label="Bilder kleiner"]'); await pub.click('button[aria-label="Bilder kleiner"]'); await wait(150);
    const w1 = await imgW(); await pub.click('button[aria-label="Bilder größer"]'); await pub.click('button[aria-label="Bilder größer"]'); await pub.click('button[aria-label="Bilder größer"]'); await wait(150);
    const w2 = await imgW();
    check(`${dev}: Bilder kleiner/größer`, w1 < w0 && w2 > w1, `${Math.round(w0)} → ${Math.round(w1)} → ${Math.round(w2)}`);
    check(`${dev}: kein waagrechtes Scrollen`, await pub.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pub.evaluate(() => localStorage.clear());
    await pub.goto(BASE + '/a/' + code); await wait(400);
    await pub.screenshot({ path: `/out/ps-${dev}.png` });
  }
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
