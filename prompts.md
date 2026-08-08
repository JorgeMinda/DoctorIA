# Bitácora de Prompts — DoctorIA

Este archivo registra los prompts relevantes utilizados durante el ciclo de desarrollo, el resultado obtenido y las decisiones tomadas por el equipo.

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
