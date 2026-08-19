# Especificación Funcional Base: MVP DoctorIA

**Feature Branch**: `001-doctoria-mvp`
**Created**: 2026-08-02
**Status**: Draft
**Input**: User description: "Crea la especificación funcional base del MVP de DoctorIA cumpliendo estrictamente la Constitución v1.0.0."

---

## 1. Contexto del Problema y Justificación

DoctorIA es una aplicación asistencial dirigida al personal médico que funciona como una capa de inteligencia artificial sobre el historial clínico para reducir la carga administrativa y facilitar la consulta, estructuración y resumen de información clínica.

### Hallazgos de Investigación
La especificación se fundamenta en los hallazgos de **cinco (5) entrevistas utilizables** realizadas a profesionales de la salud en diversos entornos (rurales, hospitalarios, consulta general, pediatría privada y atención municipal). Los hallazgos principales identificaron:
- **Carga administrativa excesiva**: El médico dedica una parte desproporcionada del tiempo de consulta a ingresar y repetir información en sistemas clínicos.
- **Formularios fragmentados**: Las interfaces actuales obligan a fragmentar los datos en múltiples campos redundantes.
- **Tiempo prolongado en epicrisis**: La elaboración manual de una epicrisis consume entre 30 y 45 minutos.
- **Búsqueda ineficiente de antecedentes**: Localizar consultas o antecedentes previos toma varios minutos.
- **Fallas de usabilidad y rendimiento**: Los sistemas presentan lentitud, bloqueos inesperados o pérdida aparente de datos guardados.
- **Necesidad de alertas de información incompleta**: Los profesionales requieren indicadores visuales claros cuando falta información clínica relevante.
- **Deseo de ingreso en texto libre**: Existe alto interés en redactar o dictar una nota libre que la herramienta organice automáticamente.
- **Riesgo por falta de visibilidad**: La falta de acceso oportuno al historial entre profesionales provoca la duplicación innecesaria de exámenes.

### Deuda de Validación y Gobernanza
- **Excepción Operativa Documentada**: El equipo de DoctorIA está integrado por 7 Doers, lo cual constituye una excepción operativa documentada respecto al estándar habitual.
- **Continuidad de Validación**: La fase de entrevistas inicial cerró con 5 entrevistas y una deuda de validación que continuará de manera sistemática mediante pruebas con usuarios piloto. No se presenta esta muestra como cumplimiento del mínimo ideal de ocho entrevistas.
- **Cumplimiento Constitucional**: La presente especificación cumple estrictamente con los 10 Principios No Negociables de la Constitución v1.0.0 de DoctorIA (`.specify/memory/constitution.md`).

---

## 2. Usuario Principal y Titularidad de Datos

- **Usuario Principal**: Profesional médico debidamente autenticado en el sistema, que atiende pacientes en consulta o área asistencial y requiere consultar, registrar, revisar y resumir información clínica reduciendo su carga cognitiva y administrativa.
- **Titular de la Información**: El paciente es el único titular de su información médica. El paciente **NO es usuario directo del MVP** ni interactuará con el sistema en esta etapa.

---

## 3. Objetivo del MVP

Permitir que un profesional médico autenticado consulte el historial clínico básico de un paciente sintético, ingrese una nota clínica mediante un campo de texto unificado, reciba una propuesta de estructuración o borrador de resumen asistido por IA, y **revise, edite y confirme expresamente** el contenido antes de consolidarlo en el registro clínico con su correspondiente trazabilidad de auditoría.

---

## 4. Estados Obligatorios del Contenido Clínico

Todo contenido clínico gestionado o generado dentro del sistema debe transitar obligatoriamente por los siguientes estados definidos:

1. **Borrador manual**: Texto o datos ingresados directamente por el profesional médico antes de procesarse o confirmarse.
2. **Borrador asistido por IA**: Salida estructurada o resumen generado automáticamente por el motor de IA a partir de la entrada del usuario o del historial.
3. **Revisado**: Contenido que ha sido evaluado y/o modificado por el profesional médico, pero aún no ha recibido la confirmación final.
4. **Confirmado por profesional médico**: Estado final definitivo de la información clínica, alcanzado **únicamente** tras la acción explícita e inequívoca del médico responsable.

> [!CRITICAL]
> **Regla de Oro Constitucional**: NINGÚN contenido generado o asistido por IA puede pasar automáticamente al estado "Confirmado por profesional médico". La supervisión y confirmación humana es estricta e inderogable.

---

## 5. Escenarios de Usuario y Pruebas (User Scenarios & Testing)

### Historias de Usuario Priorizadas

