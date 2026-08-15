const BASE = 'https://doctoria-client.onrender.com';
(async () => {
  const html = await (await fetch(BASE + '/')).text();
  const css = html.match(/href="([^"]*\.css)"/)?.[1] || 'none';
  const js = html.match(/src="([^"]*\.js)"/)?.[1] || 'none';
  const hasVoice = html.includes('/clinical/voice');
  const ctas = html.match(/href="([^"]*)"[^>]*>\s*Comenzar/g) || [];
  console.log(JSON.stringify({ time: new Date().toISOString(), css, js, hasVoice, ctas }));
})();