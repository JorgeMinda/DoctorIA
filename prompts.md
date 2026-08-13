# Bitácora de Prompts — DoctorIA

Este archivo registra los prompts relevantes utilizados durante el ciclo de desarrollo, el resultado obtenido y las decisiones tomadas por el equipo.

## Cronograma del proyecto (8 semanas)

**Semana 1 — Investigación en Tiempo Real (Campo y Mercado)** · 13–19 julio 2026
Enfoque: Capturar información real mediante entrevistas y análisis de la competencia.
Entregables: Notebook en NotebookLM con mínimo 8 entrevistas (audio y transcripción), resumen de los 3-5 problemas principales y cuadro competitivo de al menos 3 rivales.
Dinámica: Entrevistas individuales; análisis consolidado de forma grupal.

**Semana 2 — Especificación** · 20–26 julio 2026
Enfoque: Traducir la investigación en documentos técnicos y diseño de interfaces.
Entregables: Repositorio inicializado, documentos `spec.md` y `plan.md` aprobados, y las 2-3 pantallas principales del MVP diseñadas en Google Stitch.
Dinámica: Revisión individual de borradores y construcción grupal del plan final.

**Semana 3 — Desarrollo del Core en Antigravity** · 27 julio–2 agosto 2026
Enfoque: Construcción técnica de las funcionalidades principales usando agentes de AI.
Entregables: MVP funcional en ambiente de staging y registro de tareas ejecutadas en `tasks.md`.
Dinámica: Cada Doer documenta sus tareas individualmente; el equipo realiza un code review cruzado.

**Semana 4 — QA y Despliegue a Producción** · 3–9 agosto 2026
Enfoque: Pruebas automáticas y lanzamiento oficial del producto.
Entregables: Producto accesible por HTTPS con certificado SSL, reporte de QA generado por el Browser Subagent y checklist de producción al 100%.
Dinámica: Pruebas de flujo individuales y firma de checklist en equipo.

**Semana 5 — Estrategia Comercial** · 10–16 agosto 2026
Enfoque: Definición de clientes piloto y preparación de materiales de venta.
Entregables: Plan de adquisición de clientes y agenda de al menos 5 contactos reales para la siguiente semana.
Dinámica: Búsqueda de contactos individual y preparación de demo grupal.

**Semana 6 — Ejecución Comercial (Modelo Regalo + Comunidad)** · 17–23 agosto 2026
Enfoque: Onboarding de los primeros usuarios reales entregando la versión 1 gratis.
Entregables: Usuarios reales activos, inicio de la base de datos de comunidad y cumplimiento de la meta individual obligatoria (2 clientes por Doer).
Dinámica: Responsabilidad individual por cada usuario conseguido.

**Semana 7 — Iteración Basada en Datos Reales** · 24–30 agosto 2026
Enfoque: Mejorar el producto basándose en el feedback de los usuarios activos.
Entregables: Mejoras técnicas desplegadas y actualización de métricas reales (no de vanidad) en el dashboard.
Dinámica: Seguimiento individual a usuarios y priorización de mejoras en equipo.

**Semana 8 — Demo Day (Cierre de Beta)** · 31 agosto–6 septiembre 2026
Enfoque: Presentación final de resultados, métricas de adopción y aprendizajes.
Entregables: Video del Demo Day, resumen ejecutivo de métricas y cierre de versión final en el repositorio.
Dinámica: Presentación breve del aporte individual y narrativa grupal del éxito del producto.

---

## Semana 1 — Investigación con NotebookLM

### Prompt 1 — Análisis integral de entrevistas

**Herramienta:** NotebookLM

**Objetivo:** Analizar los audios y transcripciones de los médicos entrevistados para identificar problemas, flujos, oportunidades, riesgos, perfiles y posibles funcionalidades.

**Prompt utilizado:**

> Actúa como un Investigador Senior de Producto, UX Researcher y Product Manager. Analiza todas las entrevistas cargadas en el Notebook como base de investigación de DoctorIA. No inventes datos ni conviertas hipótesis en hechos. Identifica problemas, pain points, flujo del médico, Jobs To Be Done, perfiles de usuario, requerimientos preliminares, riesgos, competencia, oportunidades, citas textuales y funcionalidades candidatas para el MVP.

