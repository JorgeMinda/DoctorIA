-- Exclusión mutua de roles a nivel BD (Constitución P3 / RBAC estricto).
-- Complementa los guards de src/clinical/services/guards.ts como defensa
-- en profundidad: impide que un usuario tenga más de un rol activo.
-- Seguro de re-ejecutar: solo se crea si no existe la restricción.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'User'
      AND n.nspname = 'public'
      AND c.conname = 'User_role_exclusivity'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_role_exclusivity"
      CHECK (
        NOT ("is_admin" AND "is_medico")
        AND NOT ("is_admin" AND "is_secretaria")
        AND NOT ("is_medico" AND "is_secretaria")
      );
  END IF;
END
$$;
