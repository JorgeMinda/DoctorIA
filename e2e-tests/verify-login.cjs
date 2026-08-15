const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  ctx.setDefaultTimeout(90000);
  const base = 'https://doctoria-client.onrender.com';
  const server = 'https://doctoria-server.onrender.com';

  // 1. Login directo contra server
  const r1 = await ctx.request.post(server + '/auth/email/login', {
    data: { email: 'admin@doctoria.com', password: 'Doctoria2026!' },
    timeout: 120000,
  });
  console.log('login admin      ->', r1.status());
  if (r1.status() !== 200) {
    console.log('body:', (await r1.text()).slice(0, 300));
  }

  // 2. Si login OK, verificar /auth/me con la misma sesión (misma context -> cookies)
  const me = await ctx.request.get(server + '/auth/me', { timeout: 120000 });
  console.log('auth/me          ->', me.status());
  if (me.status() === 200) {
    const data = await me.json();
    console.log('user:', JSON.stringify({ email: data.email, isAdmin: data.isAdmin, isMedico: data.isMedico }).slice(0, 200));
  }

  // 3. medico1
  const r2 = await ctx.request.post(server + '/auth/email/login', {
    data: { email: 'medico1@doctoria.com', password: 'Doctoria2026!' },
    timeout: 120000,
  });
  console.log('login medico1    ->', r2.status());

  await browser.close();
})();