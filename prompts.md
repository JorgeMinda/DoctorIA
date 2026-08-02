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

**Estado:** Pendiente de ejecución.
