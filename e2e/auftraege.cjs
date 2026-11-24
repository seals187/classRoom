// Mehrere Aufträge: Übersicht (Karten, Filter), Klassen + Datum, Zeigen/aktiv, Link pro Auftrag, Kopieren,
// Archiv, Weitergeben, Rechte, Schüler-Sicht, Menü (aufklappbar, passt ohne Scrollen). Screenshots au-*.png.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
};
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  const c5a = (await admin.api('/api/classes', 'POST', { name: '5a', color: '#f08a3c' })).data;
  const c6a = (await admin.api('/api/classes', 'POST', { name: '6a', color: '#8b5cd6' })).data;
  const meineKlasse = (await admin.api("/api/classes", "POST", { name: "Test-Klasse", color: "#3b6fe0" })).data;
  await admin.api("/api/settings", "PUT", { classId: meineKlasse.id });
  const st = await admin.api('/api/students', 'POST', { classId: meineKlasse.id, firstName: 'Lea', lastName: 'Muster' });
  const studentPw = st.data?.credentials?.password;
  const studentUser = st.data?.credentials?.username;

  const steps3 = '<ol><li>Bitte Buch lesen, Seite 10–15</li><li>Zusammenfassung schreiben</li><li>Das auch noch</li></ol>';
  const mk = async (title, classIds, date, html = steps3) =>
    (await admin.api('/api/assignments', 'POST', { title, html, images: [], classIds, date })).data;
  const g = await mk('Geschichte – 2. Weltkrieg', [meineKlasse.id], ymd(0));
  const m = await mk('Mathe – Brüche kürzen', [c5a.id], ymd(0), '<p>- Aufgabe 1</p><p>- Aufgabe 2</p><p>- Aufgabe 3</p>');
  const d = await mk('Deutsch – Wortarten', [c5a.id], ymd(1));
  const n = await mk('NMG – Römer Lesekarte', [c6a.id], null);
  const e = await mk('Englisch – Unit 4 Vokabeln', [meineKlasse.id, c6a.id], ymd(-7));
  check('5 Aufträge angelegt', [g, m, d, n, e].every((a) => a && a.id), JSON.stringify(g).slice(0, 200));
  check('Neuer Auftrag ist Entwurf, nicht aktiv', g.draft && !g.active);
  check('Schritte gezählt (Liste und „- “)', g.steps.length === 3 && m.steps.length === 3, `${g.steps.length}/${m.steps.length}`);

  // Zeigen
  const shown = (await admin.api(`/api/assignments/${g.id}/show`, 'POST')).data;
  check('Zeigen: aktiv, kein Entwurf mehr', shown.active && !shown.draft);
  for (const a of [m, d, e]) await admin.api(`/api/assignments/${a.id}/show`, 'POST');
  await admin.api(`/api/assignments/${g.id}/show`, 'POST');

  // Übersicht
  await admin.goto(BASE + '/auftraege'); await wait(600);
  const cards = await admin.evaluate(() => [...document.querySelectorAll('.card:not(.add)')].map((c) => ({
    title: c.querySelector('.title')?.textContent.trim(), status: c.querySelector('.status')?.textContent.trim(),
    btn: c.querySelector('.main-btn')?.textContent.trim(), active: c.classList.contains('active'), summary: c.querySelector('.summary')?.textContent.trim() })));
  check('Übersicht: 5 Karten + „Neuer Auftrag“', cards.length === 5 && !!(await admin.$('.card.add')), JSON.stringify(cards.map((c) => c.title)));
  const cg = cards.find((c) => c.title.startsWith('Geschichte'));
  check('Aktive Karte: „Heute · aktiv“, „Wird gezeigt“', cg?.active && cg.status === 'Heute · aktiv' && cg.btn.includes('Wird gezeigt'), JSON.stringify(cg));
  check('Morgen / Entwurf / Letzte Woche', cards.find((c) => c.title.startsWith('Deutsch'))?.status === 'Morgen'
    && cards.find((c) => c.title.startsWith('NMG'))?.status === 'Entwurf'
    && cards.find((c) => c.title.startsWith('Englisch'))?.status === 'Letzte Woche', JSON.stringify(cards.map((c) => c.status)));
  check('„3 Schritte“', cg?.summary === '3 Schritte', cg?.summary);
  check('Übersicht 1280×720 ohne Scrollen', await admin.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  for (const scheme of ['dark', 'light']) {
    await admin.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await admin.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme);
    await wait(150);
    await admin.screenshot({ path: `/out/au-uebersicht-${scheme}.png` });
  }
  // Filter
  const filter = async (label) => {
    await (await admin.$$(`xpath/.//div[@class and contains(@class,"filters")]/button[normalize-space(.)="${label}"]`))[0].click();
    await wait(150);
    return admin.evaluate(() => [...document.querySelectorAll('.card:not(.add) .title')].map((t) => t.textContent.trim()));
  };
  let t = await filter('5a');
  check('Filter 5a', t.length === 2 && t.every((x) => /Mathe|Deutsch/.test(x)), JSON.stringify(t));
  t = await filter('6a');
  check('Filter 6a (auch mehrere Klassen)', t.length === 2 && t.some((x) => x.startsWith('NMG')) && t.some((x) => x.startsWith('Englisch')), JSON.stringify(t));
  t = await filter('Entwürfe');
  check('Filter Entwürfe', t.length === 1 && t[0].startsWith('NMG'), JSON.stringify(t));
  await filter('Alle');

  // Zeigen über die Karte → Startseite zeigt ihn
  await Promise.all([admin.waitForNavigation(), (await admin.$$('xpath/.//article[.//a[contains(., "Mathe")]]//button[contains(., "Zeigen")]'))[0].click()]);
  await wait(500);
  check('Karte „Zeigen“: Startseite zeigt Mathe', admin.url() === BASE + '/' && (await admin.evaluate(() => document.querySelector('.assignment h2')?.textContent)).startsWith('Mathe'), admin.url());

  // Link pro Auftrag
  const sg = (await admin.api('/api/share', 'PUT', { assignment: g.id, days: 7 })).data;
  const sm = (await admin.api('/api/share', 'PUT', { assignment: m.id, days: 7 })).data;
  check('Zwei Links, verschiedene Codes', sg.code && sm.code && sg.code !== sm.code);
  const pub = await (await browser.createBrowserContext()).newPage();
  await pub.goto(BASE + '/a/' + sg.code); await wait(400);
  const pg = await pub.evaluate(() => document.querySelector('.assignment h2')?.textContent);
  await pub.goto(BASE + '/a/' + sm.code); await wait(400);
  const pm = await pub.evaluate(() => document.querySelector('.assignment h2')?.textContent);
  check('Link zeigt jeweils seinen Auftrag', pg?.startsWith('Geschichte') && pm?.startsWith('Mathe'), `${pg} / ${pm}`);
  const shares = (await admin.api('/api/share', 'GET')).data;
  check('Geteilte Aufträge: beide', shares.length === 2 && shares.every((s) => s.id));
  await admin.api('/api/share', 'DELETE', { assignment: g.id });
  await pub.goto(BASE + '/a/' + sg.code); await wait(300);
  const goneG = await pub.evaluate(() => !!document.querySelector('.gone'));
  await pub.goto(BASE + '/a/' + sm.code); await wait(300);
  check('Teilen beenden nur für diesen Auftrag', goneG && (await pub.evaluate(() => !!document.querySelector('.assignment h2'))));

  // Detailseite (nicht aktiv): Zeigen, Als Stundenziele, QR, ✎ öffnet Editor mit Klassen + Datum
  await admin.goto(BASE + `/auftraege/${d.id}`); await wait(500);
  const tools = await admin.evaluate(() => [...document.querySelectorAll('.tools .tool')].map((b) => b.textContent.trim() || b.getAttribute('aria-label')));
  check('Detail: Zeigen + Als Stundenziele + Teilen', tools.some((x) => x.includes('Zeigen')) && tools.some((x) => x.includes('Als Stundenziele')) && tools.some((x) => /QR/.test(x)), JSON.stringify(tools));
  await admin.goto(BASE + `/auftraege/${d.id}?edit`); await wait(700);
  const ed = await admin.evaluate(() => ({ editing: !!document.querySelector('.assignment.editing'),
    chips: [...document.querySelectorAll('.class-chip')].map((c) => [c.textContent.trim(), c.classList.contains('on')]),
    date: document.querySelector(".meta-date input")?.value, url: location.href, h: document.documentElement.scrollHeight }));
  check('✎: Editor mit Klassen (5a an) und Datum', ed.editing && ed.chips.some(([n, on]) => n === '5a' && on) && ed.date === ymd(1), JSON.stringify(ed));
  check('✎: ?edit verschwindet aus der Adresse', !ed.url.includes('edit'), ed.url);
  check('Editor 1280×720 ohne Scrollen', await admin.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  await admin.screenshot({ path: '/out/au-editor.png' });
  // Klasse 6a dazu, speichern
  await (await admin.$$('xpath/.//button[contains(@class,"class-chip") and contains(., "6a")]'))[0].click();
  await (await admin.$$('xpath/.//div[contains(@class,"head-actions")]/button[contains(., "Speichern")]'))[0].click(); await wait(600);
  const d2 = (await admin.api(`/api/assignments/${d.id}`, "PUT", {})).data;
  check("Speichern: Klassen 5a + 6a", d2.classIds.length === 2 && d2.classIds.includes(c6a.id) && d2.date === ymd(1), JSON.stringify(d2.classIds));

  // Neuer Auftrag über die Seite
  await admin.goto(BASE + '/auftraege/neu'); await wait(600);
  const neuChips = await admin.evaluate(() => [...document.querySelectorAll('.class-chip.on')].map((c) => c.textContent.trim()));
  check('Neu: aktive Klasse vorgewählt', neuChips.length === 1 && neuChips[0] === 'Test-Klasse', JSON.stringify(neuChips));
  await admin.type('.title-input', 'Neu aus dem Editor');
  await admin.click('.content.editable'); await admin.keyboard.type('- Eins');
  await Promise.all([admin.waitForNavigation().catch(() => {}), (await admin.$$('xpath/.//div[contains(@class,"head-actions")]/button[contains(., "Speichern")]'))[0].click()]);
  await wait(600);
  check('Neu gespeichert → Seite des Auftrags', /\/auftraege\/\d+$/.test(admin.url()) && (await admin.evaluate(() => document.querySelector('.assignment h2')?.textContent)) === 'Neu aus dem Editor', admin.url());
  const neuId = Number(admin.url().split('/').pop());
  // Abbrechen bei „Neu“ legt nichts an
  await admin.goto(BASE + '/auftraege/neu'); await wait(500);
  await Promise.all([admin.waitForNavigation(), (await admin.$$('xpath/.//div[contains(@class,"head-actions")]/button[contains(., "Abbrechen")]'))[0].click()]);
  await wait(400);
  check('Neu abbrechen → Übersicht, nichts angelegt', admin.url().endsWith('/auftraege') && (await admin.$$('.card:not(.add)')).length === 6);

  // Kopieren
  await (await admin.$$('xpath/.//article[.//a[contains(., "Geschichte")]]//button[@aria-label="Kopieren"]'))[0].click(); await wait(600);
  const titles = await admin.evaluate(() => [...document.querySelectorAll('.card:not(.add) .title')].map((t) => t.textContent.trim()));
  check('Kopieren: „… (Kopie)“ am Ende', titles.length === 7 && titles[6] === 'Geschichte – 2. Weltkrieg (Kopie)', JSON.stringify(titles));

  // Archiv: aktiven Auftrag (Mathe) archivieren
  await admin.api(`/api/assignments/${m.id}`, 'PUT', { archived: true });
  await admin.goto(BASE + '/auftraege'); await wait(500);
  t = await admin.evaluate(() => [...document.querySelectorAll('.card:not(.add) .title')].map((t) => t.textContent.trim()));
  check('Archiviert: nicht mehr unter „Alle“', !t.some((x) => x.startsWith('Mathe')));
  t = await filter('Archiv');
  check('Archiv zeigt ihn', t.length === 1 && t[0].startsWith('Mathe'), JSON.stringify(t));
  await admin.screenshot({ path: '/out/au-archiv.png' });
  await filter('Alle');
  await admin.goto(BASE + '/'); await wait(500);
  check('Aktiver archiviert → Startseite „Kein Auftrag aktiv“', (await admin.evaluate(() => document.querySelector('.assignment .empty')?.textContent ?? '')).includes('Kein Auftrag aktiv'));
  await admin.api(`/api/assignments/${g.id}/show`, 'POST');

  // Schüler sieht den aktiven
  if (studentUser && studentPw) {
    const s = await session(browser, studentUser, studentPw);
    await s.goto(BASE + '/'); await wait(400);
    check('Schüler sieht den aktiven Auftrag', (await s.evaluate(() => document.querySelector('.assignment h2')?.textContent))?.startsWith('Geschichte'));
    check('Schüler: /auftraege gesperrt', (await s.api('/api/assignments', 'POST', { title: 'x', html: '', images: [] })).status === 403);
  } else check('Schüler angelegt', false, JSON.stringify(st.data).slice(0, 200));

  // Rechte + Weitergeben
  const annaId = (await admin.api("/api/teachers", "POST", { username: "anna", password: "annaanna1" })).data?.id ?? 2;
  const anna = await session(browser, 'anna', 'annaanna1');
  check('Anna: fremden Auftrag nicht ändern', (await anna.api(`/api/assignments/${g.id}`, 'PUT', { title: 'x' })).status === 404);
  check('Anna: fremden nicht teilen', (await anna.api('/api/share', 'PUT', { assignment: g.id })).status === 403);
  check('Anna: fremde Klasse nicht zuordnen', (await anna.api('/api/assignments', 'POST', { title: 'x', html: '', images: [], classIds: [c5a.id] })).status === 400);
  check('Weitergeben: Kopie an anna', (await admin.api('/api/assignment/transfer', 'POST', { id: n.id, to: annaId, mode: 'copy' })).status === 204);
  await anna.goto(BASE + '/auftraege'); await wait(500);
  const annaCards = await anna.evaluate(() => [...document.querySelectorAll('.card:not(.add)')].map((c) => [c.querySelector('.title').textContent.trim(), c.querySelector('.class').textContent.trim()]));
  check('Anna hat ihn als Entwurf ohne Klasse', annaCards.length >= 1 && annaCards.some(([ti, cl]) => ti.startsWith('NMG') && cl === 'Ohne Klasse'), JSON.stringify(annaCards));
  check('Übertragen: bei admin weg', (await admin.api('/api/assignment/transfer', 'POST', { id: neuId, to: annaId, mode: 'move' })).status === 204
    && (await admin.api(`/api/assignments/${neuId}`, 'PUT', { title: 'x' })).status === 404);

  // Menü: Aufträge aufgeklappt (Standard) → Stunden-Karte kompakt, mind. 4 Aufträge, aktiver markiert, passt
  await admin.goto(BASE + '/'); await wait(500);
  await (await admin.$('button[aria-label="Menü"]')).click(); await wait(400);
  const state = () => admin.evaluate(() => ({
    items: [...document.querySelectorAll('.sub-list a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
    tabs: !!document.querySelector('.card .tabs'),
    fits: (() => { const d = document.querySelector('.drawer'); return d.scrollHeight <= d.clientHeight + 1; })() }));
  let ms = await state();
  check('Menü: mind. 4 Aufträge + Neu + Alle, aktiver markiert', ms.items.length >= 6 && ms.items.includes('+ Neuer Auftrag') && ms.items.includes('Alle Aufträge ›') && ms.items.some((x) => x.startsWith('Geschichte') && x.endsWith('aktiv')), JSON.stringify(ms.items));
  check('Menü: Stunden-Karte dabei kompakt, passt ohne Scrollen', !ms.tabs && ms.fits, JSON.stringify(ms));
  await admin.screenshot({ path: '/out/au-menu.png' });
  // Stunden-Karte aufklappen → Auftragsliste klappt zu (Akkordeon), passt
  await (await admin.$$('xpath/.//button[contains(@class,"status")]'))[0].click(); await wait(400);
  ms = await state();
  check('Karte auf → Liste zu, passt', ms.tabs && ms.items.length === 0 && ms.fits, JSON.stringify(ms));
  await admin.screenshot({ path: '/out/au-menu-karte.png' });
  await admin.keyboard.press('Escape'); await wait(200);
  await (await admin.$('button[aria-label="Menü"]')).click(); await wait(400);
  check('Gemerkt nach erneutem Öffnen', (await state()).tabs);
  // Liste wieder auf → Karte kompakt
  await (await admin.$('.nav-row')).click(); await wait(400);
  ms = await state();
  check('Liste auf → Karte kompakt, passt', !ms.tabs && ms.items.length >= 6 && ms.fits, JSON.stringify(ms));
  await admin.keyboard.press('Escape');

  // Handy
  await admin.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await admin.goto(BASE + '/auftraege'); await wait(500);
  check('Handy: kein waagrechtes Scrollen', await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await admin.screenshot({ path: '/out/au-handy.png' });
  done(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
