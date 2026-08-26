-- Exclusión mutua de roles a nivel BD (Constitución P3 / RBAC estricto).
-- Complementa los guards de src/clinical/services/guards.ts como defensa
-- en profundidad: impide que un usuario tenga más de un rol activo.
-- Idempotente: solo crea el constraint si no existe.
-- NOTA: las columnas en la BD son camelCase (isAdmin/isMedico/isSecretaria).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_role_exclusivity'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_role_exclusivity"
      CHECK (
        NOT ("isAdmin" AND "isMedico")
        AND NOT ("isAdmin" AND "isSecretaria")
        AND NOT ("isMedico" AND "isSecretaria")
      );
  END IF;
END
$$;

-- Aplicado y verificado en produccion (2026-08-26): constraint User_role_exclusivity activo.
