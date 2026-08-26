-- CreateTable
CREATE TABLE "PreClinicalRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "citaId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "motivoConsulta" TEXT NOT NULL,
    "systolicBP" INTEGER NOT NULL,
    "diastolicBP" INTEGER NOT NULL,
    "heartRate" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "respiratoryRate" INTEGER NOT NULL,
    "oxygenSaturation" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PreClinicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreClinicalRecord_citaId_key" ON "PreClinicalRecord"("citaId");

-- CreateIndex
CREATE INDEX "PreClinicalRecord_patientId_createdAt_idx" ON "PreClinicalRecord"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PreClinicalRecord_recordedById_idx" ON "PreClinicalRecord"("recordedById");

-- AddForeignKey
ALTER TABLE "PreClinicalRecord" ADD CONSTRAINT "PreClinicalRecord_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreClinicalRecord" ADD CONSTRAINT "PreClinicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "SyntheticPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreClinicalRecord" ADD CONSTRAINT "PreClinicalRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
