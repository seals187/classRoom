// Stunde endet von selbst 15 min nach dem Ende (Kopfband und Menü wieder „Stunde starten“).
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const now = Date.now();
  const at = async (startAgo, endAgo) => {
    await admin.api('/api/settings', 'PUT', { roomName: 'H28', roomChange: true, startTime: hhmm(new Date(now - startAgo * 60000)), returnTime: hhmm(new Date(now - endAgo * 60000)) });
    await admin.goto(BASE + '/'); await wait(1200);
    return admin.evaluate(() => ({ over: !!document.querySelector('header.band.over'), idle: !!document.querySelector('.idle-bar'), text: document.querySelector('header')?.innerText ?? '' }));
  };
  let s = await at(60, 10);
  check('10 min überzogen: noch „Zeit um“', s.over && !s.idle && s.text.includes('Zeit um'), s.text);
  await (await admin.$('button[aria-label="Menü"]')).click(); await wait(300);
  check('Menü: Stunde läuft, Beenden da', (await admin.evaluate(() => document.body.innerText)).toLowerCase().includes('stunde läuft'));
  s = await at(60, 16);
  check('16 min überzogen: wieder „Stunde starten“', !s.over && s.idle && s.text.includes('Stunde starten'), s.text);
  await admin.screenshot({ path: '/out/e-ended.png' });
  await admin.api('/api/settings', 'PUT', { roomName: 'H28', roomChange: true, startTime: hhmm(new Date(now - 60 * 60000)), returnTime: hhmm(new Date(now - 5 * 60000)) });
  await admin.goto(BASE + '/verwaltung'); await wait(800);
  check('Verwaltung: kein rotes Leuchten trotz Zeit um', !(await admin.$('header.band.over')) && !(await admin.$('header.band.go')));
  s = await at(500, 455);
  check('Viele Stunden später: Stunde starten', !s.over && s.idle);
  done();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