**Resultado:** Permitió consolidar los principales problemas del personal médico, incluyendo carga administrativa, fragmentación de datos, generación manual de epicrisis, riesgos de dosificación, inestabilidad técnica y falta de interoperabilidad.

---

### Prompt 2 — Auditoría de la Semana 1

**Herramienta:** NotebookLM

**Objetivo:** Evaluar el nivel de cumplimiento de la investigación frente al Manual Técnico v2.

**Prompt utilizado:**

> Actúa como Auditor de Investigación del Manual Técnico v2. Evalúa las entrevistas, evidencias, trazabilidad, problemas, competidores, oportunidades, riesgos, citas y preparación para la siguiente fase. Marca cada criterio como cumple, parcial o no cumple. No inventes información y señala explícitamente todo dato faltante.

**Resultado:** Identificó el cumplimiento parcial del número de entrevistas y permitió cerrar la Semana 1 mediante una excepción documentada.

---

## Semana 2 — Especificación con Spec Kit

### Prompt 3 — Constitución del proyecto

**Herramienta:** Antigravity + Spec Kit

**Objetivo:** Establecer las reglas técnicas, de seguridad, calidad, gobierno y trabajo dirigido por AI para DoctorIA.

**Estado:** Ejecutado y aprobado con correcciones de auditoría.

**Resultado:** Se generó `.specify/memory/constitution.md` versión 1.0.0 con diez principios no negociables para DoctorIA. La constitución define el desarrollo dirigido por especificaciones, la mentalidad de Director de AI, la reutilización de Open SaaS y Wasp, la supervisión médica obligatoria, la protección de datos, el alcance del MVP, las pruebas, Google Stitch, la trazabilidad y el gobierno del equipo.

**Correcciones de auditoría:** Se precisó el tratamiento seguro de archivos `.env` y se registró que el equipo de 7 Doers es una excepción operativa documentada cuya aprobación formal por el mentor permanece pendiente.

---

### Prompt 4 — Especificación funcional del MVP

**Herramienta:** Antigravity + Spec Kit

**Objetivo:** Convertir la investigación validada de DoctorIA y la Constitución v1.0.0 en una especificación funcional del MVP, sin definir todavía arquitectura, código ni tareas.

**Alcance solicitado:** Autenticación del personal médico, consulta de pacientes e historial, nota clínica unificada, estructuración asistida por IA, revisión humana obligatoria, borrador de epicrisis, visualización de datos faltantes y auditoría básica.

**Restricciones:** No inventar requerimientos no respaldados, no incluir diagnóstico o prescripción autónoma, no integrar todavía sistemas externos y no generar código, plan técnico ni tasks.md.

**Estado:** Ejecutado y aprobado para iniciar aclaraciones.

**Resultado:** Spec Kit generó `specs/001-doctoria-mvp/spec.md` con 7 historias de usuario, 25 requisitos funcionales, 12 requisitos no funcionales, estados del contenido clínico, criterios de éxito, exclusiones, hipótesis y trazabilidad constitucional.

**Correcciones de auditoría:** Se eliminaron afirmaciones no demostradas, decisiones técnicas prematuras, posibles truncamientos silenciosos y rutas absolutas. La especificación permanece en estado Draft y está bloqueada para planificación hasta resolver tres grupos de aclaraciones mediante `/speckit-clarify`.

---

### Prompt 5 — Aclaraciones funcionales del MVP

**Herramienta:** Antigravity + Spec Kit

**Objetivo:** Resolver las decisiones pendientes sobre nota clínica, epicrisis, roles, rendimiento y calidad de la asistencia de IA antes de generar el plan técnico.

**Estado:** Ejecutado y auditado. Aclaraciones funcionales completadas; especificación técnicamente lista para planificación, pendiente de la revisión y aprobación formal correspondiente.

**Resultado:** Se resolvieron las 5 áreas de decisión de producto (nota clínica de 5 secciones, epicrisis de 10 elementos e inmutabilidad por adendas, roles Médico y Administrador con restricciones, metas de rendimiento en staging y criterios de evaluación de IA sobre 30 notas sintéticas). Se eliminaron todos los marcadores `[NEEDS CLARIFICATION]` y se incorporaron los requisitos RF-026 a RF-029. Se agregó RNF-013 de disponibilidad verificable en staging sin definir SLA porcentual de producción.

