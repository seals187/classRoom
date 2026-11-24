// Geteilte Seite: Hell/Dunkel-Icon ganz rechts neben Vollbild (Desktop und Handy), Wahl bleibt nach Neuladen;
// abgelaufener Link ohne Knopf, aber mit der zuletzt gewählten Darstellung (Screenshots pt-*.png).
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte', html: '<ol><li>Seite 10–15 lesen</li><li>Zusammenfassung schreiben</li></ol>', images: [] });
  const code = (await admin.api('/api/share', 'PUT', {})).data.code;
  const now = Date.now();
  await admin.api('/api/settings', 'PUT', { roomName: 'Zimmer 101', roomChange: true,
    startTime: hhmm(new Date(now - 25 * 60000)), returnTime: hhmm(new Date(now + 21 * 60000)) });
  const theme = (p) => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const bg = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const ctxs = {};
  for (const [dev, vp] of [['desk', { width: 1280, height: 720 }], ['handy', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const ctx = await browser.createBrowserContext();
    const pub = await ctx.newPage();
    ctxs[dev] = pub;
    await pub.emulateTimezone('Europe/Zurich');
    await pub.setViewport(vp);
    await pub.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await pub.goto(BASE + '/a/' + code); await wait(600);
    const pos = await pub.evaluate(() => {
      const tools = [...document.querySelectorAll('.tools .tool')];
      const t = document.querySelector('.tools .tool.theme');
      const r = t.getBoundingClientRect();
      const full = document.querySelector('.tools .tool[aria-label="Vollbild"]').getBoundingClientRect();
      return { last: tools[tools.length - 1] === t, svg: !!t.querySelector('svg'), text: t.innerText.trim(), rightOfFull: r.left > full.right && Math.abs(r.top - full.top) < 2, top: r.top, inView: r.right <= innerWidth && r.bottom <= innerHeight };
    });
    check(`${dev}: Icon-Knopf ganz rechts neben Vollbild`, pos.last && pos.svg && !pos.text && pos.rightOfFull && pos.inView, JSON.stringify(pos));
    check(`${dev}: kein alter Schalter unten`, !(await pub.$('.toggle')));
    check(`${dev}: kein Scrollen`, await pub.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth));
    const bgLight = await bg(pub);
    await pub.screenshot({ path: `/out/pt-${dev}-light.png` });
    if (dev === 'handy') await pub.tap('.tool.theme'); else await pub.click('.tool.theme');
    await wait(200);
    const bgDark = await bg(pub);
    check(`${dev}: Dunkel gesetzt`, (await theme(pub)) === 'dark' && bgDark !== bgLight, `${bgLight} → ${bgDark}`);
    await pub.screenshot({ path: `/out/pt-${dev}-dark.png` });
    await pub.reload(); await wait(600);
    check(`${dev}: Dunkel bleibt nach Neuladen`, (await theme(pub)) === 'dark');
    if (dev === 'handy') await pub.tap('.tool.theme'); else await pub.click('.tool.theme');
    await wait(200);
    check(`${dev}: zurück auf Hell`, (await theme(pub)) === 'light' && (await bg(pub)) === bgLight);
  }
  // Desktop dunkel, Handy hell lassen – dann Link beenden
  await ctxs.desk.click('.tool.theme'); await wait(200);
  await admin.api('/api/share', 'DELETE', {});
  for (const [dev, want] of [['desk', 'dark'], ['handy', 'light']]) {
    const p = ctxs[dev];
    await p.goto(BASE + '/a/' + code); await wait(500);
    const gone = await p.evaluate(() => !!document.querySelector('.gone'));
    check(`${dev}: abgelaufener Link ohne Hell/Dunkel-Knopf`, gone && !(await p.$('.tool.theme')) && !(await p.$('.toggle')));
    check(`${dev}: abgelaufener Link zeigt letzte Wahl (${want})`, (await theme(p)) === want);
    await p.screenshot({ path: `/out/pt-${dev}-gone.png` });
  }
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
