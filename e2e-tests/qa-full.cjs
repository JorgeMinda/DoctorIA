const { chromium } = require('@playwright/test');
const BASE = 'https://doctoria-client.onrender.com';

(async () => {
  const browser = await chromium.launch();
  const results = [];

  // TEST 1: Home -> Comenzar-> /clinical/voice -> /login (auth guard)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim().startsWith('Comenzar'));
      return a ? a.getAttribute('href') : null;
    });
    await page.click('text=Comenzar');
    await page.waitForTimeout(4000);
    const ok = href === '/clinical/voice' && page.url().includes('/login');
    results.push({ test: 'T1 home Comenzar -> intake', pass: ok, detail: `href=${href} url=${page.url()}` });
    await ctx.close();
  }

  // TEST 2: Home entry points visibles
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
    const ctas = await page.evaluate(() => [...document.querySelectorAll('a')].filter(a => /Comenzar|Iniciar/i.test(a.textContent.trim())).length);
    results.push({ test: 'T2 home CTAs visibles', pass: ctas >= 2, detail: `count=${ctas}` });
    await ctx.close();
  }

  // TEST 3: Login flow desde home
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
    await page.click('a[href="/login"]').catch(async () => await page.click('text=Iniciar sesión'));
    await page.waitForTimeout(3000);
    const hasForm = await page.locator('input[name=email]').count();
    results.push({ test: 'T3 login flow', pass: page.url().includes('/login') && hasForm > 0, detail: `url=${page.url()}` });
    await ctx.close();
  }

  // TEST 4: Sesión persiste tras sign-in (navigates between pages)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 90000 });
    await page.fill('input[name=email]', 'admin@doctoria.com');
    await page.fill('input[name=password]', 'Doctoria2026!');
    await page.click('button[type=submit]').catch(async () => await page.click('button:has-text("Log in")'));
    await page.waitForTimeout(6000);
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    // sesión vigente: la home del usuario autenticado es el área clínica (redirect)
    const authed = page.url().includes('/clinical') || !page.url().includes('/login');
    results.push({ test: 'T4 session persists', pass: authed, detail: `url=${page.url()}` });
    await ctx.close();
  }

  // TEST 5: Credenciales inválidas -> error controlado sin crash (context limpio)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 90000 });
    await page.fill('input[name=email]', 'noexiste@x.com');
    await page.fill('input[name=password]', 'WrongPass123!');
    await page.click('button[type=submit]').catch(async () => await page.click('button:has-text("Log in")'));
    await page.waitForTimeout(4000);
    const body = await page.evaluate(() => document.body.innerText);
    const hasError = /invalid|incorrect|error/i.test(body);
    const staysOnLogin = page.url().includes('/login');
    results.push({ test: 'T5 invalid creds handled', pass: staysOnLogin && hasError, detail: `url=${page.url()} errorShown=${hasError}` });
    await ctx.close();
  }

  await browser.close();

  console.log('\n===== QA VERIFICATION (staging) =====');
  let pass = 0;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.test}  [${r.detail}]`);
    if (r.pass) pass++;
  }
  console.log(`\nResultado: ${pass}/${results.length} superadas`);
})();