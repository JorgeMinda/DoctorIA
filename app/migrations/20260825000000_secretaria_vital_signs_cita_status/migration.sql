-- Migración idempotente (segura de re-ejecutar tras resolve manual):
-- rol Secretaria + soft delete usuarios/pacientes + enum CitaStatus(+NOT_STARTED)
-- + tabla VitalSign. Cada paso verifica su precondición.

-- AlterTable: rol Secretaria + soft delete de usuarios (R4)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSecretaria" BOOLEAN NOT NULL DEFAULT false,
                  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: soft delete de pacientes con historial (R4)
ALTER TABLE "SyntheticPatient" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum CitaStatus solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'CitaStatus' AND n.nspname = 'public' AND t.typtype = 'e'
  ) THEN
    CREATE TYPE "CitaStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOT_STARTED');
  END IF;
END$$;

-- Convertir Cita.status al enum solo si aún es text/otro tipo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Cita'
      AND column_name = 'status' AND udt_name <> 'CitaStatus'
  ) THEN
    ALTER TABLE "Cita" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Cita" ALTER COLUMN "status" TYPE "CitaStatus"
      USING ("status"::text)::"CitaStatus";
    ALTER TABLE "Cita" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"CitaStatus";
  END IF;
END$$;

-- CreateTable VitalSign (idempotente)
CREATE TABLE IF NOT EXISTS "VitalSign" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientId" TEXT NOT NULL,
    "citaId" TEXT,
    "recordedById" TEXT NOT NULL,
    "systolicBP" INTEGER NOT NULL,
    "diastolicBP" INTEGER NOT NULL,
    "heartRate" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "respiratoryRate" INTEGER NOT NULL,
    "oxygenSaturation" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "VitalSign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VitalSign_patientId_createdAt_idx" ON "VitalSign"("patientId", "createdAt");

-- AddForeignKey (idempotentes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VitalSign_patientId_fkey') THEN
    ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VitalSign_citaId_fkey') THEN
    ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_citaId_fkey"
      FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VitalSign_recordedById_fkey') THEN
    ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;
