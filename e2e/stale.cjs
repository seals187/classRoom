// Kacheln: „seit … nichts abgehakt“ und Gelb nur während einer laufenden Stunde.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d) => d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const c = (await admin.api('/api/classes', 'POST', { name: '5a' })).data;
  await admin.api('/api/settings', 'PUT', { classId: c.id });
  await admin.api('/api/students', 'POST', { classId: c.id, firstName: 'Ben', lastName: 'Keller' });
  for (const kind of ['lesson', 'self']) await admin.api('/api/goals', 'POST', { kind, texts: ['Seite 10 lesen'] });
  const now = Date.now();
  for (const [name, a, b, expect] of [['ohne Stunde', null, null, false], ['Stunde läuft', 10, 30, true], ['Stunde vorbei (+20 min)', 80, -20, false], ['nur Raum, ohne Stunde', null, null, false]]) {
    await admin.api('/api/settings', 'PUT', { roomName: 'Zimmer 101', roomChange: name.includes('Raum'), startTime: a === null ? '' : hhmm(new Date(now - a * 60000)), returnTime: b === null ? '' : hhmm(new Date(now + b * 60000)) });
    for (const path of ['/stundenziele', '/selbstlernen']) {
      await admin.goto(BASE + path); await wait(500);
      const r = await admin.evaluate(() => ({ mins: document.querySelectorAll('.mins').length, legend: !!document.querySelector('.legend'), stale: document.querySelectorAll('.tile.stale').length }));
      check(`${name} ${path}: Zeit ${expect ? 'sichtbar' : 'weg'}`, expect ? r.mins === 1 && r.legend : r.mins === 0 && !r.legend && r.stale === 0, JSON.stringify(r));
    }
  }
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