#### HU-01: Autenticación y Control de Acceso del Personal Médico (Prioridad: P1)
**Descripción**: Como profesional médico, quiero autenticarme de manera segura en la plataforma para acceder únicamente a los pacientes y funcionalidades clínicas autorizadas.
**Motivo de Valor**: Garantiza la seguridad de la información clínica, la privacidad del paciente y la trazabilidad y responsabilidad del registro.
**Prueba Independiente**: Se puede probar intentando ingresar con credenciales válidas e inválidas, verificando que sin autenticación exitosa no se pueda visualizar ningún dato clínico.
**Dependencias Funcionales**: Ninguna (Flujo inicial).

**Criterios de Aceptación y Escenarios**:
1. **Given** un profesional médico no autenticado en la página de ingreso, **When** proporciona sus credenciales válidas, **Then** el sistema inicia sesión y redirige al listado básico de pacientes.
2. **Given** un usuario no autenticado, **When** intenta acceder directamente a la URL de un paciente o nota clínica, **Then** el sistema deniega el acceso y lo redirige a la pantalla de autenticación sin revelar información privada.
3. **Given** credenciales incorrectas o inactivas, **When** el usuario intenta autenticarse, **Then** el sistema muestra un mensaje claro de error de credenciales sin especificar si falló el usuario o la contraseña.

---

#### HU-02: Búsqueda y Consulta de Historial Clínico de Pacientes Sintéticos (Prioridad: P1)
**Descripción**: Como profesional médico autenticado, quiero buscar y seleccionar un paciente sintético de la lista para visualizar su historial clínico básico antes de la atención.
**Motivo de Valor**: Permite conocer rápidamente los antecedentes del paciente y consultas anteriores para tomar decisiones informadas sin perder tiempo buscando registros en múltiples pantallas.
**Prueba Independiente**: Se puede probar seleccionando un paciente sintético precargado y verificando que su historial básico (consultas anteriores, antecedentes) se despliegue correctamente.
**Dependencias Funcionales**: HU-01 (Autenticación).

**Criterios de Aceptación y Escenarios**:
1. **Given** el médico autenticado en la vista principal, **When** escribe el nombre o identificador sintético en el buscador, **Then** el sistema filtra dinámicamente la lista de pacientes sintéticos mostrando coincidencias claras.
2. **Given** un paciente sintético seleccionado de la lista, **When** el médico abre su perfil, **Then** el sistema presenta el historial clínico básico en un formato cronológico legible.
3. **Given** un término de búsqueda que no coincide con ningún registro, **When** se ejecuta la búsqueda, **Then** el sistema presenta un estado vacío explicativo que indica que no se encontraron pacientes sintéticos.

---

#### HU-03: Ingreso de Nota Clínica mediante Campo Unificado y Estructuración Asistida por IA (Prioridad: P1)
**Descripción**: Como profesional médico, quiero redactar la evolución del paciente en un único campo de texto libre y solicitar la estructuración asistida por IA para organizarla automáticamente en secciones clínicas sin llenar formularios fragmentados.
**Motivo de Valor**: Elimina la fricción de cambiar entre decenas de campos de texto, reduciendo significativamente el tiempo administrativo por consulta.
**Prueba Independiente**: Se puede probar ingresando un párrafo narrativo plano, solicitando la estructuración asistida por IA y verificando que se genere un borrador asistido por IA listo para revisión.
**Dependencias Funcionales**: HU-01, HU-02.

**Criterios de Aceptación y Escenarios**:
1. **Given** el médico en la vista de atención al paciente, **When** escribe o pega la nota libre en el campo unificado y presiona "Estructurar con IA", **Then** el sistema procesa el texto y presenta el resultado como "Borrador asistido por IA" con etiquetas visibles de asistencia por IA.
2. **Given** un texto original escrito por el médico, **When** se ejecuta la estructuración con IA, **Then** el sistema mantiene el texto original completo disponible en un área claramente accesible para consulta y comparación.
3. **Given** una nota vacía o demasiado corta, **When** el médico solicita la estructuración, **Then** el sistema deshabilita la acción o notifica amigablemente que se requiere ingresar texto previo.

---

#### HU-04: Revisión, Edición Libre y Confirmación Expresa del Contenido Clínico (Prioridad: P1)
**Descripción**: Como profesional médico, quiero revisar y editar libremente el borrador estructurado por la IA y confirmarlo explícitamente para que pase a ser un registro definitivo firmado bajo mi responsabilidad.
**Motivo de Valor**: Garantiza la seguridad clínica y la supervisión humana inderogable; la IA sugiere, pero el médico decide y valida el registro final.
**Prueba Independiente**: Se puede probar editando un campo del borrador generado por IA y haciendo clic en "Confirmar Nota", comprobando que el estado cambie a "Confirmado por profesional médico" y se deshabilite su alteración directa no auditada.
**Dependencias Funcionales**: HU-03.

