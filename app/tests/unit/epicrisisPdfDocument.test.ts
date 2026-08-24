// Test unitario: EpicrisisPDFDocument renderiza sin lanzar excepciones
// con datos mock válidos (CONFIRMED y BORRADOR), produciendo un PDF válido.
// Se usa React.createElement (no JSX) porque la suite corre en node (.ts).

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import {
  EpicrisisPDFDocument,
  type EpicrisisPDFData,
} from "../../src/clinical/components/EpicrisisPDFDocument";

const baseEpicrisis: EpicrisisPDFData = {
  id: "epi-1",
  status: "DRAFT_AI_ASSISTED",
  noteType: "ORIGINAL",
  aiAssisted: true,
  addendumReason: null,
  patientIdentification: "Paciente ambulatorio, 45 años",
  reasonForAdmission: "Dolor torácico atípico",
  relevantHistory: "Hipertensión arterial",
  evolutionSummary: "Evolución favorable",
  proceduresResults: "ECG sin alteraciones agudas",
  validatedDiagnoses: "Dolor torácico no cardiogénico",
  conditionAtDischarge: "Estable",
  followUpInstructions: "Control en 7 días",
  responsibleProfessional: "Dra. Laura Méndez",
  dateTime: new Date("2026-08-20T10:30:00Z"),
  confirmedAt: null,
  createdAt: new Date("2026-08-20T09:00:00Z"),
  author: {
    fullName: "Dra. Laura Méndez",
    username: "lmendez",
    email: "medico1@doctoria.com",
  },
  confirmedBy: null,
  patient: {
    syntheticId: "PAC-001",
    firstName: "Ana",
    lastName: "Paredes",
  },
};

function expectValidPdf(buffer: Buffer | Uint8Array): void {
  const header = Buffer.from(buffer.slice(0, 5)).toString("utf8");
  expect(header).toBe("%PDF-");
  expect(buffer.length).toBeGreaterThan(500);
}

describe("EpicrisisPDFDocument", () => {
  it("renderiza una epicrisis en borrador sin lanzar excepciones", async () => {
    const element = React.createElement(EpicrisisPDFDocument, {
      epicrisis: baseEpicrisis,
    });
    const buffer = await renderToBuffer(element as any);
    expectValidPdf(buffer);
  });

  it("renderiza una epicrisis confirmada sin lanzar excepciones", async () => {
    const confirmed: EpicrisisPDFData = {
      ...baseEpicrisis,
      status: "CONFIRMED",
      confirmedAt: new Date("2026-08-21T12:00:00Z"),
      confirmedBy: {
        fullName: "Dra. Laura Méndez",
        username: "lmendez",
        email: "medico1@doctoria.com",
      },
    };
    const element = React.createElement(EpicrisisPDFDocument, {
      epicrisis: confirmed,
    });
    const buffer = await renderToBuffer(element as any);
    expectValidPdf(buffer);
  });

  it("renderiza una adenda con campos nulos sin lanzar excepciones", async () => {
    const addendum: EpicrisisPDFData = {
      ...baseEpicrisis,
      noteType: "ADDENDUM",
      addendumReason: "Se adjuntan resultados de laboratorio",
      reasonForAdmission: null,
      relevantHistory: null,
      evolutionSummary: null,
      proceduresResults: null,
      validatedDiagnoses: null,
      conditionAtDischarge: null,
      followUpInstructions: null,
    };
    const element = React.createElement(EpicrisisPDFDocument, {
      epicrisis: addendum,
    });
    const buffer = await renderToBuffer(element as any);
    expectValidPdf(buffer);
  });
});
