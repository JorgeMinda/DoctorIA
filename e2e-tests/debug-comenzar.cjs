const { chromium } = require('@playwright/test');

const BASE = 'https://doctoria.linkear.net';
const EMAIL = process.argv[2] || 'medico1@doctoria.com';
const PASS = 'Doctoria2026!';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const log = [];
  const push = (s) => { log.push(s); console.log(s); };

  page.on('console', (m) => { if (m.type() === 'error') push(`CONSOLE[error] ${m.text().slice(0, 400)}`); });
  page.on('pageerror', (e) => push(`PAGEERROR ${String(e.message).slice(0, 600)}`));
  page.on('requestfailed', (r) => push(`REQFAIL ${r.method()} ${r.url().slice(0, 160)} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/auth/')) push(`HTTP${r.status()} ${u.slice(0, 120)}`);
    else if (r.status() >= 400 && !u.includes('/assets/')) push(`HTTP${r.status()} ${u.slice(0, 160)}`);
  });

  const dumpPage = async (tag) => {
    const info = await page.evaluate(() => ({
      url: location.href,
      body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
      ls: Object.keys(localStorage),
    }));
    push(`PAGE[${tag}] ${JSON.stringify(info)}`);
  };
  const doLogin = async (tag) => {
    if (!page.url().includes('/login')) await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    await dumpPage(tag);
  };

  try {
    push('=== LOGIN 1 (medico) ===');
    await doLogin('login-1');

    push('=== VOICE en sesion 1 (full load) ===');
    await page.goto(BASE + '/clinical/voice', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    await dumpPage('voice-sesion-1');

    push('=== LOGOUT ===');
    const trig = page.locator('button:has(svg.lucide-chevron-down)').first();
    push('trigger count: ' + (await page.locator('button:has(svg.lucide-chevron-down)').count()));
    await trig.click();
    await page.waitForTimeout(800);
    const lo = page.getByText('Log Out', { exact: false });
    if (await lo.count()) { await lo.first().click(); push('Log Out clicked'); }
    else {
      push('LOG OUT NOT FOUND, dumping menu');
      const items = await page.evaluate(() => [...document.querySelectorAll('[role=menuitem],button')].map((b) => b.textContent.trim().slice(0, 30)));
      push('ITEMS: ' + JSON.stringify(items));
    }
    await page.waitForTimeout(3000);
    await dumpPage('logout');

    push('=== LOGIN 2 ===');
    await doLogin('login-2');

    push('=== COMENZAR desde landing ===');
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByRole('link', { name: /Comenzar/i }).first().click();
    await page.waitForTimeout(5000);
    await dumpPage('comenzar-sesion-2');

    push('=== VOCE directo sesion 2 (full load) ===');
    await page.goto(BASE + '/clinical/voice', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);
    await dumpPage('voice-sesion-2');
  } catch (e) {
    push('FATAL ' + String(e).slice(0, 800));
    await dumpPage('fatal').catch(() => {});
  }

  await browser.close();
  require('fs').writeFileSync(__dirname + '/debug-comenzar.log', log.join('\n'));
})();