**Criterios de Aceptación y Escenarios**:
1. **Given** un borrador asistido por IA desplegado en pantalla, **When** el médico modifica cualquier campo estructurado o añade información, **Then** el estado visual se actualiza a "Revisado" indicando intervención humana.
2. **Given** una nota en estado "Borrador asistido por IA" o "Revisado", **When** el médico presiona el botón "Confirmar Nota", **Then** el sistema exige una acción de confirmación explícita, cambia el estado a "Confirmado por profesional médico" y registra la auditoría (autor, fecha, hora).
3. **Given** un borrador asistido por IA, **When** el médico no realiza ninguna acción explícita de confirmación, **Then** la nota NUNCA pasa a estado "Confirmado" de forma automática ni se guarda como registro definitivo.

---

#### HU-05: Identificación Clara de Información Faltante y Alertas Visuales (Prioridad: P2)
**Descripción**: Como profesional médico, quiero ver resaltados claramente los campos o secciones clínicas obligatorias que no han sido completados en la nota para evitar omisiones en la historia clínica.
**Motivo de Valor**: Previene vacíos de información esenciales (como alergias, signos vitales o motivo de consulta) antes de consolidar el registro.
**Prueba Independiente**: Se puede probar enviando a estructuración un texto parcial y verificando que el borrador señale con texto e iconografía explícita cuáles datos faltan.
**Dependencias Funcionales**: HU-03, HU-04.

**Criterios de Aceptación y Escenarios**:
1. **Given** un borrador estructurado con secciones incompletas, **When** se presenta al médico, **Then** el sistema señala los campos pendientes utilizando **texto descriptivo e iconografía de advertencia** (sin depender exclusivamente del color).
2. **Given** una nota con campos obligatorios pendientes, **When** el médico intenta confirmarla, **Then** el sistema bloquea la confirmación con un mensaje claro de advertencia indicando cuáles de las 5 secciones obligatorias (Motivo de consulta, Nota clínica/evolución, Examen físico, Valoración clínica, Plan/indicaciones) se encuentran incompletas, exigiendo su completitud o la especificación explícita de "No aplica" con su correspondiente justificación breve antes de proceder.

---

#### HU-06: Generación de Borrador de Resumen Clínico o Epicrisis (Prioridad: P2)
**Descripción**: Como profesional médico, quiero solicitar la generación de un borrador de resumen clínico o epicrisis basado en el historial disponible del paciente para agilizar la transferencia o alta médica.
**Motivo de Valor**: El objetivo es reducir el tiempo manual actual de 30 a 45 minutos; el ahorro real deberá medirse y validarse con usuarios piloto.
**Prueba Independiente**: Se puede probar ejecutando "Generar Epicrisis" sobre un paciente con consultas sintéticas registradas y verificando la generación de un borrador asistido por IA editable.
**Dependencias Funcionales**: HU-02, HU-03, HU-04.

**Criterios de Aceptación y Escenarios**:
1. **Given** la ficha de un paciente sintético con historial, **When** el médico selecciona "Generar Borrador de Epicrisis", **Then** el sistema compila la información y genera un resumen en estado "Borrador asistido por IA".
2. **Given** el borrador de epicrisis generado, **When** el médico lo revisa, **Then** puede editar cualquier sección del resumen antes de realizar la confirmación explícita.
3. **Given** un resumen o epicrisis confirmado, **When** se consulta en el sistema, **Then** muestra claramente la insignia "Contenido asistido por IA - Confirmado por [Nombre del Médico]".

---

#### HU-07: Tolerancia a Fallos de IA y Continuidad Manual Segura (Prioridad: P2)
**Descripción**: Como profesional médico, quiero continuar redactando y guardando mi nota clínica manualmente si el servicio de asistencia por IA no está disponible o falla, sin perder el texto original que ya ingresé.
**Motivo de Valor**: Evita el bloqueo del acto médico y la pérdida de trabajo redactado en entornos con conectividad inestable o fallas temporales de servicio.
**Prueba Independiente**: Se puede probar simulando una indisponibilidad de IA y verificando que el médico reciba una alerta no bloqueante, conservando su texto en el campo unificado y pudiendo guardar la nota como "Borrador manual".
**Dependencias Funcionales**: HU-03.

