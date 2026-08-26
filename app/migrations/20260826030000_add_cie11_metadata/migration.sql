-- Agrega metadata CIE-11 (clasificación OMS) a ClinicalNote y Epicrisis.
-- Campos opcionales (nullable): no alteran datos existentes.
-- FASE 2: Schema + Migración del módulo Clinical Classification.

-- ClinicalNote: 3 campos nullable
ALTER TABLE "ClinicalNote" ADD COLUMN "cie11Code" TEXT;
ALTER TABLE "ClinicalNote" ADD COLUMN "cie11Description" TEXT;
ALTER TABLE "ClinicalNote" ADD COLUMN "cie11Uri" TEXT;

-- Epicrisis: 3 campos nullable
ALTER TABLE "Epicrisis" ADD COLUMN "cie11Code" TEXT;
ALTER TABLE "Epicrisis" ADD COLUMN "cie11Description" TEXT;
ALTER TABLE "Epicrisis" ADD COLUMN "cie11Uri" TEXT;
