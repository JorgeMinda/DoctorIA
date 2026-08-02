<!--
CONSTITUTION SYNC IMPACT REPORT
Version: 1.0.0 (Audit Corrections)
Modified Principles:
- Principio 9: Especificado tratamiento seguro de archivos .env (prohibición de archivos reales con secretos; obligación de versionar plantillas .env.example / .env.*.example sin credenciales).
- Principio 10: Ajustado el estado real de la excepción del equipo de 7 Doers como excepción operativa documentada pendiente de aprobación formal por parte del mentor.
Added Sections:
- N/A
Removed Sections:
- N/A
Templates Status:
- .specify/templates/plan-template.md: ✅ Compatible (Incluye verificación de Constitución)
- .specify/templates/spec-template.md: ✅ Compatible (Alineado con requisitos y alcance del MVP)
- .specify/templates/tasks-template.md: ✅ Compatible (Soporta desglose por historias y pruebas)
Follow-up TODOs:
- Registrar la aprobación formal del mentor para la excepción de 7 Doers cuando el validador sea identificado.
-->

# Constitución del Proyecto DoctorIA

## Contexto y Propósito del Proyecto

DoctorIA es una aplicación asistencial orientada a personal médico que actúa como una capa de inteligencia artificial sobre el historial clínico del paciente. Su objetivo principal es reducir la carga administrativa del equipo de salud, agilizar la consulta de información clínica relevante y generar borradores estructurados de notas y resúmenes. 

**REGLA FUNDAMENTAL DE DOMINIO**: Toda salida, borrador, estructuración o resumen generado por la inteligencia artificial DEBE ser revisado, editado y confirmado expresamente por un profesional médico calificado antes de consolidarse en la historia clínica.

---

## Principios No Negociables

### 1. Desarrollo Dirigido por Especificaciones (Spec-Driven Development)

- Ninguna funcionalidad DEBE ser implementada sin que exista previamente una especificación aprobada (`spec.md`), un plan técnico validado (`plan.md`) y las correspondientes tareas individuales registradas en `tasks.md`.
- El flujo de trabajo obligatorio e inderogable DEBE seguir estrictamente el siguiente orden:
  `investigación → constitución → especificación → aclaración (si aplica) → plan → diseño en Google Stitch → tareas → implementación → QA`
- Toda funcionalidad o comportamiento propuesto que no esté respaldado directamente por entrevistas estructuradas o evidencia verificable DEBE marcarse explícitamente como **Hipótesis** y NO DEBE tratarse como un requisito confirmado.

### 2. Mentalidad de Director de AI (AI Director Mindset)

- El equipo NO DEBE escribir todo el código manualmente ni DEBE delegar la construcción de sistemas completos en un único prompt monolítico.
- Cada tarea ejecutada DEBE cumplir con las siguientes condiciones obligatorias:
  - Tener un alcance estrictamente acotado y atómico.
  - Ser delegada individualmente en la herramienta Antigravity.
  - Producir un Artefacto (Artifact) explícito y revisable.
  - Ser revisada por un miembro del equipo distinto de quien la delegó.
  - Ser aprobada formalmente antes de iniciar cualquier tarea dependiente.
- La velocidad de generación del agente de IA NUNCA reemplazará la revisión y validación humana rigurosa.

### 3. Conservación y Reutilización del Stack Existente

- DoctorIA DEBE conservar, respetar y aprovechar al máximo el stack tecnológico base provisto por Open SaaS y Wasp.
- Se DEBE reutilizar obligatoriamente el sistema de autenticación, el panel de administración, la estructura del proyecto (`app/`, `blog/`, `e2e-tests/`) y las capacidades preexistentes antes de construir o agregar soluciones nuevas.
- NO SE PERMITIRÁ reemplazar el stack, el framework web, el ORM, el motor de base de datos ni el sistema de autenticación sin una justificación técnica documentada y la aprobación expresa del líder técnico.
- Se prohíbe estrictamente la sobreingeniería y la introducción de dependencias innecesarias.

### 4. Seguridad Clínica y Supervisión Humana Inderogable

- La inteligencia artificial de DoctorIA es **exclusivamente asistiva y complementaria**.
- **La IA PUEDE**:
  - Organizar y estructurar información no estructurada.
  - Clasificar texto clínico.
  - Generar borradores preliminares de notas médicas.
  - Resumir antecedentes e historial clínico.
  - Señalar de forma visual la presencia de información faltante.