**Criterios de Aceptación y Escenarios**:
1. **Given** un médico que ha redactado su nota en el campo unificado, **When** el servicio de IA no responde o retorna un error, **Then** el sistema muestra una notificación clara de falla de IA, **conserva intacto el texto ingresado** y activa el modo de edición manual.
2. **Given** la falla del servicio de IA, **When** el médico decide continuar manualmente, **Then** el sistema le permite estructurar o guardar su nota como "Borrador manual" y posteriormente confirmarla sin requerir el procesamiento de IA.

---

### Casos Límite y Manejo de Errores (Edge Cases)

- **Corte de red a mitad de estructuración**: Si la conexión falla mientras la IA procesa, el sistema conserva de forma segura el texto original completo, permite al usuario reintentar o continuar manualmente y garantiza que no se pierda ni altere la información redactada.
- **Texto extremadamente extenso o ambiguo**: Si la nota unificada excede los límites procesables o contiene ambigüedades, el sistema conserva el texto original completo en todo momento, informa explícitamente al médico que no fue posible estructurarlo totalmente e identifica el contenido específico que requiere revisión, permitiéndole corregir, reintentar o continuar manualmente sin descartar ni truncar información en ningún caso sin advertencia previa.
- **Intento de confirmación simultánea o doble clic**: El sistema inhabilita botones tras la primera confirmación para evitar duplicidad de registros en auditoría.
- **Sesión expirada con borrador no guardado**: Si la sesión del médico expira durante la redacción, el sistema procura conservar de forma segura el borrador y permitir su recuperación después de la reautenticación; el mecanismo técnico de almacenamiento se definirá en el plan técnico.

---

## 6. Requisitos Funcionales (RF)

Todos los requisitos funcionales son trazables a las historias de usuario y respetan los límites del MVP.

