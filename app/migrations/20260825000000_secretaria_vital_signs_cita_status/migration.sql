-- AlterTable: rol Secretaria + soft delete de usuarios (R4)
ALTER TABLE "User" ADD COLUMN "isSecretaria" BOOLEAN NOT NULL DEFAULT false,
                  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: soft delete de pacientes con historial (R4)
ALTER TABLE "SyntheticPatient" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum: estados de cita + NOT_STARTED
CREATE TYPE "CitaStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'NOT_STARTED');
ALTER TABLE "Cita" ALTER COLUMN "status" DROP DEFAULT,
                  ALTER COLUMN "status" USING "status"::text::"CitaStatus",
                  ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"CitaStatus";

-- CreateTable
CREATE TABLE "VitalSign" (
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
CREATE INDEX "VitalSign_patientId_createdAt_idx" ON "VitalSign"("patientId", "createdAt");

-- AddForeignKey
ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