- **La IA NO PUEDE**:
  - Diagnosticar de forma autónoma.
  - Prescribir medicamentos o tratamientos.
  - Decidir conductas o planes terapéuticos.
  - Modificar o alterar una historia clínica definitiva sin aprobación humana.
  - Emitir recomendaciones clínicas o diagnósticas presentadas como decisiones médicas confirmadas.
- Toda salida generada por la IA DEBE cumplir obligatoriamente con lo siguiente:
  - Identificarse de manera clara y visible como "Contenido asistido por IA".
  - Permanecer por defecto en estado de "Borrador".
  - Permitir la edición libre por parte del profesional médico.
  - Requerir la confirmación expresa del usuario médico para consolidarse.
  - Registrar en el registro de auditoría quién realizó la revisión y en qué fecha/hora fue confirmada.
- Las alertas automáticas de dosis, interacciones medicamentosas o motores de decisión clínica de alto riesgo quedan **completamente fuera del MVP funcional** hasta contar con fuentes médicas validadas, reglas homologadas y supervisión profesional experta.

### 5. Protección de Datos y Privacidad Clínica

- Durante las fases de desarrollo, pruebas automatizadas y demostraciones SE UTILIZARÁN ÚNICAMENTE datos sintéticos y anónimos.
- Queda ESTRICTAMENTE PROHIBIDO almacenar o guardar en el repositorio de código:
  - Historias clínicas o registros de pacientes reales.
  - Información de Identificación Personal (PII) de pacientes o personal.
  - Contraseñas, llaves privadas, tokens de API o credenciales de acceso.
  - Secretos de servicios externos o de infraestructura.
- Todos los secretos y configuraciones sensibles DEBEN administrarse exclusivamente mediante variables de entorno local y de despliegue (`.env` no versionados).
- Los registros de sistema (logs) NO DEBEN registrar datos clínicos ni información identificable en ningún nivel.
- La aplicación DEBE aplicar los principios de mínimo privilegio, control de acceso basado en roles, trazabilidad de operaciones y separación estricta entre cuentas de usuario.
- El despliegue a ambientes de producción DEBE exigir el uso de cifrado HTTPS en todas las comunicaciones.

### 6. Alcance Controlado del MVP (Minimum Viable Product)

- El MVP de DoctorIA DEBE concentrarse única y exclusivamente en el siguiente flujo clínico demostrable:
  1. Autenticación y control de acceso del personal médico.
  2. Listado básico y búsqueda de pacientes.
  3. Consulta del historial clínico del paciente.
  4. Ingreso de una nota clínica mediante texto unificado.
  5. Estructuración de la nota asistida por IA.
  6. Revisión, edición y confirmación explícita por parte del profesional médico.
  7. Generación de un borrador de resumen clínico o epicrisis.
  8. Identificación visual clara de información clínica faltante.
  9. Registro básico de auditoría de las acciones clínicas ejecutadas.
- Quedan EXPRESAMENTE EXCLUIDOS del MVP inicial:
  - Integración real o en directo con sistemas gubernamentales o institucionales (MSP, IESS, SOGA, PRAS, SAM, Orion).
  - Interoperabilidad de fichas entre distintas instituciones de salud.
  - Módulos automáticos de farmacia e inventario.
  - Módulos de diagnóstico o prescripción autónoma.
  - Generación de recomendaciones terapéuticas automáticas.
  - Alertas clínicas de alto riesgo sin base validada.
  - Soporte para funcionamiento 100% offline.
  - Analítica clínica avanzada o tableros epidemiológicos.

### 7. Calidad, Cobertura y Pruebas Rigurosas

- Toda tarea o funcionalidad implementada DEBE contar con criterios de aceptación claramente definidos y verificables de manera independiente.
- Los flujos críticos del sistema DEBEN contar con la cobertura de pruebas correspondiente:
  - Pruebas de validación de entradas y esquemas.
  - Pruebas unitarias para lógica aislada de negocio o transformación.
  - Pruebas de integración para capas de persistencia y operaciones API.
  - Pruebas E2E (End-to-End) para los flujos principales de usuario.
  - Prueba de verificación final ejecutada mediante Browser Subagent.
- NO SE ACEPTARÁ la finalización de una tarea únicamente porque el código compile o pase la verificación de sintaxis. DEBE comprobarse empíricamente el comportamiento esperado, la gestión de errores, los estados vacíos de interfaz y el cumplimiento de permisos de acceso.

### 8. Usabilidad, Accesibilidad y Diseño Previo en Google Stitch