- **RF-001**: El sistema DEBE autenticar obligatoriamente a los profesionales médicos mediante credenciales individuales antes de otorgar acceso a cualquier dato clínico o funcionalidad. (HU-01)
- **RF-002**: El sistema DEBE restringir el acceso a la información de pacientes sintéticos únicamente a usuarios médicos con sesión activa y autenticada. (HU-01, HU-02)
- **RF-003**: El sistema DEBE permitir la búsqueda básica de pacientes sintéticos por nombre, apellido o número de identificación sintético. (HU-02)
- **RF-004**: El sistema DEBE desplegar el historial clínico básico del paciente sintético en orden cronológico inverso, incluyendo consultas previas y antecedentes registrados. (HU-02)
- **RF-005**: El sistema DEBE proveer un campo de texto unificado para el ingreso libre de notas clínicas por parte del profesional médico. (HU-03)
- **RF-006**: El sistema DEBE permitir al profesional médico solicitar la estructuración asistida por IA a partir del texto ingresado en el campo unificado. (HU-03)
- **RF-007**: El sistema DEBE clasificar automáticamente el texto unificado en las 5 secciones clínicas obligatorias del MVP: 1) Motivo de consulta, 2) Nota clínica o evolución, 3) Examen físico, 4) Valoración clínica realizada por el profesional, y 5) Plan o indicaciones registradas por el profesional. La IA únicamente organiza el contenido sin tomar decisiones clínicas autónomas. (HU-03)
- **RF-008**: El sistema DEBE conservar obligatoriamente y en todo momento el texto original no estructurado redactado por el médico, manteniéndolo accesible para consulta y comparación. (HU-03, HU-07)
- **RF-009**: El sistema DEBE asignar automáticamente el estado "Borrador asistido por IA" a toda propuesta estructurada generada por el motor de inteligencia artificial. (HU-03)
- **RF-010**: El sistema DEBE mostrar una etiqueta o insignia clara e inconfundible ("Contenido asistido por IA") en toda salida generada por modelos automatizados. (HU-03, HU-06)
- **RF-011**: El sistema DEBE permitir al profesional médico editar libremente cualquier campo del borrador generado por la IA antes de confirmarlo. (HU-04)
- **RF-012**: El sistema DEBE cambiar el estado del contenido a "Revisado" en cuanto el profesional médico efectúe modificaciones manuales sobre un borrador de IA. (HU-04)
- **RF-013**: El sistema DEBE exigir una acción explícita e inequívoca de confirmación por parte del médico (ej. botón "Confirmar Nota") para cambiar el estado a "Confirmado por profesional médico". (HU-04)
- **RF-014**: El sistema DEBE prohibir estrictamente que cualquier contenido asistido por IA pase a estado "Confirmado" de forma automática o por omisión. (HU-04)
- **RF-015**: El sistema DEBE identificar de forma clara y visible los campos o datos clínicos obligatorios que se encuentren faltantes o incompletos en la nota. (HU-05)
- **RF-016**: El sistema DEBE utilizar texto explicativo e iconografía distintiva (adicional al uso de colores) para señalar la información incompleta o pendiente. (HU-05)
- **RF-017**: El sistema DEBE permitir solicitar la generación de un borrador de resumen clínico o epicrisis a partir de los datos disponibles en el historial del paciente sintético. (HU-06)
- **RF-018**: El sistema DEBE presentar el borrador de resumen clínico o epicrisis generado por IA (que incluye los 10 elementos mínimos: 1. Identificación sintética del paciente, 2. Motivo de ingreso/atención, 3. Antecedentes relevantes, 4. Resumen de evolución, 5. Procedimientos/resultados, 6. Diagnósticos validados, 7. Condición al cierre/alta, 8. Indicaciones/seguimiento, 9. Profesional responsable, y 10. Fecha/hora) inicialmente en estado "Borrador asistido por IA", requiriendo revisión, edición libre y confirmación explícita por el médico. (HU-06)
- **RF-019**: El sistema DEBE generar un registro básico de auditoría por cada consulta, creación, modificación o confirmación de notas clínicas o epicrisis. (HU-04, HU-06)
- **RF-020**: El registro de auditoría DEBE incluir obligatoriamente: identificador del autor/revisor, fecha, hora exacta y estado asignado al contenido. (HU-04, HU-06)
- **RF-021**: El sistema DEBE gestionar de manera segura y grácil la indisponibilidad o falla del servicio de IA, notificando al médico sin bloquear la interfaz ni perder la información redactada. (HU-07)
- **RF-022**: El sistema DEBE permitir al profesional médico guardar su nota clínica como "Borrador manual" y completarla manualmente si la IA no está disponible. (HU-07)
- **RF-023**: El sistema DEBE presentar estados visuales claros para todas las pantallas del flujo: estado de carga, estado de éxito, estado de error, estado vacío y ausencia de resultados. (HU-02, HU-03, HU-07)
- **RF-024**: El sistema DEBE utilizar exclusivamente datos sintéticos de pacientes e historias clínicas durante su desarrollo, pruebas y demostraciones. (HU-01 a HU-07)
- **RF-025**: El sistema DEBE definir y aplicar estrictamente dos roles funcionales: 1) **Médico** (con permisos de acceso a pacientes autorizados, consulta de historial, creación/estructuración de notas, revisión/edición de borradores, confirmación, creación de adendas y consulta de su propia auditoría) y 2) **Administrador** (con permisos de gestión de cuentas, asignación de roles, administración de datos sintéticos de demostración y consulta de auditoría administrativa, sin acceso ni permisos por defecto para consultar, modificar, sustituir o confirmar contenido clínico). (HU-01)
- **RF-026**: Para confirmar una nota clínica, el sistema DEBE verificar acumulativamente: 1) paciente sintético seleccionado, 2) texto original íntegro conservado, 3) profesional responsable identificado, 4) fecha y hora registradas, y 5) cada una de las 5 secciones obligatorias completada o marcada expresamente como "No aplica" con su correspondiente justificación breve. (HU-04, HU-05)
- **RF-027**: Si se intenta confirmar una nota clínica con una sección obligatoria vacía y sin la justificación explícita de "No aplica", el sistema DEBE bloquear la confirmación y desplegar un mensaje descriptivo de las secciones pendientes. (HU-05)
- **RF-028**: Toda nota clínica o epicrisis en estado "Confirmado por profesional médico" DEBE ser inmutable, prohibiendo su edición directa o sobrescritura. (HU-04, HU-06)
- **RF-029**: Toda modificación o corrección posterior sobre un registro clínico o epicrisis confirmada DEBE realizarse exclusivamente mediante la creación de una nueva versión o adenda que conserve la versión anterior, registre el motivo de la corrección, identifique al profesional responsable, registre fecha y hora, y mantenga trazabilidad explícita entre versiones. (HU-04, HU-06)
- **RF-030**: El sistema DEBE permitir al profesional médico realizar consultas al asistente de voz sobre sus pacientes autorizados (resúmenes, fichas, signos), resolviendo el paciente con nombre, apellido o `syntheticId`, presentando la respuesta como resultado sintético ilustrativo que requiere validación clínica, y registrando la consulta en auditoría sin contenido clínico. (HU-03, HU-07)
- **RF-031**: El sistema DEBE permitir crear una nota clínica por voz, interpretando dictados como "anota en la historia de \<paciente\> que …" o "agrega una nota a \<syntheticId\> …", guardándola SIEMPRE como borrador (`DRAFT_MANUAL`) pendiente de revisión y confirmación explícita del médico, redirigiendo al editor para la revisión humana; si la mención del paciente es ambigua (varias coincidencias autorizadas), DEBE solicitar el `syntheticId` exacto en lugar de adivinar, y si el dictado clínico es irreconocible DEBE solicitar repetir el contenido. (HU-03, HU-04, HU-07)

