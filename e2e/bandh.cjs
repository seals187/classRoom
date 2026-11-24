// Kopfband: gleiche Höhe ohne Stunde, laufend (mit/ohne Viertelstunden), Aufräumen, Losgehen, Zeit um.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const now = Date.now();
  const states = [['ohne Stunde', null, null], ['laufend 45 min', 5, 40], ['laufend 10 min', 2, 8], ['Aufräumen', 40, 4.5], ['Losgehen', 43, 2.5], ['Zeit um', 50, -5]];
  const out = {};
  for (const [, vp] of [['Desktop', { width: 1280, height: 720 }], ['Handy', { width: 390, height: 844 }]]) {
  await admin.setViewport(vp);
  for (const path of ['/', '/stundenziele']) {
    const hs = [];
    for (const [name, a, b] of states) {
      await admin.api('/api/settings', 'PUT', { roomName: 'Zimmer 101', roomChange: true, startTime: a === null ? '' : hhmm(new Date(now - a * 60000)), returnTime: b === null ? '' : hhmm(new Date(now + b * 60000)) });
      await admin.goto(BASE + path); await wait(600);
      const h = await admin.evaluate(() => document.querySelector('header.band').getBoundingClientRect().height);
      hs.push(h); out[path + ' ' + name] = h;
    }
    check(` : Kopfband immer gleich hoch`, hs.every((h) => Math.abs(h - hs[0]) < 0.5), JSON.stringify(hs));
  }
  }
  console.log(JSON.stringify(out));
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
