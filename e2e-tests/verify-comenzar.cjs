const { chromium } = require('@playwright/test');

const BASE = 'https://doctoria.linkear.net';
const PASS = 'Doctoria2026!';
const results = [];

async function newPage(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR ' + String(e.message).slice(0, 300)));
  return { ctx, page };
}

async function login(page, email) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4500);
}

async function clickComenzar(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.getByRole('link', { name: /Comenzar/i }).first().click();
  await page.waitForTimeout(4500);
  return page.evaluate(() => location.pathname);
}

(async () => {
  const browser = await chromium.launch();

  // 1) sin sesión → /login
  {
    const { ctx, page } = await newPage(browser);
    const url = await clickComenzar(page);
    const ok = url === '/login';
    results.push(`${ok ? 'PASS' : 'FAIL'} sin-sesion: ${url} (esperado /login)`);
    await ctx.close();
  }

  // 2) admin → /clinical/patients (sin rebote por voice)
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'admin@doctoria.com');
    const url = await clickComenzar(page);
    const ok = url === '/clinical/patients';
    results.push(`${ok ? 'PASS' : 'FAIL'} admin: ${url} (esperado /clinical/patients)`);
    await ctx.close();
  }

  // 3) medico → /clinical/voice renderiza
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'medico1@doctoria.com');
    const url = await clickComenzar(page);
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 150));
    const ok = url === '/clinical/voice' && /Asistente de voz/i.test(body);
    results.push(`${ok ? 'PASS' : 'FAIL'} medico: ${url} | ${body.slice(0, 80)}`);
    await ctx.close();
  }

  await browser.close();
  console.log('\n=== RESULTADOS ===');
  results.forEach((r) => console.log(r));
  process.exit(results.every((r) => r.startsWith('PASS')) ? 0 : 1);
})();
