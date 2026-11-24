const puppeteer = require('puppeteer');
const BASE = 'http://host.docker.internal:3001';

async function open() {
  return puppeteer.launch({ args: ['--no-sandbox'] });
}

/** Neue, getrennte Sitzung (eigene Cookies) und anmelden. */
async function session(browser, username, password) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.emulateTimezone('Europe/Zurich');
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(BASE + '/login');
  await page.type('input[name=username]', username);
  await page.type('input[name=password]', password);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  if (page.url().includes('/login')) throw new Error('Login fehlgeschlagen: ' + username);
  page.api = (url, method = 'GET', body) =>
    page.evaluate(
      async (url, method, body) => {
        const r = await fetch(url, {
          method,
          headers: body === undefined ? {} : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await r.text();
        let data = text;
        try { data = JSON.parse(text); } catch { /* kein JSON – Text bleibt */ }
        return { status: r.status, data };
      },
      url, method, body
    );
  // Uhrzeit wie im Browser (Europe/Zurich) – Node im Container läuft in UTC. clock(45) → { startTime, returnTime }
  page.clock = (minutes = 45) =>
    page.evaluate((minutes) => {
      const hh = (d) => d.toTimeString().slice(0, 8);
      const now = new Date();
      return { startTime: hh(now), returnTime: hh(new Date(now.getTime() + minutes * 60000)) };
    }, minutes);
  page.load = (path) =>
    page.evaluate(async (path) => {
      const r = await fetch(path + '/__data.json?x-sveltekit-invalidated=11');
      return r.json();
    }, path);
  return page;
}

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const done = () => { console.log(failures ? `${failures} FEHLER` : 'ALLE OK'); };

module.exports = { open, session, check, done, BASE };
