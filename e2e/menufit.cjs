// Menü passt in 1280×720 ohne Scrollen (ohne Stunde, laufend, eingeklappt); Klasse in einer Zeile.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/classes', 'POST', { name: '5a' });
  const openMenu = async () => { await admin.goto(BASE + '/'); await wait(400); await (await admin.$('button[aria-label="Menü"]')).click(); await wait(400); };
  // Auftragsliste zuklappen (sonst ist die Stunden-Karte kompakt, siehe auftraege.cjs) – wird gemerkt.
  await openMenu(); if (await admin.$('.sub-list')) { await (await admin.$('.nav-row')).click(); await wait(200); } await admin.keyboard.press('Escape');
  const fits = () => admin.evaluate(() => { const d = document.querySelector('.drawer'); return { ok: d.scrollHeight <= d.clientHeight + 1, h: d.scrollHeight }; });
  for (const [name, a, b] of [['ohne Stunde', null, null], ['laufend', 10, 35]]) {
    const now = Date.now();
    await admin.api('/api/settings', 'PUT', { roomName: 'Zimmer 101', roomChange: true, startTime: a === null ? '' : hhmm(new Date(now - a * 60000)), returnTime: b === null ? '' : hhmm(new Date(now + b * 60000)) });
    await openMenu();
    let f = await fits();
    check(`${name}, ausgeklappt: passt ohne Scrollen`, f.ok, 'Höhe ' + f.h);
    const row = await admin.evaluate(() => !!document.querySelector('.summary select.class-pick'));
    check(`${name}: Klasse in der Zusammenfassung wählbar`, row);
    await admin.screenshot({ path: `/out/mf-${a === null ? 'idle' : 'run'}.png` });
    await (await admin.$$('xpath/.//button[contains(@class,"status")]'))[0].click(); await wait(200);
    f = await fits();
    check(`${name}, eingeklappt: passt`, f.ok, 'Höhe ' + f.h);
    await admin.screenshot({ path: `/out/mf-${a === null ? 'idle' : 'run'}-zu.png` });
    await admin.keyboard.press('Escape'); await wait(150);
    await openMenu();
    check(`${name}: bleibt eingeklappt nach erneutem Öffnen`, !(await admin.$('.card .tabs')));
    await (await admin.$$('xpath/.//button[contains(@class,"status")]'))[0].click(); await wait(150);
    await admin.keyboard.press('Escape');
  }
  // Beginn/Ende aufklappen und Stunde starten geht noch
  await admin.api('/api/settings', 'PUT', { roomName: 'Zimmer 101', roomChange: true, startTime: '', returnTime: '' });
  await openMenu();
  await (await admin.$$('xpath/.//button[contains(., "Eigene")]'))[0].click(); await wait(150);
  check('Beginn/Ende aufklappbar', (await admin.$$('.times input[type=time]')).length === 2);
  const f2 = await fits(); check("mit Beginn/Ende: passt", f2.ok, "Höhe " + f2.h);
  await (await admin.$$('xpath/.//button[contains(., "Stunde starten") and contains(@class,"go")]'))[0].click(); await wait(800);
  check('Stunde starten aus dem Menü', (await admin.evaluate(() => document.body.innerText)).toLowerCase().includes('stunde läuft'));
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
