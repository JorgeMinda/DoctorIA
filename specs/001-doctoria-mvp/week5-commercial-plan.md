# Semana 5 — Estrategia Comercial: Plan de Adquisición y Agenda de Contactos

**Fechas**: 10–16 de agosto de 2026 · **Fase del curso**: Semana 5 (Estrategia Comercial)
**Estado**: ⏳ En ejecución · **Entregables**: plan de adquisición de clientes + agenda de ≥5 contactos reales para la Semana 6 (Ejecución Comercial).
**Dinámica**: búsqueda de contactos individual y preparación de demo grupal.

---

## 1. Contexto y supuestos

- **Producto**: DoctorIA — SaaS de asistencia de IA para historias clínicas (100% datos sintéticos en demo; la IA es exclusivamente asistiva, nunca diagnostica ni prescribe — Constitución P4).
- **Modelo de adquisición (Semana 6)**: **Modelo Regalo + Comunidad** — se entrega la Versión 1 gratis a los primeros usuarios reales para sembrar la base de comunidad.
- **Meta individual obligatoria (Semana 6)**: 2 clientes por Doer.
- **Restricción técnica actual**: el onboarding por email requiere dominio verificado en Resend (hoy usa remitente provisional `onboarding@resend.dev`); para pilotos reales conviene verificar dominio o usar invitaciones por enlace.
- **Restricción de datos**: en la demo todo es sintético (P5); los contactos y pilotos son personas/centros reales, pero sus datos clínicos de prueba deben ser sintéticos.

---

## 2. Plan de adquisición de clientes

### 2.1 Propuesta de valor (one-liner)
> "DoctorIA estructura tu nota clínica hablada o escrita en segundos, en español, sin que la IA reemplace tu criterio médico."

### 2.2 Canales de adquisición (priorizados)
1. **Contacto directo de los Doers** (médicos del círculo cercano / conocidos) → canal de mayor confianza y conversión.
2. **Comunidad y demos grupales** (Webinar/demo en vivo de 20 min) → mostrar flujo voz→nota→epicrisis con cuentas seed.
3. **Grupos profesionales** (WhatsApp/Telegram de médicos, sociedades locales) → contenido educativo, no spam.
4. **Universidades / rotaciones** (contacto con docentes de pregrado/posgrado) → pilotos académicos.
5. **Centros pequeños y consultorios independientes** → menor fricción de compra que hospitales grandes.

### 2.3 Embudo (funnel) simplificado
`Contacto → Demo de 15 min (cuenta seed) → Regalo Versión 1 (acceso gratis) → Feedback Semana 7 → Retención/comunidad`.

### 2.4 Materiales a preparar (demo grupal)
- Script de demo (landing → login seed → `/clinical/voice` → nota estructurada → epicrisis).
- Cuenta seed lista: `medico1@doctoria.com` / `Doctoria2026!`.
- Un **paciente sintético** de ejemplo para la demo (PAC-001).
- FAQ de objeciones (privacidad, supervise médico, datos sintéticos).

---

## 3. Agenda de contactos reales (Semana 6)

> **Instrucción**: completar los 5 espacios con contactos REALES (nombre, centro, canal). La plantilla está lista; los Doers deben llenar los datos reales antes de la Semana 6.

| # | Nombre del contacto | Rol / Especialidad | Institución / Centro | Canal de contacto | Estado | Responsable (Doer) | Notas |
|:--|:--|:--|:--|:--|:--|:--|:--|
| 1 | _[nombre real]_ | Médico general / especialista | _[centro]_ | WhatsApp / email / presencial | Por contactar | Doer A | Interés inicial: ahorro de tiempo en notas |
| 2 | _[nombre real]_ | Médico general / especialista | _[centro]_ | _[canal]_ | Por contactar | Doer B | _[nota]_ |
| 3 | _[nombre real]_ | Docente universitario | _[facultad]_ | _[canal]_ | Por contactar | Doer C | Posible piloto académico |
| 4 | _[nombre real]_ | Dueño / admin de consultorio | _[consultorio]_ | _[canal]_ | Por contactar | Doer D | Decision maker de adopción |
| 5 | _[nombre real]_ | Médico de comunidad/grupo prof. | _[grupo]_ | _[canal]_ | Por contactar | Doer E | Puede amplificar a su red |

**Meta semana 6**: al menos 2 de estos 5 contactos se convierten en usuarios reales activos (regla del curso: 2 clientes/Doer).

---

## 4. Próximos pasos inmediatos (esta semana)
1. Cada Doer llena sus contactos reales en la tabla §3.
2. Preparar demo grupal (materiales §2.4).
3. Definir métrica de adopción real (no de vanidad) para el dashboard de Semana 7: usuarios activos, notas estructuradas, feedback cualitativo.
4. Coordinar verificación de dominio en Resend para habilitar onboarding por email en pilotos.

---

## 5. Riesgos
- **Onboarding por email limitado** (Resend provisional) → mitigar con invitaciones por enlace/manual.
- **IA en free tier** (OpenRouter `gpt-oss-20b:free`) con rate-limits → para pilotos reales usar clave paga/BYOK.
- **DB free expira a 30 días** → plan pagado antes de pilotos largos.