- La interfaz de usuario DEBE diseñarse para minimizar la cantidad de clics, eliminar campos de texto repetitivos y reducir al máximo la carga cognitiva del profesional de salud.
- DEBE cumplir como mínimo con el nivel **WCAG AA** en términos de contraste de color, legibilidad tipográfica y usabilidad.
- Los errores de entrada, advertencias y campos pendientes DEBEN mostrarse de forma clara y destacada mediante texto explicativo e iconografía, sin depender únicamente del color.
- El diseño definitivo de las pantallas principales del flujo DEBE realizarse y aprobarse en **Google Stitch** antes de iniciar su implementación en código.

### 9. Trazabilidad Integral y Versionamiento Limpio

- El repositorio del proyecto DEBE mantener actualizados y sincronizados los siguientes artefactos de diseño y control: `spec.md`, `plan.md`, `tasks.md`, `DESIGN.md`, `prompts.md`, reportes de QA y evidencias de los Artefactos creados en Antigravity.
- Cada cambio en el código fuente DEBE estar directamente asociado a una tarea registrada en `tasks.md`.
- Los commits en el control de versiones DEBEN ser pequeños, descriptivos, atómicos y no mezclar funcionalidades sin relación directa.
- NO SE PERMITIRÁ versionar archivos de variables de entorno reales, incluyendo `.env`, `.env.local`, `.env.server` o cualquier archivo que contenga secretos. Sí DEBEN versionarse únicamente las plantillas seguras `.env.example` y `.env.*.example`, siempre que no contengan credenciales reales.
- NO SE PERMITIRÁ versionar credenciales de ningún tipo, el directorio `node_modules/` ni ningún artefacto de compilación o archivo generado localmente.

### 10. Gobierno del Proyecto y Toma de Decisiones

- Las decisiones relativas a especificaciones, arquitectura técnica, diseño de interfaz y control de calidad son de carácter grupal.
- DoctorIA funciona con un equipo de 7 Doers como excepción operativa documentada respecto al estándar general del manual. La aprobación formal del mentor deberá registrarse cuando el validador sea identificado.
- Ninguna fase ni hito del proyecto podrá declararse cerrado sin cumplir acumulativamente con:
  - Entregables funcionales y documentación completos.
  - Revisión formal por el equipo de desarrollo.
  - Evidencia empírica de pruebas almacenada y verificada.
  - Aprobación expresa del validador o líder técnico asignado.
- En cualquier situación donde exista conflicto entre una de las reglas de esta Constitución y la velocidad de entrega, la comodidad del desarrollador o una propuesta generada por el agente de IA, **PREVALECE SIEMPRE ESTA CONSTITUCIÓN**.

---

## Gobernanza y Administración de la Constitución

### Procedimiento de Enmiendas
1. **Propuesta**: Cualquier miembro del equipo de 7 Doers puede proponer una enmienda o adición justificando la necesidad técnica o clínica.
2. **Revisión y Discusión**: La propuesta DEBE ser revisada formalmente por el equipo, evaluando su impacto en la seguridad clínica, la arquitectura y el alcance del MVP.
3. **Aprobación**: Se requiere la aprobación por consenso o mayoría calificada del equipo junto con la conformidad del líder técnico.
4. **Actualización**: Aprobada la enmienda, se actualizará el archivo `constitution.md`, se registrará el cambio en el reporte de impacto inicial (Sync Impact Report) y se incrementará la versión de la constitución.

### Control de Versiones de la Constitución
El versionamiento de esta Constitución se rige por reglas semánticas de gobierno:
- **Versión MAJOR (X.0.0)**: Remoción, redefinición o cambios incompatibles hacia atrás en los principios no negociables o reglas del gobierno del proyecto.
- **Versión MINOR (0.Y.0)**: Incorporación de un nuevo principio o expansión material del alcance de las directrices sin degradar la seguridad ni los principios existentes.
- **Versión PATCH (0.0.Z)**: Correcciones de redacción, erratas, aclaraciones tipográficas o ajustes que no alteren la semántica de las reglas.

### Criterios para Verificar el Cumplimiento
- **Revisión de Especificaciones y Planes**: Cada `spec.md` y `plan.md` DEBE incluir una sección explícita de "Constitution Check" donde se verifique el acatamiento de cada principio aplicable.
- **Auditoría de Pull Requests y Artifacts**: Todo Artefacto o Pull Request DEBE ser rechazado si viola cualquiera de los 10 principios no negociables.
- **Justificación de Excepciones**: En caso de requerir una desviación temporal o técnica, esta DEBE ser documentada en la tabla de "Complexity Tracking" del plan técnico y aprobada por el líder técnico.

---

**Version**: 1.0.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-02
