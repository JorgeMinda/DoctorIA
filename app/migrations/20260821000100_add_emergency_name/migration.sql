/*
  Warnings:
  - Added the required column `emergencyName` to the `SyntheticPatient` table without a default value. This is safe because the column is nullable.
*/

-- Add emergencyName (nombre del contacto de emergencia) to SyntheticPatient
ALTER TABLE "SyntheticPatient" ADD COLUMN "emergencyName" TEXT;
