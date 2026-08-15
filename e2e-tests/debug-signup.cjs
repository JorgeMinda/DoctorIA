const { chromium } = require('@playwright/test');
const BASE = 'https://doctoria-client.onrender.com';
const EMAIL = 'stagingtest_' + Date.now() + '@temporary.com';
const PASS = 'StrongPass123!';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push('CONSOLE: ' + m.text().slice(0, 300)); });
  page.on('request', r => { if (r.method() !== 'GET') logs.push('REQ ' + r.method() + ' ' + r.url() + ' -> ' + r.response()?.status()); });
  page.on('response', r => { if (r.url().includes('/auth') || r.url().includes('/operations')) logs.push('RES ' + r.status() + ' ' + r.url()); });

  try {
    await page.goto(BASE + '/signup', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Debug: dump what's on the signup page
    const pageInfo = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')].map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder }));
      const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
      const body = document.body.innerText.slice(0, 500);
      return { inputs, buttons, body };
    });
    console.log('SIGNUP PAGE:', JSON.stringify(pageInfo, null, 1));
  } catch (e) {
    console.log('signup navigation error: ' + e.message.split('\n')[0]);
    const body = await page.evaluate(() => document.body.innerText.slice(0, 800)).catch(() => 'no content');
    console.log('BODY:', body);
  }

  await browser.close();
})();