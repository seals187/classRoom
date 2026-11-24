// Geteilte Seite: Zeitband in vier Phasen, Desktop und Handy, hell und dunkel (Screenshots p-*.png).
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const img = await admin.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 560;
    const g = c.getContext('2d');
    g.fillStyle = '#7a4b37'; g.fillRect(0, 0, 800, 560);
    g.fillStyle = '#b86b4f'; g.beginPath(); g.moveTo(0, 300); g.lineTo(200, 150); g.lineTo(400, 260); g.lineTo(800, 120); g.lineTo(800, 560); g.lineTo(0, 560); g.fill();
    g.fillStyle = '#e0a57d'; g.beginPath(); g.moveTo(0, 430); g.lineTo(300, 360); g.lineTo(800, 420); g.lineTo(800, 560); g.lineTo(0, 560); g.fill();
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const f = new FormData(); f.append('file', blob, 'a.png');
    return (await fetch('/api/files', { method: 'POST', body: f })).json();
  });
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte', html: '<ol><li>Seite 10–15 lesen</li><li>Zusammenfassung schreiben</li><li>Überlegen, was zum Krieg geführt hat</li></ol><p><a href="https://wikipedia.de">https://wikipedia.de</a></p>', images: [img.id] });
  const code = (await admin.api('/api/share', 'PUT', {})).data.code;
  const ctx = await browser.createBrowserContext();
  const pub = await ctx.newPage();
  await pub.emulateTimezone('Europe/Zurich');
  const now = Date.now();
  const lesson = (startAgo, endIn) => admin.api('/api/settings', 'PUT', { roomName: 'Zimmer 101', roomChange: true,
    startTime: startAgo === null ? '' : hhmm(new Date(now - startAgo * 60000)), returnTime: endIn === null ? '' : hhmm(new Date(now + endIn * 60000)) });
  const phases = [['1-arbeit', 25, 21, 'work'], ['2-aufraeumen', 40, 4.5, 'soon'], ['3-losgehen', 43, 2.5, 'go'], ['4-ohne', null, null, 'none']];
  for (const [name, a, b, cls] of phases) {
    await lesson(a, b);
    for (const [dev, vp] of [['desk', { width: 1280, height: 720 }], ['handy', { width: 390, height: 844, deviceScaleFactor: 2 }]]) {
      await pub.setViewport(vp);
      for (const scheme of name === '4-ohne' ? ['light', 'dark'] : ['dark', 'light']) {
        await pub.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
        await pub.goto(BASE + '/a/' + code); await wait(700);
        if (scheme === (name === '4-ohne' ? 'light' : 'dark')) {
          const ok = await pub.evaluate((c) => !!document.querySelector('.pband.' + c), cls);
          check(`${name} ${dev}: Band ${cls}`, ok, await pub.evaluate(() => document.querySelector('.pband')?.className));
          const noScrollX = await pub.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
          check(`${name} ${dev}: kein waagrechtes Scrollen`, noScrollX);
        }
        await pub.screenshot({ path: `/out/p-${name}-${dev}-${scheme}.png` });
      }
    }
  }
  // Losgehen Handy: Auftrag eingeklappt, aufklappbar
  await lesson(43, 2.5);
  await pub.setViewport({ width: 390, height: 844 });
  await pub.goto(BASE + '/a/' + code); await wait(500);
  const hidden = await pub.evaluate(() => getComputedStyle(document.querySelector('.task')).display === 'none');
  await pub.click('.collapsed'); await wait(200);
  const shown = await pub.evaluate(() => getComputedStyle(document.querySelector('.task')).display !== 'none');
  check('Losgehen Handy: Auftrag eingeklappt und aufklappbar', hidden && shown);
  check('Kein Name/Klasse sichtbar', !(await pub.evaluate(() => document.body.innerText)).includes('Meine Klasse'));
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
