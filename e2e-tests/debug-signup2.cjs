const { chromium } = require('@playwright/test');
const BASE = 'https://doctoria-client.onrender.com';
const ts = Date.now();
const EMAIL = 'stagingtest' + ts + '@temporary.com';
const PASS = 'StrongPass123!';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type().toUpperCase() + ': ' + m.text().slice(0, 300)); });
  page.on('response', async r => {
    if (r.url().includes('/auth') || r.url().includes('/operations') || r.url().includes('/email')) {
      logs.push('RES ' + r.status() + ' ' + r.request().method() + ' ' + r.url());
    }
  });

  try {
    await page.goto(BASE + '/signup', { waitUntil: 'networkidle', timeout: 60000 });
    await page.fill('input[name=email]', EMAIL);
    await page.fill('input[name=password]', PASS);
    await page.click('button:has-text("Sign up")');
    await page.waitForTimeout(6000);

    const after = await page.evaluate(() => ({
      url: location.pathname + location.search,
      body: document.body.innerText.slice(0, 700),
    }));
    console.log('EMAIL:', EMAIL);
    console.log('AFTER SIGNUP URL:', after.url);
    console.log('AFTER SIGNUP BODY:', after.body);
    console.log('\nNETWORK LOGS:');
    console.log(logs.join('\n') || 'none');
  } catch (e) {
    console.log('ERROR: ' + e.message.split('\n')[0]);
    console.log('NETWORK LOGS:');
    console.log(logs.join('\n') || 'none');
  }
  await browser.close();
})();