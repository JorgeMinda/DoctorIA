# DESIGN.md — Clinical Intelligence Design System

Sistema de diseño obligatorio para DoctorIA. **Toda la UI de FASE 4 (y cualquier
componente de frontend clínico nuevo) debe leer y aplicar estrictamente estas reglas.**

## 1. Tipografía
- `font-mono` (JetBrains Mono) para: TODOS los números, horas, IDs de paciente
  (`PAC-NNN`), signos vitales y cualquier valor numérico/clave.
- Sans-serif por defecto para textos de UI, etiquetas y párrafos narrativos.

## 2. Paleta de Estados de Cita
- `PROGRAMADA` (scheduled): `bg-blue-500/10 text-blue-400 border-blue-500/20`
- `EN_CURSO` (in_progress): `bg-cyan-500/10 text-cyan-400 border-cyan-500/20`
  (con sutil `glow` si es el estado activo).
- `COMPLETADA` (completed): `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
- `CANCELADA` / `NO_ASISTIO`: `bg-red-500/10 text-red-400 border-red-500/20`

## 3. Formulario de Signos Vitales
- Limpio, tipo tarjeta, con inputs claros.
- Badge superior obligatorio: **"📊 Registro Pre-Clínico"** para diferenciarlo
  de la nota médica.

## 4. Vista de Impresión (Epicrisis)
- `print:hidden` en toda navegación, sidebars y botones de acción.
- Contenedor del documento: `print:bg-white print:text-black print:shadow-none`.

## 5. Accesibilidad
- Contraste WCAG AA mínimo.
- Horarios ocupados en la agenda: visualmente deshabilitados
  (`opacity-50 cursor-not-allowed`), NO solo eliminados.

## Validación
Tras generar código de UI, revisar mentalmente el cumplimiento de estas 5 reglas.
Si un componente usa colores hardcodeados o rompe la jerarquía visual, corregirlo
antes de mostrarlo.
