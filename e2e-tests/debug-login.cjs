const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const base = 'https://doctoria-client.onrender.com';

  async function tryLogin(email, pass) {
    const resp = await ctx.request.post('https://doctoria-server.onrender.com/auth/email/login', {
      data: { email, password: pass },
    });
    console.log(email, '->', resp.status());
    return resp.status();
  }

  await tryLogin('admin@doctoria.com', 'Doctoria2026!');
  await tryLogin('medico1@doctoria.com', 'Doctoria2026!');
  await tryLogin('medico2@doctoria.com', 'Doctoria2026!');

  // y tambien probar un signup fresh
  const ts = Date.now();
  const resp2 = await ctx.request.post('https://doctoria-server.onrender.com/auth/email/signup', {
    data: { email: 'probe' + ts + '@temporary.com', password: 'StrongPass123!' },
  });
  console.log('fresh signup ->', resp2.status());

  await browser.close();
})();