---

## 7. Requisitos No Funcionales (RNF)

- **RNF-001 (Seguridad - Autenticación y Autorización)**: El sistema DEBE autenticar a todo usuario antes de dar acceso a datos clínicos, garantizando aislamiento total entre sesiones no autorizadas.
- **RNF-002 (Privacidad - Cero PII Real y Cero PII en Logs)**: El sistema NO DEBE registrar información clínica sensible, datos personales de pacientes ni credenciales en las trazas de registro (logs) de la aplicación. Se utilizarán únicamente datos sintéticos.
- **RNF-003 (Usabilidad - Reducción de Carga cognitiva)**: La interfaz DEBE estar diseñada para minimizar clics y evitar el llenado de campos repetitivos, centralizando la entrada en el campo de texto unificado.
- **RNF-004 (Usabilidad - Conservación del Texto Original)**: El sistema DEBE garantizar la preservación del 100% del texto original introducido por el profesional médico ante cualquier falla o procesamiento por IA.
- **RNF-005 (Accesibilidad - WCAG AA)**: La interfaz de usuario DEBE cumplir con las pautas de accesibilidad **WCAG nivel AA**, asegurando ratios de contraste adecuados y legibilidad tipográfica.
- **RNF-006 (Accesibilidad - Indicadores Multimodales)**: Toda alerta de error, advertencia o campo pendiente DEBE transmitirse mediante la combinación de texto explícito e iconografía, sin depender exclusivamente del color.
- **RNF-007 (Trazabilidad y Auditoría)**: Toda confirmación o consulta sobre la ficha de un paciente DEBE dejar una marca de auditoría inmutable indicando usuario, fecha, hora y acción realizada.
- **RNF-008 (Tolerancia a Fallos y Resiliencia)**: Ante una falla en la API o motor de IA, el sistema DEBE degradarse grácilmente al modo de trabajo manual sin congelar la aplicación ni cerrar la sesión activa.
- **RNF-009 (Supervisión Humana)**: La arquitectura funcional DEBE impedir de forma absoluta que un algoritmo o modelo de IA tome decisiones clínicas o confirme registros sin intervención y confirmación explícita del médico.
- **RNF-010 (Rendimiento de Navegación e Interacción en Staging)**: El sistema DEBE responder a las interacciones normales de navegación, carga y búsqueda con un tiempo objetivo máximo de 2 segundos en el percentil 95 ($P_{95} \le 2\text{s}$) en ambiente de staging bajo la carga de prueba definida para el MVP.
- **RNF-011 (Rendimiento y Tolerancia en Procesamiento de IA en Staging)**: El sistema DEBE procesar la estructuración asistida o generación de borrador de epicrisis con un tiempo objetivo de respuesta de hasta 15 segundos en el percentil 95 ($P_{95} \le 15\text{s}$) en staging. Cuando el procesamiento supere los 2 segundos, DEBE mostrar un estado visible de procesamiento. Tras 30 segundos sin respuesta, el proceso DEBE considerarse fallido, notificarse de forma no bloqueante y permitir continuar manualmente sin provocar pérdida o alteración del texto original.
- **RNF-012 (Calidad de Estructuración de Texto por IA sobre Dataset Sintético)**: La calidad de la IA DEBE evaluarse exclusivamente como estructuración de texto (no como diagnóstico médico) sobre un conjunto etiquetado de al menos 30 notas clínicas sintéticas. El sistema DEBE conservar el 100% del texto original sin omisiones silenciosas y marcar como "Requiere revisión" todo contenido no clasificable. El objetivo inicial es alcanzar al menos 90% de asignación correcta a las 5 secciones definidas sobre dicho conjunto sintético, requiriendo en todos los casos revisión y confirmación médica obligatoria sin interpretarse como validación clínica definitiva.
- **RNF-013 (Disponibilidad Verificable en Staging)**: El sistema DEBE registrar y permitir verificar la disponibilidad del MVP durante las sesiones de prueba en ambiente de staging, incluyendo el registro de interrupciones y tiempos de inactividad observados. La meta porcentual definitiva de disponibilidad para producción se establecerá únicamente después de obtener evidencia operativa durante el piloto.

---

