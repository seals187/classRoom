// ⋯-Menü in der letzten Tabellenzeile: Einträge sichtbar und anklickbar (nicht vom Tabellenrand abgeschnitten).
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/teachers', 'POST', { username: 'zora', password: 'zorazora1' });
  const visible = () => admin.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map((b) => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.top >= 0 && r.bottom <= innerHeight && (hit === b || b.contains(hit));
  }));
  for (const [name, vp] of [['1280×720', { width: 1280, height: 720 }], ['niedriges Fenster', { width: 1280, height: 330 }], ['Handy', { width: 390, height: 844 }]]) {
    await admin.setViewport(vp);
    await admin.goto(BASE + '/verwaltung?tab=lehrer'); await wait(300);
    await admin.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(150);
    await (await admin.$('button[aria-label="Weitere Aktionen für zora"]')).click(); await wait(200);
    const v = await visible();
    check(`${name}: alle ${v.length} Einträge sichtbar`, v.length === 3 && v.every(Boolean), JSON.stringify(v));
    await admin.screenshot({ path: `/out/m-${name.replace(/[^a-z0-9]/gi, '')}.png` });
  }
  // Klick auf einen Eintrag funktioniert
  await admin.setViewport({ width: 1280, height: 720 });
  await admin.goto(BASE + '/verwaltung?tab=lehrer'); await wait(300);
  await (await admin.$('button[aria-label="Weitere Aktionen für zora"]')).click(); await wait(200);
  await (await admin.$$('xpath/.//button[@role="menuitem" and contains(., "Zum Admin machen")]'))[0].click(); await wait(600);
  check('Eintrag anklickbar (zora ist Admin)', (await admin.evaluate(() => document.body.innerText)).match(/zora\s*Admin/) !== null);
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
