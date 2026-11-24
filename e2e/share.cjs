// Auftrag teilen (QR-Code): öffentlicher Link, Bilder, Rechte, Ablauf, neuer Link, Beenden, Screenshots.
const { open, session, check, done, BASE } = require('./lib.cjs');
const HOME = BASE + '/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' });
  const anna = await session(browser, 'anna', 'annaanna1');
  // Schüler mit Login, Ziel – darf auf der öffentlichen Seite nicht auftauchen
  const st = await admin.api('/api/students', 'POST', { firstName: 'Lea', lastName: 'Geheim' });
  const studentId = st.data?.id ?? st.data?.student?.id;

  // Bild hochladen
  const img = await admin.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 260;
    const g = c.getContext('2d');
    g.fillStyle = '#3767d6'; g.fillRect(0, 0, 400, 260);
    g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText('Bild 1', 120, 140);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const f = new FormData(); f.append('file', blob, 'a.png');
    return (await fetch('/api/files', { method: 'POST', body: f })).json();
  });
  const other = await admin.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 50; c.height = 50;
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const f = new FormData(); f.append('file', blob, 'b.png');
    return (await fetch('/api/files', { method: 'POST', body: f })).json();
  });
  await admin.api('/api/assignment', 'PUT', {
    title: 'Geschichte – Das Römische Reich',
    html: '<p>Lest den Text und beantwortet die Fragen.</p><ol><li>Seite 42 lesen<br>Notizen machen</li><li>Fragen 1–5 beantworten</li><li>Mit dem Partner vergleichen</li></ol><p><a href="https://de.wikipedia.org/wiki/R%C3%B6misches_Reich">https://de.wikipedia.org/wiki/R%C3%B6misches_Reich</a></p>',
    images: [img.id]
  });
  if (studentId) await admin.api('/api/goals', 'POST', { studentIds: [studentId], text: 'Seite 42 lesen', kind: 'lesson' });

  // --- API ---
  check('Ohne Auftrag kein Teilen', (await anna.api('/api/share', 'PUT', {})).status === 404);
  const s1 = await admin.api('/api/share', 'PUT', { days: 7 });
  check('Teilen starten', s1.status === 200 && /^[a-z2-9]{10}$/.test(s1.data.code), JSON.stringify(s1.data));
  const days = Math.round((s1.data.expiresAt - Date.now()) / 86400000);
  check('Gültig 7 Tage', days === 7, String(days));
  check('Ungültige Gültigkeit', (await admin.api('/api/share', 'PUT', { days: 0 })).status === 400);
  const code = s1.data.code;
  const same = await admin.api('/api/share', 'PUT', { days: 1 });
  check('Gültigkeit ändern behält den Code', same.data.code === code && Math.round((same.data.expiresAt - Date.now()) / 3600000) === 24);

  await anna.api('/api/assignment', 'PUT', { title: 'Annas Auftrag', html: '<p>Hallo</p>', images: [] });
  const sa = await anna.api('/api/share', 'PUT', {});
  check('Anna teilt mit Standard (7 Tage)', sa.status === 200 && Math.round((sa.data.expiresAt - Date.now()) / 86400000) === 7);
  check('Anna sieht nur ihren', (await anna.api('/api/share')).data.length === 1);
  check('Admin sieht alle', (await admin.api('/api/share')).data.length === 2);
  check('Anna darf Admin-Link nicht beenden', (await anna.api('/api/share', 'DELETE', { teacher: 1 })).status === 403);
  check('Anna darf Admin-Link nicht ändern', (await anna.api('/api/share', 'PUT', { teacher: 1, renew: true })).status === 403);

  // --- Öffentlich (eigener Kontext ohne Anmeldung) ---
  const ctx = await browser.createBrowserContext();
  const pub = await ctx.newPage();
  await pub.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const res = await pub.goto(BASE + '/a/' + code);
  check('Öffentliche Seite ohne Login 200', res.status() === 200 && !pub.url().includes('/login'), pub.url());
  const h = res.headers();
  check('Header noindex/no-referrer/no-store', h['x-robots-tag']?.includes('noindex') && h['referrer-policy'] === 'no-referrer' && h['cache-control'] === 'no-store', JSON.stringify(h));
  const text = await pub.evaluate(() => document.body.innerText);
  check('Titel und Text sichtbar', text.includes('Römische Reich') && text.includes('Seite 42 lesen'));
  check('Keine Namen/Ziele/Menü', !text.includes('Geheim') && !text.includes('Lea') && !text.includes('Stundenziele') && !(await pub.$('button[aria-label="Menü"]')));
  check('Kein Bearbeiten/Teilen/Weitergeben', !(await pub.$('[aria-label="Bearbeiten"]')) && !(await pub.$('[aria-label*="QR"]')) && !(await pub.$('[aria-label="Auftrag weitergeben"]')));
  const imgSrc = await pub.evaluate(() => document.querySelector('.media img')?.getAttribute('src'));
  check('Bild über öffentlichen Pfad', imgSrc === `/a/${code}/bild/${img.id}`, imgSrc);
  const imgOk = await pub.evaluate(async (u) => (await fetch(u)).status, imgSrc);
  check('Bild abrufbar', imgOk === 200);
  check('Fremdes Bild nicht abrufbar', (await pub.evaluate(async (u) => (await fetch(u)).status, `/a/${code}/bild/${other.id}`)) === 404);
  check('Bild mit falschem Code nicht abrufbar', (await pub.evaluate(async (u) => (await fetch(u)).status, `/a/aaaaaaaaaa/bild/${img.id}`)) === 404);
  check('Bild ohne Code über /api/files gesperrt', (await pub.evaluate(async (u) => (await fetch(u)).status, `/api/files/${img.id}`)) === 401);
  const link = await pub.evaluate(() => { const a = document.querySelector('.content a'); return a && [a.target, a.rel]; });
  check('Link öffnet neu, noreferrer', link && link[0] === '_blank' && link[1].includes('noreferrer'), JSON.stringify(link));
  check('Großbuchstaben im Code gehen', (await pub.evaluate(async (u) => (await fetch(u)).status, '/a/' + code.toUpperCase())) === 200);
  check('API bleibt gesperrt', (await pub.evaluate(async () => (await fetch('/api/share')).status)) === 401);
  await pub.screenshot({ path: '/out/s-public-light.png' });
  await pub.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await pub.reload();
  await wait(300);
  await pub.screenshot({ path: '/out/s-public-dark.png' });
  await pub.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // Angemeldeter Schüler sieht die öffentliche Seite auch (ohne Kopfband)
  // Live-Aktualisierung: Admin ändert Titel, Seite lädt nach 30 s nach
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte – Das Römische Reich (neu)', html: '<p>Lest den Text und beantwortet die Fragen.</p><ol><li>Seite 42 lesen<br>Notizen machen</li><li>Fragen 1–5 beantworten</li></ol>', images: [img.id] });
  await pub.goto(BASE + '/a/' + code);
  const share2 = await admin.api('/api/share');
  check('Bearbeiten behält den Link', share2.data.find((s) => s.teacherId === 1)?.code === code);
  await admin.api('/api/assignment', 'PUT', { title: 'Live geändert', html: '<p>Neu</p>', images: [img.id] });
  await wait(32000);
  check('Öffentliche Seite aktualisiert sich nach 30 s', (await pub.evaluate(() => document.body.innerText)).includes('Live geändert'));

  // Neuer Link
  const s2 = await admin.api('/api/share', 'PUT', { renew: true });
  check('Neuer Link: anderer Code', s2.data.code !== code);
  await pub.goto(BASE + '/a/' + code);
  check('Alter Link ungültig', (await pub.evaluate(() => document.body.innerText)).includes('nicht mehr gültig'));
  await pub.screenshot({ path: '/out/s-gone.png' });
  const code2 = s2.data.code;

  // Weitergeben: Die Kopie kommt ungeteilt an, die Links bleiben, wie sie sind (ein Auftrag mehr statt Ersetzen)
  const annaActive = (await anna.api('/api/share')).data[0].id;
  check('Kopie an test', (await anna.api('/api/assignment/transfer', 'POST', { id: annaActive, to: 1, mode: 'copy' })).status === 204);
  check('Kopie ist ungeteilt, test-Link bleibt', (await admin.api('/api/share')).data.filter((s) => s.teacherId === 1).length === 1);
  await admin.api('/api/share', 'DELETE', {});
  await pub.goto(BASE + '/a/' + code2);
  check('Link nach Beenden ungültig', (await pub.evaluate(() => document.body.innerText)).includes('nicht mehr gültig'));
  check('Anna noch geteilt (Quelle der Kopie)', (await anna.api('/api/share')).data.length === 1);
  check('Admin beendet Annas Link', (await admin.api('/api/share', 'DELETE', { teacher: 2 })).status === 204);
  check('Anna: nichts mehr geteilt', (await anna.api('/api/share')).data.length === 0);

  // Auftrag löschen beendet
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte – Das Römische Reich', html: '<p>Lest den Text und beantwortet die Fragen.</p><ol><li>Seite 42 lesen<br>Notizen machen</li><li>Fragen 1–5 beantworten</li><li>Mit dem Partner vergleichen</li></ol><p><a href="https://de.wikipedia.org/wiki/R%C3%B6misches_Reich">https://de.wikipedia.org/wiki/R%C3%B6misches_Reich</a></p>', images: [img.id] });
  const s3 = await admin.api('/api/share', 'PUT', {});
  await admin.api('/api/assignment', 'DELETE');
  await pub.goto(BASE + '/a/' + s3.data.code);
  check('Auftrag gelöscht → Link ungültig', (await pub.evaluate(() => document.body.innerText)).includes('nicht mehr gültig'));

  // --- UI (1280×720) ---
  await admin.api('/api/assignment', 'PUT', { title: 'Geschichte – Das Römische Reich', html: '<p>Lest den Text und beantwortet die Fragen.</p><ol><li>Seite 42 lesen<br>Notizen machen</li><li>Fragen 1–5 beantworten</li><li>Mit dem Partner vergleichen</li></ol><p><a href="https://de.wikipedia.org/wiki/R%C3%B6misches_Reich">https://de.wikipedia.org/wiki/R%C3%B6misches_Reich</a></p>', images: [img.id] });
  await admin.goto(HOME);
  const qrBtn = await admin.$('button[aria-label="Per QR-Code teilen"]');
  check('QR-Knopf in der Leiste', !!qrBtn);
  await admin.screenshot({ path: '/out/s-toolbar.png' });
  await qrBtn.click();
  await wait(300);
  await admin.screenshot({ path: '/out/s-start.png' });
  const startBtn = await admin.$$('xpath/.//button[contains(., "Teilen starten")]');
  await startBtn[0].click();
  await wait(800);
  const fits = await admin.evaluate(() => { const p = document.querySelector('.panel.big'); const r = p?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight && document.documentElement.scrollHeight <= innerHeight + 1; });
  check('Großer QR passt in 1280×720', !!fits);
  const shown = await admin.evaluate(() => document.querySelector('.panel.big .link')?.innerText);
  check('Kurzer Link sichtbar', /\/a\/[a-z2-9]{10}$/.test(shown ?? ''), shown);
  await admin.screenshot({ path: '/out/s-qr-light.png' });
  // QR dekodieren geht hier nicht ohne Bibliothek – stattdessen prüfen, ob die Seite hinter dem Link geht
  const r2 = await pub.goto('http://' + shown);
  check('Link aus dem Fenster öffnet den Auftrag', r2.status() === 200 && (await pub.evaluate(() => document.body.innerText)).includes('Römische'));
  await admin.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); });
  await wait(200);
  await admin.screenshot({ path: '/out/s-qr-dark.png' });
  // Ecke
  await (await admin.$('.panel.big input[type=checkbox]')).click();
  await (await admin.$$('xpath/.//div[contains(@class,"panel")]//button[contains(., "Schließen")]'))[0].click();
  await wait(300);
  check('Ecken-QR sichtbar', !!(await admin.$('.corner-qr')));
  await admin.screenshot({ path: '/out/s-corner-dark.png' });
  await admin.evaluate(() => { localStorage.setItem('theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); });
  await admin.reload();
  await wait(500);
  check('Ecken-QR bleibt nach Neuladen', !!(await admin.$('.corner-qr')));
  const scroll = await admin.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  check('Startseite ohne Scrollen', scroll);
  await admin.screenshot({ path: '/out/s-corner-light.png' });
  await (await admin.$('.corner-qr')).click();
  await wait(300);
  check('Klick auf Ecke öffnet groß', !!(await admin.$('.panel.big')));
  await admin.keyboard.press('Escape');

  // Menü
  await anna.api('/api/share', 'PUT', {});
  await admin.reload();
  await (await admin.$('button[aria-label="Menü"]')).click();
  await wait(300);
  const row = await admin.$$('xpath/.//button[contains(., "Geteilte Aufträge")]');
  check('Menüzeile da', row.length === 1, row.length && (await row[0].evaluate((e) => e.innerText)));
  await admin.screenshot({ path: '/out/s-menu.png' });
  await row[0].click();
  await wait(500);
  const n = await admin.evaluate(() => document.querySelectorAll('.share').length);
  check('Übersicht: 2 geteilte (Admin)', n === 2, String(n));
  await admin.screenshot({ path: '/out/s-menu-list.png' });
  const ends = await admin.$$('xpath/.//div[contains(@class,"share")]//button[contains(., "Beenden")]');
  await ends[1].click();
  await wait(300);
  await admin.screenshot({ path: '/out/s-menu-confirm.png' });
  await (await admin.$$('xpath/.//button[normalize-space(.)="Beenden" and not(ancestor::div[contains(@class,"share")])]'))[0].click();
  await wait(600);
  check('Beenden im Menü', (await admin.evaluate(() => document.querySelectorAll('.share').length)) === 1);

  // Schüler-Login sieht die öffentliche Seite
  done();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