## 8. Entidades Clave (Key Entities)

- **ProfesionalMédico**: Representa al usuario del sistema (médico autenticado). Atributos clave: Identificador único, nombre completo, especialidad/rol, estado de cuenta.
- **PacienteSintético**: Representa al titular sintético de la información clínica. Atributos clave: Identificador sintético, nombre ficticio, edad/fecha nacimiento sintética, sexo, antecedentes relevantes sintéticos.
- **HistoriaClínica**: Colección cronológica de registros clínicos pertenecientes a un paciente sintético. Atributos clave: Identificador de historia, lista de notas y resúmenes asociados.
- **NotaClínica**: Registro de la atención brindada en una consulta. Atributos clave: Texto original unificado, secciones estructuradas (motivo, anamnesis, examen, plan), estado (Borrador manual, Borrador asistido por IA, Revisado, Confirmado), autor médico, insignia de asistencia por IA.
- **ResumenEpicrisis**: Borrador sintético de alta o resumen de estadía/historial. Atributos clave: Texto compilado, secciones de antecedentes y evolución, estado, insignia de asistencia por IA, médico responsable.
- **RegistroAuditoría**: Evento registrado por seguridad y trazabilidad. Atributos clave: Identificador de evento, tipo de acción (consulta, creación, edición, confirmación), ID de usuario médico, timestamp (fecha y hora exacta), ID de recurso afectado.

---

## 9. Criterios de Éxito Medibles (Success Criteria)

- **SC-001**: Un profesional médico autenticado puede completar el flujo de ingreso de nota unificada, estructuración por IA, edición y confirmación en datos sintéticos.
- **SC-002**: El 100% de los contenidos generados o asistidos por IA permanecen en estado "Borrador asistido por IA" hasta que el profesional médico ejecute una acción explícita de confirmación.
- **SC-003**: En el 100% de las pruebas de fallas simuladas de IA, el sistema conserva el texto original redactado por el médico y permite guardar la nota manualmente sin perder información.
- **SC-004**: Cada confirmación de nota o epicrisis genera un registro de auditoría verificable con autor, fecha, hora y estado final.
- **SC-005**: Un usuario no autenticado o no autorizado no puede consultar ni modificar la información de ningún paciente sintético (0% de accesos no autorizados en pruebas de seguridad).
- **SC-006**: El 100% de las alertas de campos faltantes o incompletos muestran texto descriptivo e iconografía de acuerdo con el estándar WCAG AA.
- **SC-007**: El flujo principal completo (Autenticación → Búsqueda → Consulta → Nota Unificada → IA → Edición → Confirmación → Auditoría) se puede ejecutar exitosamente de principio a fin (E2E) utilizando únicamente datos sintéticos.

---

## 10. Fuera del Alcance del MVP (Out of Scope)

Quedan **estrictamente excluidos** del alcance del presente MVP funcional:

1. **Integración real o en vivo** con sistemas de salud públicos o privados (MSP, IESS, SOGA, PRAS, SAM, Orion).
2. **Interoperabilidad de historias clínicas** entre distintas instituciones médicas.
3. **Módulos automáticos de farmacia, recetas e inventario**.
4. **Diagnóstico autónomo** por parte de la IA.
5. **Prescripción automática de medicamentos**.
6. **Recomendaciones terapéuticas automáticas** presentadas como decisiones confirmadas.
7. **Alertas reales de dosis o interacciones medicamentosas** de alto riesgo.
8. **Funcionamiento 100% offline** de la aplicación.
9. **Analítica clínica avanzada**, tableros epidemiológicos o reportes gerenciales.
10. **Módulos de cobro, pagos o facturación médica** (las funciones de pagos de Open SaaS se desactivan/excluyen del flujo clínico).
11. **Utilización de datos de pacientes reales o historias clínicas verdaderas** (uso exclusivo de datos sintéticos).
12. **Acceso directo de pacientes** al sistema.

---

## 11. Hipótesis Pendientes de Validación

Las siguientes aseveraciones se registran formalmente como **Hipótesis a validar** con usuarios piloto durante el MVP, y **NO** como hechos comprobados:

- **H-01**: Que el personal médico adoptará de manera favorable un campo de texto unificado en lugar de formularios tradicionales con múltiples campos.
- **H-02**: Que la estructuración asistida por IA reducirá efectivamente el tiempo administrativo por consulta en comparación con el llenado manual.
- **H-03**: Que los médicos confiarán en los borradores generados por la IA tras poder revisarlos y editarlos libremente.
- **H-04**: Que los modelos de IA clasificarán correctamente la información clínica en las secciones estándar según la narrativa del médico.
- **H-05**: Que el ahorro de tiempo en documentación se traducirá en una mejor calidad de atención directa al paciente.
- **H-06**: Que las instituciones de salud autorizarán futuras integraciones con DoctorIA una vez demostrado el valor del MVP.
- **H-07**: Que la solución planteada resultará funcional y operable en entornos de atención médica con conectividad a internet limitada.

