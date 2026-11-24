// Upgrade 0.3.7 → Klassen: "seed" auf der alten Version, "check" auf der neuen.
const { open, session, check, done, BASE } = require('./lib.cjs');
(async () => {
  const browser = await open();
  const admin = await session(browser, 'test', 'testtest123');
  if (process.argv[2] === 'seed') {
    await admin.api('/api/teachers', 'POST', { username: 'anna', password: 'annaanna1' }); // id 2
    await admin.api('/api/teachers', 'POST', { username: 'chef', password: 'chefchef1' }); // id 3
    await admin.api('/api/teachers/3', 'PATCH', { seesAll: true });
    for (const [f, l] of [['Lea', 'Admin'], ['Tim', 'Admin']]) await admin.api('/api/students', 'POST', { firstName: f, lastName: l });
    const anna = await session(browser, 'anna', 'annaanna1');
    for (const [f, l] of [['Mia', 'Anna'], ['Noa', 'Beide']]) await anna.api('/api/students', 'POST', { firstName: f, lastName: l });
    // Noa (anna) zusätzlich beim Admin
    const noaId = 4; // Reihenfolge: Lea 1, Tim 2, Mia 3, Noa 4
    console.log('patch', (await admin.api('/api/students/' + noaId, 'PATCH', { teacherIds: [1, 2] })).status);
    await anna.api('/api/goals', 'POST', { kind: 'lesson', texts: ['Altes Ziel'] });
    console.log('seeded');
  } else {
    const text = async (p, path) => { await p.goto(BASE + path); return p.evaluate(() => document.body.innerText); };
    let t = await text(admin, '/verwaltung');
    check('Admin: „Meine Klasse“ + „Klasse anna“ + „Klasse chef“', t.includes('Meine Klasse') && t.includes('Klasse anna') && t.includes('Klasse chef'));
    t = await text(admin, '/verwaltung?tab=schueler');
    check('Admin sieht alle 4', ['Lea Admin', 'Tim Admin', 'Mia Anna', 'Noa Beide'].every((n) => t.includes(n)));
    const anna = await session(browser, 'anna', 'annaanna1');
    t = await text(anna, '/verwaltung?tab=schueler');
    check('Anna sieht wie vorher Mia und Noa', t.includes('Mia Anna') && t.includes('Noa Beide') && !t.includes('Lea Admin'));
    t = await text(anna, '/stundenziele');
    check('Annas alte Stundenziele noch da', t.includes('Altes Ziel'));
    t = await text(admin, '/stundenziele');
    check('Admin-Stunde: Meine Klasse (Lea, Tim, Noa)', t.includes('Lea') && t.includes('Noa') && !t.includes('Mia'));
    const chef = await session(browser, 'chef', 'chefchef1');
    t = await text(chef, '/verwaltung?tab=schueler');
    check('„Sieht alle“ → alle Klassen', ['Lea Admin', 'Mia Anna', 'Noa Beide'].every((n) => t.includes(n)));
    t = await text(chef, '/verwaltung?tab=lehrer');
    check('Chef: nur eigenes Konto', t.includes('Mein Konto') && (await chef.evaluate(() => document.querySelectorAll('.matrix .row:not(.head)').length)) === 1);
    done();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
