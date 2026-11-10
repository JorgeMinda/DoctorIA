// Identidad "Ambient Voice Interface" para las pantallas de auth.
// SOLO presentación: tematiza los formularios de Wasp Auth vía sus CSS
// variables de apariencia (no toca lógica, validación ni hooks).

export const AUTH_APPEARANCE = {
  colors: {
    waspYellow: "#e04879",
    gray700: "#9aa5b1",
    gray600: "#2b3442",
    gray500: "#8b96a5",
    gray400: "#1b2330",
    red: "#3d1f2b",
    darkRed: "#f87171",
    green: "#123026",
    brand: "#8e183e",
    brandAccent: "#e04879",
    errorBackground: "#3d1f2b",
    errorText: "#fca5a5",
    successBackground: "#123026",
    successText: "#86efac",
    submitButtonText: "#ffffff",
    formErrorText: "#f87171",
  },
  fontSizes: {
    sm: "0.875rem",
  },
};

// Sobreescrituras de presentación de los formularios de Wasp (scoped al
// layout de auth, marcado con data-login-ambient).
// Fondo/tinta adaptativos al tema: en modo claro el input usa superficie clara
// (tinta oscura) y en modo oscuro superficie oscura (tinta clara). Soluciona el
// texto ilegible al alternar entre claro y oscuro.
export const AUTH_AMBIENT_STYLE = `
  [data-login-ambient] input {
    color: var(--color-foreground) !important;
    background-color: var(--color-surface-container) !important;
    border-color: var(--color-outline) !important;
  }
  [data-login-ambient] input::placeholder {
    color: color-mix(in srgb, var(--color-foreground) 55%, transparent) !important;
    opacity: 1 !important;
  }
  [data-login-ambient] input:focus {
    border-color: #8e183e !important;
    box-shadow: 0 0 0 1px #8e183e, 0 0 18px rgba(142, 24, 62, 0.25) !important;
    outline: none !important;
  }
  [data-login-ambient] button[type="submit"] {
    box-shadow: 0 0 24px rgba(142, 24, 62, 0.3) !important;
  }
  [data-login-ambient] button[type="submit"]:hover {
    box-shadow: 0 0 32px rgba(224, 72, 121, 0.4) !important;
  }
`;
