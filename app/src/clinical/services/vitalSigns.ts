// Signos vitales (Fase B3): validación de rangos clínicamente plausibles.
// La secretaria y el médico pueden registrarlos; NUNCA se guardan valores en
// el AuditLog (solo referencias) ni sustituyen la valoración del profesional.

import { z } from "zod";

export const vitalSignInputSchema = z.object({
  patientId: z.string().min(1),
  citaId: z.string().min(1).optional(),
  systolicBP: z
    .number()
    .int("TA sistólica debe ser un entero")
    .min(50, "TA sistólica fuera de rango plausible (50–300)")
    .max(300, "TA sistólica fuera de rango plausible (50–300)"),
  diastolicBP: z
    .number()
    .int("TA diastólica debe ser un entero")
    .min(20, "TA diastólica fuera de rango plausible (20–200)")
    .max(200, "TA diastólica fuera de rango plausible (20–200)"),
  heartRate: z
    .number()
    .int()
    .min(20, "Frecuencia cardíaca fuera de rango plausible (20–300)")
    .max(300, "Frecuencia cardíaca fuera de rango plausible (20–300)"),
  temperature: z
    .number()
    .min(30, "Temperatura fuera de rango plausible (30–45 °C)")
    .max(45, "Temperatura fuera de rango plausible (30–45 °C)"),
  respiratoryRate: z
    .number()
    .int()
    .min(4, "Frecuencia respiratoria fuera de rango plausible (4–80)")
    .max(80, "Frecuencia respiratoria fuera de rango plausible (4–80)"),
  oxygenSaturation: z
    .number()
    .int()
    .min(40, "Saturación fuera de rango plausible (40–100 %)")
    .max(100, "Saturación fuera de rango plausible (40–100 %)"),
  weight: z.number().positive("Peso debe ser positivo").max(500),
  height: z.number().positive("Talla debe ser positiva").max(260),
});

export type VitalSignInput = z.infer<typeof vitalSignInputSchema>;
