const { chromium } = require('@playwright/test');
const BASE = 'https://doctoria-client.onrender.com';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  console.log('=== QA flow re-verification ===');

  // 1. Home CTA -> debería ir a /clinical/voice (redirigido a /login sin sesión)
  {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(1500);
      const urlBefore = page.url();
      // click Comenzar (hero)
      await page.click('text=Comenzar', { timeout: 15000 }).catch(async () => {
        console.log('hero Comenzar no encontrado; intentando FinalCTA');
        await page.click('text=Comenzar', { timeout: 15000 });
      });
      await page.waitForTimeout(4000);
      console.log('HOME -> after Comenzar click URL:', page.url());
      console.log('  (expected /login since /clinical/voice is authRequired)');
      const body = await page.evaluate(() => document.body.innerText.slice(0, 120));
      console.log('  body:', body.replace(/\n/g, ' | '));
    } catch (e) {
      console.log('HOME CTA ERROR:', e.message.split('\n')[0]);
    }
    await page.close();
  }

  // 2. Login flow desde la home
  {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(1500);
      // nav link "Iniciar sesión"
      await page.click('a[href="/login"]', { timeout: 15000 }).catch(async () => {
        await page.click('text=Iniciar sesión', { timeout: 15000 });
      });
      await page.waitForTimeout(3000);
      console.log('LOGIN FLOW -> URL:', page.url(), '| has login form:', (await page.locator('input[name=email]').count()) > 0);
    } catch (e) {
      console.log('LOGIN FLOW ERROR:', e.message.split('\n')[0]);
    }
    await page.close();
  }

  // 3. Sign in con cuenta seed
  {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(1500);
      await page.fill('input[name=email]', 'admin@doctoria.com');
      await page.fill('input[name=password]', 'Doctoria2026!');
      await page.click('button:has-text("Log in")').catch(async () => {
        await page.click('button:has-text("Iniciar sesión")');
      });
      await page.waitForTimeout(6000);
      console.log('SIGN IN -> URL:', page.url());
    } catch (e) {
      console.log('SIGN IN ERROR:', e.message.split('\n')[0]);
    }
    await page.close();
  }

  await browser.close();
})();