// Generador de archivos iCalendar (.ics - RFC 5545)
// Exportación client-side y no bloqueante para citas de DoctorIA.

export interface IcsEventParams {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizer?: string;
}

export function generateIcsFile(params: IcsEventParams): string {
  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DoctorIA//Cita Clinica//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${formatIcsDate(params.startTime)}`,
    `DTEND:${formatIcsDate(params.endTime)}`,
    `SUMMARY:${params.summary.replace(/[\r\n]+/g, " ")}`,
    params.description ? `DESCRIPTION:${params.description.replace(/[\r\n]+/g, "\\n")}` : null,
    params.location ? `LOCATION:${params.location.replace(/[\r\n]+/g, " ")}` : "LOCATION:Consulta Médica DoctorIA",
    params.organizer ? `ORGANIZER;CN=${params.organizer}:mailto:noreply@doctoria.app` : null,
    `UID:${crypto.randomUUID()}@doctoria.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

export function downloadIcsFile(filename: string, icsContent: string) {
  try {
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar archivo .ics:", error);
  }
}
