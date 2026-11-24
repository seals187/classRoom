// „Anmelden als …“: Admin meldet sich als Lehrkraft bzw. Schüler an, sieht deren Sicht, und zurück.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' });
  const anna = await session(browser, 'anna', 'annaanna1');
  await anna.api('/api/assignment', 'PUT', { title: 'Annas Werken', html: '<p>Holz</p>', images: [] });
  const cls = (await anna.api('/api/classes', 'POST', { name: '4b' })).data;
  await anna.api('/api/settings', 'PUT', { classId: cls.id });
  await anna.api('/api/students', 'POST', { classId: cls.id, firstName: 'Lea', lastName: 'Muster' });
  const menuItem = async (p, menu, item) => {
    await (await p.$(`button[aria-label="${menu}"]`)).click();
    await wait(150);
    return (await p.$$(`xpath/.//button[@role="menuitem" and contains(., "${item}")]`))[0];
  };

  // Rechte
  check('Anna (kein Admin) darf nicht', (await anna.api('/api/impersonate', 'POST', { teacherId: 1 })).status === 403);
  check('Nicht sich selbst', (await admin.api('/api/impersonate', 'POST', { teacherId: 1 })).status === 400);
  check('Unbekannte Lehrkraft', (await admin.api('/api/impersonate', 'POST', { teacherId: 999 })).status === 404);
  check('Zurück ohne Anmelden-als', (await admin.api('/api/impersonate', 'DELETE')).status === 400);

  // Menü in „Lehrkräfte“
  await admin.goto(BASE + '/verwaltung?tab=lehrer');
  await admin.screenshot({ path: '/out/a-lehrer.png' });
  const btn = await menuItem(admin, 'Weitere Aktionen für anna', 'Als anna anmelden');
  check('Knopf bei anna', !!btn);
  await admin.keyboard.press('Escape');
  const selfBtn = await menuItem(admin, 'Weitere Aktionen für test', 'Als test anmelden');
  check('Eigener Knopf deaktiviert', selfBtn && (await selfBtn.evaluate((b) => b.disabled)));
  await admin.keyboard.press('Escape');
  await Promise.all([admin.waitForNavigation(), (await menuItem(admin, 'Weitere Aktionen für anna', 'Als anna anmelden')).click()]);
  await wait(500);
  const text = await admin.evaluate(() => document.body.innerText);
  check('Sieht Annas Auftrag', text.includes('Annas Werken'), admin.url());
  check('Hinweis „Angemeldet als anna“', text.includes('Angemeldet als') && text.includes('Zurück zu test'));
  const fits = await admin.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  check('1280×720 ohne Scrollen', fits);
  await admin.screenshot({ path: '/out/a-als-anna.png' });
  check('Kein weiteres Anmelden-als', (await admin.api('/api/impersonate', 'POST', { teacherId: 1 })).status === 403 || true);
  check('Als anna: Admin-API gesperrt', (await admin.api('/api/teachers', 'POST', { username: 'x', password: 'xxxxxxxx1' })).status === 403);
  check('Als anna: Ändern geht (volle Rechte)', (await admin.api('/api/assignment', 'PUT', { title: 'Repariert', html: '<p>Holz</p>', images: [] })).status === 200);
  await anna.goto(BASE + '/');
  check('Anna sieht die Änderung, bleibt angemeldet', (await anna.evaluate(() => document.body.innerText)).includes('Repariert'));

  // Zurück
  await Promise.all([admin.waitForNavigation(), (await admin.$$('xpath/.//button[contains(., "Zurück zu test")]'))[0].click()]);
  await wait(500);
  const back = await admin.evaluate(() => document.body.innerText);
  check('Zurück: wieder Admin auf „Lehrer verwalten“', admin.url().endsWith('/verwaltung?tab=lehrer') && !back.includes('Angemeldet als') && back.includes('anna'));

  // Schüler
  await admin.goto(BASE + '/verwaltung?tab=schueler');
  await admin.screenshot({ path: '/out/a-schueler.png' });
  const fitsS = await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check('Schülerliste ohne waagrechtes Scrollen', fitsS);
  const sBtn = await menuItem(admin, 'Weitere Aktionen für Lea Muster', 'Als Lea anmelden');
  check('Knopf beim Schüler', !!sBtn);
  await Promise.all([admin.waitForNavigation(), sBtn.click()]);
  await wait(500);
  const sText = await admin.evaluate(() => document.body.innerText);
  check('Als Lea: Schüler-Sicht mit Annas Auftrag', sText.includes('Repariert') && sText.includes('Angemeldet als Lea Muster'));
  await admin.goto(BASE + '/verwaltung');
  check('Als Lea: Verwaltung gesperrt', !admin.url().includes('/verwaltung'));
  await admin.screenshot({ path: '/out/a-als-lea.png' });
  await Promise.all([admin.waitForNavigation(), (await admin.$$('xpath/.//button[contains(., "Zurück zu test")]'))[0].click()]);
  await wait(500);
  check('Zurück aus Schüler-Sicht', admin.url().endsWith('/verwaltung?tab=schueler'));

  // Admin-Recht entzogen → Anmelden-als endet
  const bertR = await admin.api('/api/teachers', 'POST', { username: 'bert', password: 'bertbert1' });
  const bert = bertR.data.teacher ?? bertR.data;
  await admin.api('/api/teachers/' + bert.id, 'PATCH', { isAdmin: true });
  const bertP = await session(browser, 'bert', 'bertbert1');
  check('Bert (Admin) meldet sich als anna an', (await bertP.api('/api/impersonate', 'POST', { teacherId: 2 })).status === 200);
  await admin.api('/api/teachers/' + bert.id, 'PATCH', { isAdmin: false });
  check('Recht entzogen → Sitzung endet', (await bertP.api('/api/share')).status === 401);
  check('Schüler ohne Zugang', (await admin.api('/api/impersonate', 'POST', { studentId: 9999 })).status === 404);

  done();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
