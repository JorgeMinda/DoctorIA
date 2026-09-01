import { type App } from "@wasp.sh/spec";

export const head: App["head"] = [
  "<link rel='icon' href='/logo.jpeg' />",

  "<link rel='preconnect' href='https://fonts.googleapis.com' />",
  "<link rel='preconnect' href='https://fonts.gstatic.com' />",
  "<link href='https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap' rel='stylesheet' />",

  "<meta name='description' content='DoctorIA - capa de inteligencia artificial asistiva sobre el historial clínico.' />",
  "<meta name='author' content='DoctorIA' />",
  "<meta name='keywords' content='salud, clinica, inteligencia artificial, notas medicas' />",
  "<meta name='google' content='notranslate' />",

  "<meta property='og:type' content='website' />",
  "<meta property='og:title' content='DoctorIA' />",
  "<meta property='og:site_name' content='DoctorIA' />",
  "<meta property='og:url' content='https://your-saas-app.com' />",
  "<meta property='og:description' content='DoctorIA - capa de inteligencia artificial asistiva sobre el historial clínico.' />",
  "<meta property='og:image' content='https://your-saas-app.com/public-banner.webp' />",
  "<meta name='twitter:image' content='https://your-saas-app.com/public-banner.webp' />",
  "<meta name='twitter:image:width' content='800' />",
  "<meta name='twitter:image:height' content='400' />",
  "<meta name='twitter:card' content='summary_large_image' />",
];
