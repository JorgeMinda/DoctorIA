-- Agrega rol isPaciente a User y vinculo opcional userId a SyntheticPatient.
-- FASE A: Kickoff Registro de Paciente + Portal.

-- 1. Agregar isPaciente a User (con default false)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPaciente" BOOLEAN NOT NULL DEFAULT false;

-- 2. Agregar userId a SyntheticPatient (nullable)
ALTER TABLE "SyntheticPatient" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 3. Crear indice unico para userId en SyntheticPatient
CREATE UNIQUE INDEX IF NOT EXISTS "SyntheticPatient_userId_key" ON "SyntheticPatient"("userId");

-- 4. Agregar Foreign Key de SyntheticPatient a User
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SyntheticPatient_userId_fkey'
    ) THEN
        ALTER TABLE "SyntheticPatient" 
        ADD CONSTRAINT "SyntheticPatient_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
