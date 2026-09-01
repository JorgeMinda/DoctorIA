-- FASE DE PRODUCCIÓN: Vinculación Segura por Documento + HMAC + Aprobación Administrativa

-- 1. Crear Enum DocumentType si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
        CREATE TYPE "DocumentType" AS ENUM ('CEDULA', 'PASAPORTE', 'OTRO');
    END IF;
END $$;

-- 2. Crear Enum LinkRequestStatus si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LinkRequestStatus') THEN
        CREATE TYPE "LinkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
    END IF;
END $$;

-- 3. Modificar SyntheticPatient para campos de identificación real y HMAC
ALTER TABLE "SyntheticPatient" ADD COLUMN IF NOT EXISTS "tipoDocumento" "DocumentType" NOT NULL DEFAULT 'CEDULA';
ALTER TABLE "SyntheticPatient" ADD COLUMN IF NOT EXISTS "documentHash" TEXT;
ALTER TABLE "SyntheticPatient" ADD COLUMN IF NOT EXISTS "paisEmisor" TEXT DEFAULT 'EC';
ALTER TABLE "SyntheticPatient" ALTER COLUMN "documento" TYPE VARCHAR(30);

-- 4. Crear índice único para documentHash
CREATE UNIQUE INDEX IF NOT EXISTS "SyntheticPatient_documentHash_key" ON "SyntheticPatient"("documentHash");
CREATE INDEX IF NOT EXISTS "SyntheticPatient_documentHash_idx" ON "SyntheticPatient"("documentHash");

-- 5. Crear tabla PatientLinkRequest
CREATE TABLE IF NOT EXISTS "PatientLinkRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT,
    "status" "LinkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "documentType" "DocumentType" NOT NULL DEFAULT 'CEDULA',
    "requestedDocument" TEXT,
    "paisEmisor" TEXT DEFAULT 'EC',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientLinkRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PatientLinkRequest" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "PatientLinkRequest" ADD COLUMN IF NOT EXISTS "requestedDocument" TEXT;

-- 6. Crear índices para PatientLinkRequest
CREATE INDEX IF NOT EXISTS "PatientLinkRequest_status_idx" ON "PatientLinkRequest"("status");
CREATE INDEX IF NOT EXISTS "PatientLinkRequest_userId_idx" ON "PatientLinkRequest"("userId");
CREATE INDEX IF NOT EXISTS "PatientLinkRequest_patientId_idx" ON "PatientLinkRequest"("patientId");

-- 7. Agregar Foreign Keys para PatientLinkRequest
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PatientLinkRequest_userId_fkey'
    ) THEN
        ALTER TABLE "PatientLinkRequest" 
        ADD CONSTRAINT "PatientLinkRequest_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PatientLinkRequest_patientId_fkey'
    ) THEN
        ALTER TABLE "PatientLinkRequest" 
        ADD CONSTRAINT "PatientLinkRequest_patientId_fkey" 
        FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PatientLinkRequest_reviewedById_fkey'
    ) THEN
        ALTER TABLE "PatientLinkRequest" 
        ADD CONSTRAINT "PatientLinkRequest_reviewedById_fkey" 
        FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
