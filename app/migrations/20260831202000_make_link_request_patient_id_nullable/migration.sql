-- Permitir patientId nulo y columna requestedDocument en PatientLinkRequest
ALTER TABLE "PatientLinkRequest" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "PatientLinkRequest" ADD COLUMN IF NOT EXISTS "requestedDocument" TEXT;