---

### Prompt 6 — Plan técnico del MVP DoctorIA

**Herramienta:** Antigravity + Spec Kit

**Modelo utilizado:** Claude Opus 4.6 (Thinking)

**Objetivo:** Transformar la especificación funcional y las aclaraciones aprobadas del MVP en un plan técnico implementable, reutilizando estrictamente Open SaaS/Wasp y sin iniciar todavía la implementación.

**Estado:** Ejecutado, auditado, técnicamente aprobado y formalmente aprobado para iniciar `DESIGN.md`.

**Aprobación formal:** 2026-08-08. El gate humano del plan fue aprobado después de la auditoría técnica y del cierre satisfactorio de SARA.

**Resultado:** Se generaron y revisaron cinco artefactos de planificación: `plan.md`, `research.md`, `data-model.md`, `contracts/clinical-operations.md` y `quickstart.md`. El plan conserva Open SaaS/Wasp/Prisma/PostgreSQL como base, define 17 operaciones Wasp y un contrato interno desacoplado para la asistencia de IA, mantiene el proveedor de IA como decisión pendiente y preserva Google Stitch como gate previo a la implementación de UI.

**Correcciones de auditoría — SARA:** Durante la revisión posterior se detectaron inconsistencias capaces de propagarse a la arquitectura: una interpretación falsa de H-03, la equivalencia insegura `!isAdmin = Médico`, ausencia de autorización explícita Médico↔Paciente y otros residuos técnicos/documentales. Se aplicó el método SARA para delimitar el alcance, rastrear propagación, corregir los cinco artefactos y reauditar el resultado. Se incorporaron `isMedico` con habilitación explícita y `MedicoPatientAccess` con control server-side, se restauraron las hipótesis H-01 a H-07 según `spec.md`, se corrigieron conteos y supuestos técnicos y se ajustó la estrategia de PostgreSQL para no interferir con la instancia existente en el puerto 5432. La verificación final no encontró residuos SARA conocidos, placeholders, `tasks.md` prematuro, trailing whitespace ni modificaciones fuera de `specs/001-doctoria-mvp/`.

**Incidencia de ejecución:** La generación y corrección tuvieron interrupciones por límite de cuota del modelo. Antes de cada reanudación se inspeccionó el repositorio mediante Terminal para recuperar exactamente el punto alcanzado y evitar regenerar o sobrescribir trabajo válido.

---

### Prompt 7 — Sistema de diseño clínico de DoctorIA

**Herramienta:** Antigravity

**Modelo recomendado:** Claude Sonnet 4.6 (Thinking)

**Objetivo:** Crear `DESIGN.md` como contrato de diseño UX/UI del MVP DoctorIA antes de utilizar Google Stitch, basándose exclusivamente en la especificación, el plan técnico aprobado y los componentes visuales reales disponibles en Open SaaS.

**Fuentes de verdad:** Constitución v1.0.0, `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/clinical-operations.md`, `quickstart.md` y el stack/componentes UI existentes de Open SaaS.

**Alcance:** Definir principios visuales, estructura de navegación clínica, jerarquía, componentes reutilizables, estados de interfaz, accesibilidad, responsive, comportamiento visual de la asistencia de IA y lineamientos para las pantallas candidatas de Google Stitch: Lista/Búsqueda de Pacientes, Editor de Nota Clínica e Historial del Paciente + Epicrisis.

**Restricciones:** No generar código ni modificar `app/`; no instalar componentes o librerías; no crear `tasks.md`; no ejecutar implementación; no inventar funcionalidades clínicas; no permitir diagnóstico, prescripción o confirmación autónoma por IA; no utilizar datos reales de pacientes; no reemplazar decisiones aprobadas del plan.

**Estado:** Ejecutado, auditado mediante revisión técnica y SARA, corregido y formalmente aprobado para continuar con Google Stitch.

**Aprobación formal:** 2026-08-08. `DESIGN.md` fue revisado contra `spec.md`, `plan.md`, contratos y componentes reales de Open SaaS. SARA detectó y corrigió inconsistencias en rutas, reutilización de layout/breadcrumb y comportamiento del Toast antes del gate humano.
