// Signos vitales (Fase B3): validación de rangos clínicamente plausibles.
// La secretaria y el médico pueden registrarlos; NUNCA se guardan valores en
// el AuditLog (solo referencias) ni sustituyen la valoración del profesional.

import { z } from "zod";
import { HttpError } from "wasp/server";

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

// Valida rangos clínicos plausibles. Lanza HttpError(400) si algún valor
// está fuera de rango (defensa en profundidad junto al schema zod).
export function validateVitalSignRanges(
  data: VitalSignInput,
): VitalSignInput {
  const parsed = vitalSignInputSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => i.message)
      .filter(Boolean)
      .join("; ");
    throw new HttpError(400, msg || "Valores de signos vitales inválidos");
  }
  return parsed.data;
}

// Formatea para UI: etiquetas legibles y unidad por signo.
export interface VitalSignDisplay {
  label: string;
  value: string;
}

export function formatVitalSignsForDisplay(v: {
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  weight: number;
  height: number;
}): VitalSignDisplay[] {
  return [
    { label: "Presión arterial", value: `${v.systolicBP}/${v.diastolicBP} mmHg` },
    { label: "Frecuencia cardíaca", value: `${v.heartRate} lpm` },
    { label: "Temperatura", value: `${v.temperature.toFixed(1)} °C` },
    { label: "Frecuencia respiratoria", value: `${v.respiratoryRate} rpm` },
    { label: "Saturación O₂", value: `${v.oxygenSaturation} %` },
    { label: "Peso", value: `${v.weight} kg` },
    { label: "Talla", value: `${v.height} cm` },
  ];
}

