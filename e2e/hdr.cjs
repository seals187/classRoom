// Kopfband mit Klasse: passt ohne Überlappen (Startseite und Stundenziele, 1280×720).
const { open, session, check, done, BASE } = require('./lib.cjs');
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/settings', 'PUT', { roomName: 'Klassenzimmer', roomChange: true, startTime: '', returnTime: '' });
  for (const path of ['/', '/stundenziele']) {
    await admin.goto(BASE + path); await new Promise((r) => setTimeout(r, 500));
    const ok = await admin.evaluate(() => {
      const bar = document.querySelector('.idle-bar').getBoundingClientRect();
      const bad = [...document.querySelectorAll('.idle-bar *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > bar.right + 1 || r.left < bar.left - 1); }).map((e) => e.className + ':' + Math.round(e.getBoundingClientRect().right) + '/' + Math.round(bar.right)); return bad.length ? bad.join(' ') : true;
    });
    check('Startbalken passt: ' + path, ok === true, String(ok));
    await admin.screenshot({ path: '/out/h' + (path === '/' ? 'home' : 'ziele') + '.png', clip: { x: 0, y: 0, width: 1280, height: 140 } });
  }
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
