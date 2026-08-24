// Representación PDF de una Epicrisis (client-side, @react-pdf/renderer).
// RESTRICCIÓN: cero generación de PDF en el servidor (Render Free Tier).
// Regla de negocio: si status !== "CONFIRMED", el documento lleva marca de agua
// de BORRADOR. No se inventan campos: solo se muestran los datos de la epicrisis.

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// Cian de marca DoctorIA (--primary: hsl(186 91% 45%) oscurecido para impresión).
const BRAND_CYAN = "#0E7490";
const BRAND_CYAN_LIGHT = "#E6F7FA";
const INK = "#1F2937";
const INK_SOFT = "#4B5563";
const DRAFT_RED = "#B91C1C";

export interface EpicrisisPDFPerson {
  fullName: string | null;
  username: string | null;
  email: string | null;
}

export interface EpicrisisPDFData {
  id: string;
  status: string;
  noteType: string;
  aiAssisted?: boolean;
  addendumReason?: string | null;
  patientIdentification: string;
  reasonForAdmission: string | null;
  relevantHistory: string | null;
  evolutionSummary: string | null;
  proceduresResults: string | null;
  validatedDiagnoses: string | null;
  conditionAtDischarge: string | null;
  followUpInstructions: string | null;
  responsibleProfessional: string;
  dateTime: string | Date;
  confirmedAt: string | Date | null;
  createdAt: string | Date;
  author: EpicrisisPDFPerson;
  confirmedBy: EpicrisisPDFPerson | null;
  patient: {
    syntheticId: string;
    firstName: string;
    lastName: string;
  };
}

const NO_REGISTERED = "No registrado";

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function personLabel(person: EpicrisisPDFPerson | null | undefined): string {
  return person?.fullName ?? person?.username ?? person?.email ?? NO_REGISTERED;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: INK,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 56,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND_CYAN,
    paddingBottom: 10,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brandName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: BRAND_CYAN,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 9,
    color: INK_SOFT,
    marginTop: 2,
  },
  statusChip: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    color: "#065F46",
    backgroundColor: "#D1FAE5",
  },
  statusChipDraft: {
    color: DRAFT_RED,
    backgroundColor: "#FEE2E2",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: BRAND_CYAN_LIGHT,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  metaItem: {
    width: "50%",
    marginBottom: 3,
    paddingRight: 8,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: BRAND_CYAN,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 10,
    color: INK,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: BRAND_CYAN,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#D1D5DB",
  },
  sectionValue: {
    fontSize: 10,
    color: INK,
  },
  addendumBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#D97706",
    backgroundColor: "#FFFBEB",
    padding: 8,
    marginBottom: 14,
  },
  addendumText: {
    fontSize: 9,
    color: "#92400E",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: "#D1D5DB",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: INK_SOFT,
  },
  watermark: {
    position: "absolute",
    top: "42%",
    left: -60,
    right: -60,
    alignItems: "center",
    transform: "rotate(-30deg)",
    opacity: 0.16,
  },
  watermarkText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    color: DRAFT_RED,
    textAlign: "center",
    letterSpacing: 2,
  },
});

const EPICRISIS_PDF_SECTIONS: [keyof EpicrisisPDFData, string][] = [
  ["reasonForAdmission", "Motivo de ingreso"],
  ["relevantHistory", "Antecedentes relevantes"],
  ["evolutionSummary", "Resumen de evolución"],
  ["proceduresResults", "Procedimientos y resultados"],
  ["validatedDiagnoses", "Diagnósticos validados"],
  ["conditionAtDischarge", "Condición al egreso"],
  ["followUpInstructions", "Instrucciones de seguimiento"],
];

function sectionValue(epicrisis: EpicrisisPDFData, key: keyof EpicrisisPDFData): string {
  const raw = epicrisis[key];
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return NO_REGISTERED;
  }
  return String(raw);
}

export function EpicrisisPDFDocument({
  epicrisis,
}: {
  epicrisis: EpicrisisPDFData;
}) {
  const isConfirmed = epicrisis.status === "CONFIRMED";
  const isAddendum = epicrisis.noteType === "ADDENDUM";

  return (
    <Document
      title={`Epicrisis ${epicrisis.patient.syntheticId}`}
      author="DoctorIA"
      subject="Epicrisis médica"
    >
      <Page size="A4" style={styles.page}>
        {!isConfirmed && (
          <View style={styles.watermark} fixed>
            <Text style={styles.watermarkText}>
              BORRADOR - REQUIERE{"\n"}VALIDACIÓN MÉDICA
            </Text>
          </View>
        )}

        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brandName}>DoctorIA</Text>
            <Text style={styles.brandSubtitle}>
              Epicrisis {isAddendum ? "- Adenda" : ""} · Documento clínico
              confidencial
            </Text>
          </View>
          <Text
            style={
              isConfirmed
                ? styles.statusChip
                : [styles.statusChip, styles.statusChipDraft]
            }
          >
            {isConfirmed ? "DOCUMENTO VALIDADO" : "BORRADOR NO VALIDADO"}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Paciente</Text>
            <Text style={styles.metaValue}>
              {epicrisis.patient.firstName} {epicrisis.patient.lastName}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>ID sintético</Text>
            <Text style={styles.metaValue}>{epicrisis.patient.syntheticId}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Médico autor</Text>
            <Text style={styles.metaValue}>{personLabel(epicrisis.author)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>
              {isConfirmed ? "Validada por" : "Validación"}
            </Text>
            <Text style={styles.metaValue}>
              {isConfirmed
                ? `${personLabel(epicrisis.confirmedBy)} · ${formatDate(
                    epicrisis.confirmedAt ?? epicrisis.createdAt,
                  )}`
                : NO_REGISTERED}
            </Text>
          </View>
        </View>

        {isAddendum && (
          <View style={styles.addendumBox}>
            <Text style={styles.addendumText}>
              ADENDA · Motivo:{" "}
              {epicrisis.addendumReason?.trim() || NO_REGISTERED}
            </Text>
          </View>
        )}

        {/* 1..8 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identificación del paciente</Text>
          <Text style={styles.sectionValue}>{sectionValue(epicrisis, "patientIdentification")}</Text>
        </View>
        {EPICRISIS_PDF_SECTIONS.map(([key, label]) => (
          <View style={styles.section} key={String(key)}>
            <Text style={styles.sectionTitle}>{label}</Text>
            <Text style={styles.sectionValue}>
              {sectionValue(epicrisis, key)}
            </Text>
          </View>
        ))}

        {/* 9 y 10 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profesional responsable</Text>
          <Text style={styles.sectionValue}>{sectionValue(epicrisis, "responsibleProfessional")}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fecha y hora</Text>
          <Text style={styles.sectionValue}>{formatDate(epicrisis.dateTime)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Generado por DoctorIA · {formatDate(new Date())}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
