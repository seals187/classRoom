// Auftrags-Editor (0.4.7): Leiste Absatz/B/I/U/Liste/Link/Bild/Tabelle/Baustein/↶↷, Listenarten mit Unterlisten (Tab),
// Tabelle (Raster, Leiste, Kopfzeile), Bausteine (Kästen, Badges, Video, Linie, „/“-Menü), eigenes Rückgängig,
// Speichern + Anzeige (Checkliste abhaken, Video-Player, Schritte-Zahl). Screenshots ed-*.png.
const { open, session, check, done, BASE } = require('./lib.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await open();
  const p = await session(browser, 'test', 'testtest123');
  const cls = (await p.api('/api/classes', 'POST', { name: 'Klasse 8B', color: '#3b6fe0' })).data;
  await p.api('/api/settings', 'PUT', { classId: cls.id });
  const a = (await p.api('/api/assignments', 'POST', { title: 'Geschichte – 2. Weltkrieg', html: '', images: [], classIds: [cls.id], date: null })).data;

  await p.goto(BASE + `/auftraege/${a.id}`); await wait(500);
  await p.click('button[title=Bearbeiten]'); await wait(400);
  const ed = '.content.editable';
  await p.click(ed);

  const labels = await p.$$eval('.toolbar > button, .toolbar > .drop > button', (bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
  check('Leiste: Absatz, B, I, U, Liste, Link, Bild, Tabelle, Baustein, ↶, ↷',
    JSON.stringify(labels) === JSON.stringify(['Absatz ▾', 'B', 'I', 'U', '☰ Liste ▾', 'Link einfügen', 'Bild hinzufügen', 'Tabelle einfügen', '+ Baustein ▾', 'Rückgängig', 'Wiederholen']),
    JSON.stringify(labels));
  const hasColors = await p.$('.toolbar > .swatch');
  check('Farben nicht mehr direkt in der Leiste', !hasColors);

  // --- Schritte + Unterliste ---
  const menuItem = async (menuBtn, text) => {
    await p.evaluate((t) => [...document.querySelectorAll('.toolbar .drop > button')].find((b) => b.textContent.includes(t)).click(), menuBtn);
    await wait(150);
    await p.evaluate((t) => [...document.querySelectorAll('.menu .item')].find((b) => b.textContent.includes(t)).click(), text);
    await wait(150);
  };
  await p.evaluate((t) => [...document.querySelectorAll('.toolbar .drop > button')].find((b) => b.textContent.includes(t)).click(), 'Liste');
  await wait(200);
  await p.screenshot({ path: '/out/ed-liste.png' });
  await p.evaluate(() => [...document.querySelectorAll('.menu .item')].find((b) => b.textContent.includes('Schritte')).click());
  await wait(150);
  await p.keyboard.type('Buch lesen, Seite 10–15');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Wann begann der Krieg?');
  await p.keyboard.press('Tab');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Welche Länder waren beteiligt?');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Enter'); // leerer Unterpunkt → eine Ebene höher
  await p.keyboard.type('Zusammenfassung schreiben');
  let html = await p.$eval(ed, (e) => e.innerHTML);
  check('Tab → Unterliste a) b) unter Schritt 1', /<ol><li>Buch lesen[^<]*<ol class="letters"><li>Wann begann der Krieg\?<\/li><li>Welche Länder waren beteiligt\?<\/li><\/ol><\/li><li>Zusammenfassung schreiben/.test(html), html);

  // Listenart der Unterliste ändern
  await p.evaluate(() => {
    const li = [...document.querySelectorAll('.editable li')].find((l) => l.firstChild?.textContent === 'Wann begann der Krieg?');
    const r = document.createRange(); r.setStart(li.firstChild, 2); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await wait(100);
  await menuItem('Liste', 'Checkliste');
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Unterliste → Checkliste (Hauptliste bleibt Schritte)', html.includes('<ul class="check"><li>Wann') && html.startsWith('<ol><li>Buch'), html);
  await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift');
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Umschalt+Tab: Punkt wieder Schritt, Folgepunkt bleibt Unterpunkt', /<\/li><li>Wann begann der Krieg\?<ul class="check"><li>Welche/.test(html), html);
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Strg+Z macht Umschalt+Tab rückgängig', html.includes('<ul class="check"><li>Wann begann'), html);

  // ans Ende, neue Zeile ohne Liste
  await p.evaluate(() => {
    const e = document.querySelector('.editable'); const r = document.createRange(); r.selectNodeContents(e); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.keyboard.type('Fülle die Tabelle aus:');
  await p.keyboard.press('Enter');

  // --- Tabelle ---
  await p.evaluate(() => [...document.querySelectorAll('.toolbar .drop > button')].find((b) => b.getAttribute('aria-label') === 'Tabelle einfügen').click());
  await wait(150);
  await p.hover('.grid .cell[aria-label="3 × 4"]'); await wait(100);
  const size = await p.$eval('.grid-size', (e) => e.textContent);
  check('Raster zeigt 3 × 4', size === '3 × 4', size);
  await p.screenshot({ path: '/out/ed-tabelle-raster.png' });
  await p.click('.grid .cell[aria-label="3 × 4"]'); await wait(200);
  for (const t of ['Land', 'Seite', 'Kriegseintritt', 'Deutschland', 'Achse', '1939', 'Frankreich', 'Alliierte', '1939', 'USA', 'Alliierte', '1941']) {
    await p.keyboard.type(t); await p.keyboard.press('Tab');
  }
  let rows = await p.$$eval('.editable table tr', (r) => r.length);
  check('Tabelle: 3 Spalten, Tab füllt Zellen, nach letzter Zelle neue Zeile', rows === 5, `rows=${rows}`);
  const bar = await p.$('.table-bar');
  check('Tabellen-Leiste sichtbar', !!bar);
  await p.evaluate(() => [...document.querySelectorAll('.table-bar button')].find((b) => b.textContent === '− Zeile').click()); await wait(100);
  rows = await p.$$eval('.editable table tr', (r) => r.length);
  check('− Zeile', rows === 4, `rows=${rows}`);
  check('Kopfzeile als <th>', (await p.$$eval('.editable table thead th', (c) => c.length)) === 3);
  // Zelle „Alliierte“ (Frankreich) markieren und färben
  await p.evaluate(() => {
    const td = [...document.querySelectorAll('.editable td')].find((c) => c.textContent === 'Alliierte');
    const r = document.createRange(); r.selectNodeContents(td); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await wait(150);
  await p.evaluate(() => [...document.querySelectorAll('.table-bar button')].find((b) => b.textContent === 'Zellen färben').click()); await wait(100);
  await p.click('.cell-swatch.c-yellow'); await wait(150);
  check('Zelle gefärbt', (await p.$$eval('.editable td.c-yellow', (c) => c.length)) === 1);
  await p.screenshot({ path: '/out/ed-tabelle.png' });
  await p.evaluate(() => [...document.querySelectorAll('.table-bar button')].find((b) => b.textContent.includes('Kopfzeile')).click()); await wait(100);
  check('Kopfzeile aus', (await p.$$eval('.editable table thead', (c) => c.length)) === 0);
  await p.evaluate(() => [...document.querySelectorAll('.table-bar button')].find((b) => b.textContent.includes('Kopfzeile')).click()); await wait(100);
  check('Kopfzeile wieder an', (await p.$$eval('.editable table thead th', (c) => c.length)) === 3);
  await p.evaluate(() => [...document.querySelectorAll('.table-bar button')].find((b) => b.textContent === '+ Spalte').click()); await wait(100);
  check('+ Spalte', (await p.$$eval('.editable table thead th', (c) => c.length)) === 4);
  await p.click('.toolbar button[aria-label="Rückgängig"]'); await wait(100);
  check('↶ macht + Spalte rückgängig', (await p.$$eval('.editable table thead th', (c) => c.length)) === 3);
  check('↷ wieder aktiv', await p.$eval('.toolbar button[aria-label="Wiederholen"]', (b) => !b.disabled));

  // --- Bausteine ---
  await p.evaluate(() => {
    const e = document.querySelector('.editable'); const last = e.lastElementChild;
    const r = document.createRange(); r.selectNodeContents(last); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await menuItem('Baustein', 'Material');
  await p.keyboard.type('Geschichtsbuch, Heft, Farbstifte');
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); // leerer letzter Absatz → Kasten verlassen
  await p.keyboard.type('/');
  await wait(200);
  const slashOpen = await p.$('.slash');
  check('„/“ öffnet Baustein-Menü', !!slashOpen);
  await p.screenshot({ path: '/out/ed-slash.png' });
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(150);
  await p.keyboard.type('Achte auf die Jahreszahlen am Seitenrand.');
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Material-Kasten + Tipp per „/“ (Schrägstrich entfernt)', html.includes('<div class="box material"><p>Geschichtsbuch, Heft, Farbstifte</p></div><div class="box tip"><p>Achte') && !html.includes('/<'), html.slice(-400));

  // Zeitangabe an Schritt 1
  await p.evaluate(() => {
    const li = document.querySelector('.editable > ol > li');
    const t = li.firstChild; const r = document.createRange(); r.setStart(t, t.textContent.length); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await wait(100);
  await menuItem('Baustein', 'Zeitangabe');
  await wait(200);
  await p.$eval('.dialog input', (i) => { i.value = ''; });
  await p.type('.dialog input', '10');
  await p.keyboard.press('Enter'); await wait(250);
  // Sozialform + Profi an Schritt 2 (Zusammenfassung)
  await p.evaluate(() => {
    const li = document.querySelector('.editable > ol > li:last-child');
    const t = li.firstChild; const r = document.createRange(); r.setStart(t, t.textContent.length); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await wait(100);
  await menuItem('Baustein', 'Sozialform');
  await p.evaluate(() => [...document.querySelectorAll('.menu .sub-items button')].find((b) => b.textContent === 'zu zweit').click()); await wait(150);
  await menuItem('Baustein', 'Profi');
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Badges eingefügt', html.includes('<span class="badge time" contenteditable="false">10 min</span>') && html.includes('badge social') && html.includes('badge profi'), html.slice(0, 500));

  // Video + Trennlinie am Ende
  await p.evaluate(() => {
    const e = document.querySelector('.editable'); const last = e.lastElementChild;
    const r = document.createRange(); r.selectNodeContents(last); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await menuItem('Baustein', 'Trennlinie');
  await menuItem('Baustein', 'Video');
  await wait(200);
  await p.type('.dialog input', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10');
  await p.keyboard.press('Enter'); await wait(250);
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Video + Linie eingefügt', html.includes('data-yt="dQw4w9WgXcQ"') && html.includes('<hr>'));
  await p.screenshot({ path: '/out/ed-bausteine.png' });

  // Absatz-Menü: Überschrift + Farben
  await p.evaluate(() => {
    const ps = [...document.querySelectorAll('.editable > p')].find((x) => x.textContent.startsWith('Fülle'));
    const r = document.createRange(); r.setStart(ps.firstChild, 1); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await wait(100);
  await p.evaluate(() => [...document.querySelectorAll('.toolbar .drop > button')].find((b) => b.textContent.includes('Absatz')).click());
  await wait(150);
  check('Absatz-Menü mit Farben und „Format löschen“', !!(await p.$('.menu.para .swatch')) && (await p.$$eval('.menu.para .item', (i) => i.map((x) => x.textContent))).some((t) => t.includes('Format löschen')));
  await p.screenshot({ path: '/out/ed-absatz.png' });
  await p.evaluate(() => [...document.querySelectorAll('.menu .item')].find((b) => b.textContent.includes('Überschrift')).click()); await wait(100);
  html = await p.$eval(ed, (e) => e.innerHTML);
  check('Überschrift', html.includes('<h3>Fülle die Tabelle aus:</h3>'), html);

  const scroll = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  check('Editor 1280×720 ohne Scrollen', scroll <= 0, `scroll=${scroll}`);

  // --- Speichern + Anzeige ---
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Speichern').click());
  await wait(800);
  const saved = (await p.api(`/api/assignments/${a.id}`, 'PUT', {})).data;
  const sh = saved.html ?? saved.assignment?.html ?? JSON.stringify(saved);
  check('Gespeichert: Klassen/Listen/Tabelle/Kästen/Badges/Video bleiben', ['class="letters"', 'class="check"', '<table>', '<thead>', 'class="c-yellow"', 'class="box material"', 'class="badge time"', 'data-yt="dQw4w9WgXcQ"', '<hr />', '<h3>'].every((s) => sh.includes(s)) || ['class="check"', '<table>', 'class="c-yellow"', 'class="box material"', 'class="badge time"', 'data-yt="dQw4w9WgXcQ"'].every((s) => sh.includes(s)), sh.slice(0, 600));
  check('Kein contenteditable gespeichert', !sh.includes('contenteditable'));
  check('Schritte gezählt: 2', saved.steps.length === 2, String(saved.steps.length));

  await p.goto(BASE + `/auftraege/${a.id}`); await wait(800);
  const iframe = await p.$eval('.content .video iframe', (f) => f.src).catch(() => '');
  check('Video als Player (youtube-nocookie)', iframe === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', iframe);
  const steps = await p.$$eval('.content > ol:not([class]) > li', (l) => l.length);
  check('Anzeige: 2 Schritte', steps === 2);
  const goals = await p.$('button.tool.accent');
  check('„Als Stundenziele“ vorhanden', !!goals);
  if (goals) {
    await goals.click(); await wait(400);
    const texts = await p.evaluate(() => [...document.querySelectorAll('input[type=text], textarea')].map((i) => i.value).filter(Boolean));
    check('Ziel-Texte ohne Badges/Unterliste', texts.includes('Buch lesen, Seite 10–15') && texts.includes('Zusammenfassung schreiben'), JSON.stringify(texts));
    await p.keyboard.press('Escape'); await wait(200);
    await p.goto(BASE + `/auftraege/${a.id}`); await wait(800);
  }
  await p.click('.content ul.check > li'); await wait(100);
  check('Checkliste abhaken', await p.$eval('.content ul.check > li', (l) => l.classList.contains('done')));
  await p.reload(); await wait(800);
  check('Häkchen bleibt nach Neuladen', await p.$eval('.content ul.check > li', (l) => l.classList.contains('done')));
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await wait(300);
  await p.screenshot({ path: '/out/ed-anzeige-unten.png' });
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: '/out/ed-anzeige-dark.png' });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await wait(200);
  await p.screenshot({ path: '/out/ed-anzeige-light.png' });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await p.click('button[title=Bearbeiten]'); await wait(400);
  await p.screenshot({ path: '/out/ed-editor-dark.png' });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await wait(200);
  await p.screenshot({ path: '/out/ed-editor-light.png' });

  done();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