---

## 12. Clarificaciones Integradas (`/speckit-clarify`)

### Sesión 2026-08-02

- **C-01 (Formato mínimo de nota clínica y confirmación)**: La nota estructurada comprende 5 secciones obligatorias (1. Motivo de consulta, 2. Nota clínica/evolución, 3. Examen físico, 4. Valoración clínica, 5. Plan/indicaciones). La IA organiza el contenido sin tomar decisiones autónomas. Para confirmar se exige paciente sintético, texto original íntegro, autor, timestamp, y cada sección completada o justificada expresamente con "No aplica" (con justificación breve).
- **C-02 (Epicrisis e Inmutabilidad por Adendas)**: El borrador de epicrisis comprende 10 elementos sintéticos mínimos. Los registros confirmados son inmutables; toda corrección o adición posterior se realiza mediante una nueva versión o adenda que conserva el historial previo y registra autor, fecha, hora y motivo de corrección.
- **C-03 (Roles y Permisos)**: El MVP cuenta con dos roles funcionales: **Médico** (acceso a pacientes autorizados, notas, IA, borradores, confirmaciones, adendas y su auditoría) y **Administrador** (gestión de cuentas, roles, datos sintéticos y auditoría administrativa). El Administrador NO posee acceso ni permisos por defecto para consultar, modificar, sustituir o confirmar contenido clínico.
- **C-04 (Rendimiento del MVP en Staging)**: Objetivos verificables para staging: navegación/búsqueda $P_{95} \le 2\text{s}$; indicador de procesamiento si IA $> 2\text{s}$; estructuración de IA $P_{95} \le 15\text{s}$; timeout a 30s no bloqueante permitiendo continuación manual sin perder texto original.
- **C-05 (Calidad de Estructuración Asistida)**: Evaluación exclusiva como estructurador de texto sobre dataset sintético de al menos 30 notas. Se exige 100% de conservación de texto, marca de "Requiere revisión" para contenido no clasificable, y objetivo inicial del 90% de precisión en asignación a las 5 secciones, requiriendo siempre revisión y confirmación médica.
- **Disponibilidad en staging (decisión de auditoría)**: La disponibilidad del sistema en staging será medible y registrable (RNF-013). El SLA porcentual de producción permanece como decisión posterior al piloto, basada en evidencia operativa real. Esta definición no bloquea la planificación técnica del MVP.

---

## 13. Verificación de Cumplimiento Constitucional (Constitution Check)

| Principio Constitucional | Estado de Cumplimiento | Evidencia en esta Especificación |
| :--- | :--- | :--- |
| **P1: Spec-Driven Development** | ✅ Cumple | Especificación redactada antes de cualquier plan o código y pendiente de aprobación formal. Hipótesis explícitas. |
| **P2: AI Director Mindset** | ✅ Cumple | No hay código generado; definición clara de alcance atómico para desarrollo posterior. |
| **P3: Reutilización de Stack** | ✅ Cumple | Respeta el alcance funcional basándose en capacidades estándar sin sobreingeniería. |
| **P4: Seguridad Clínica y Supervisión** | ✅ Cumple | La IA nunca diagnostica ni prescribe; contenido siempre inicia en Borrador y exige confirmación humana explícita. |
| **P5: Protección de Datos y Privacidad** | ✅ Cumple | Exclusivamente datos sintéticos; prohibición de PII en logs y en repositorio. |
| **P6: Alcance Controlado del MVP** | ✅ Cumple | Cubre exactamente los 12 flujos permitidos y documenta todas las exclusiones explícitas. |
| **P7: Calidad y Pruebas Rigurosas** | ✅ Cumple | Historias con Given-When-Then, criterios de aceptación verificables y pruebas independientes. |
| **P8: Usabilidad y Accesibilidad** | ✅ Cumple | Texto unificado, cumplimiento WCAG AA, indicación de campos faltantes con texto e iconografía. |
| **P9: Trazabilidad Integral** | ✅ Cumple | Registro de auditoría obligatorio con autor, fecha, hora y estado; trazabilidad de borradores. |
| **P10: Gobierno del Proyecto** | ✅ Cumple | Documenta la excepción de 7 Doers y el proceso de validación continua con pilotos. |

---
