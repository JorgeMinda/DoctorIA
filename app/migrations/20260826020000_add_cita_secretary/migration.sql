-- Alters table "Cita" to add secretaryId (trazabilidad de quién agendó la cita).
ALTER TABLE "Cita" ADD COLUMN "secretaryId" TEXT;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
