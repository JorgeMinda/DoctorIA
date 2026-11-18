import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPublicSpecialistsDirectory,
  parseAllowedDirectoryEmails,
  clearDirectoryCache,
  type PublicSpecialistDto,
} from "../../src/patient/queries";
import { DEFAULT_CLINICAL_FACILITY, PUBLIC_DIRECTORY_LIMIT } from "../../src/patient/constants";

describe("Directorio Público de Especialistas (F1)", () => {
  const originalEnv = process.env.PUBLIC_DIRECTORY_EMAILS;

  beforeEach(() => {
    clearDirectoryCache();
    delete process.env.PUBLIC_DIRECTORY_EMAILS;
    vi.restoreAllMocks();
  });

  describe("parseAllowedDirectoryEmails", () => {
    it("devuelve arreglo vacío para valores nulos, indefinidos o vacíos", () => {
      expect(parseAllowedDirectoryEmails(undefined)).toEqual([]);
      expect(parseAllowedDirectoryEmails(null)).toEqual([]);
      expect(parseAllowedDirectoryEmails("")).toEqual([]);
      expect(parseAllowedDirectoryEmails("   ")).toEqual([]);
    });

    it("parsea, recorta espacios y normaliza a minúsculas correctamente", () => {
      const input = " Dr.Perez@Hospital.Org ,  DRA.GOMEZ@CLINICA.EC,  dr.vega@test.com  ";
      expect(parseAllowedDirectoryEmails(input)).toEqual([
        "dr.perez@hospital.org",
        "dra.gomez@clinica.ec",
        "dr.vega@test.com",
      ]);
    });
  });

  describe("getPublicSpecialistsDirectory", () => {
    it("devuelve arreglo vacío si PUBLIC_DIRECTORY_EMAILS está ausente o vacío (sin llamar a la BD)", async () => {
      const findManyMock = vi.fn();
      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      const result = await getPublicSpecialistsDirectory({}, context);
      expect(result).toEqual([]);
      expect(findManyMock).not.toHaveBeenCalled();
    });

    it("devuelve exactamente las claves permitidas del DTO y ninguna clave privada", async () => {
      process.env.PUBLIC_DIRECTORY_EMAILS = "dra.mendez@hospital.org, dr.vega@hospital.org";

      const mockDbUsers = [
        {
          id: "uuid-1234-privado",
          fullName: "Dra. Laura Méndez",
          specialty: "Medicina Interna",
          email: "dra.mendez@hospital.org",
          isAdmin: false,
          isMedico: true,
          password: "hash-secreto-que-no-debe-salir",
        },
        {
          id: "uuid-5678-privado",
          fullName: "Dr. Carlos Vega",
          specialty: "Cardiología",
          email: "dr.vega@hospital.org",
          isAdmin: false,
          isMedico: true,
        },
      ];

      const findManyMock = vi.fn().mockResolvedValue(mockDbUsers);
      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      const result: PublicSpecialistDto[] = await getPublicSpecialistsDirectory({}, context);

      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(findManyMock).toHaveBeenCalledWith({
        where: {
          isMedico: true,
          isAdmin: false,
          isSecretaria: false,
          isPaciente: false,
          isActive: true,
          fullName: { not: null },
          specialty: { not: null },
          OR: [
            { email: { equals: "dra.mendez@hospital.org", mode: "insensitive" } },
            { email: { equals: "dr.vega@hospital.org", mode: "insensitive" } },
          ],
        },
        select: {
          fullName: true,
          specialty: true,
        },
        orderBy: [
          { fullName: "asc" },
          { id: "asc" },
        ],
        take: PUBLIC_DIRECTORY_LIMIT,
      });
      expect(result).toHaveLength(2);

      // Verificación estricta de forma de DTO (White-box schema verification)
      for (const item of result) {
        const keys = Object.keys(item).sort();
        expect(keys).toEqual(["generalHours", "location", "fullName", "specialty"].sort());

        // Asegurar que valores sensibles NUNCA existan
        expect((item as any).id).toBeUndefined();
        expect((item as any).email).toBeUndefined();
        expect((item as any).password).toBeUndefined();
        expect((item as any).isAdmin).toBeUndefined();
        expect((item as any).isMedico).toBeUndefined();
        expect((item as any).publicIndex).toBeUndefined(); // Se eliminó según requerimiento

        expect(item.location).toBe(DEFAULT_CLINICAL_FACILITY.location);
        expect(item.generalHours).toBe(DEFAULT_CLINICAL_FACILITY.generalHours);
      }

      expect(result[0].fullName).toBe("Dra. Laura Méndez");
      expect(result[0].specialty).toBe("Medicina Interna");
    });

    it("excluye filas con fullName o specialty nulos, vacíos o solo espacios", async () => {
      process.env.PUBLIC_DIRECTORY_EMAILS = "valido@hospital.org, sin_nombre@hospital.org, sin_esp@hospital.org";

      const mockDbUsers = [
        {
          fullName: "Dr. Válido",
          specialty: "Pediatría",
        },
        {
          fullName: null,
          specialty: "Neurología",
        },
        {
          fullName: "Dr. Sin Especialidad",
          specialty: "   ",
        },
      ];

      const findManyMock = vi.fn().mockResolvedValue(mockDbUsers);
      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      const result = await getPublicSpecialistsDirectory({}, context);

      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe("Dr. Válido");
      expect(result[0].specialty).toBe("Pediatría");
    });

    it("reutiliza el caché en memoria para llamadas sucesivas dentro del TTL", async () => {
      process.env.PUBLIC_DIRECTORY_EMAILS = "dra.mendez@hospital.org";

      const mockDbUsers = [
        {
          fullName: "Dra. Laura Méndez",
          specialty: "Medicina Interna",
        },
      ];

      const findManyMock = vi.fn().mockResolvedValue(mockDbUsers);
      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      // Primera llamada: consulta BD
      const res1 = await getPublicSpecialistsDirectory({}, context);
      expect(res1).toHaveLength(1);
      expect(findManyMock).toHaveBeenCalledTimes(1);

      // Segunda llamada inmediata: debe responder desde caché
      const res2 = await getPublicSpecialistsDirectory({}, context);
      expect(res2).toEqual(res1);
      expect(findManyMock).toHaveBeenCalledTimes(1); // No incrementa

      // Si se limpia el caché, vuelve a consultar la BD
      clearDirectoryCache();
      const res3 = await getPublicSpecialistsDirectory({}, context);
      expect(res3).toEqual(res1);
      expect(findManyMock).toHaveBeenCalledTimes(2);
    });

    it("filtra con precisión estricta: correo con guion bajo, mayúsculas distintas y exclusión de admin/paciente/inactivo", async () => {
      // Allowlist con mayúsculas y guiones bajos
      process.env.PUBLIC_DIRECTORY_EMAILS = "DR_VEGA@HOSPITAL.ORG, dra_mendez@clinica.ec";

      const findManyMock = vi.fn().mockImplementation(async ({ where }) => {
        // Simulación fiel de la evaluación del WHERE de PostgreSQL
        const mockDatabaseRecords = [
          // 1. Médico permitido con guión bajo y correo coincidente
          {
            id: "doc-1",
            fullName: "Dr. Carlos Vega",
            specialty: "Cardiología",
            email: "dr_vega@hospital.org",
            isMedico: true,
            isAdmin: false,
            isSecretaria: false,
            isPaciente: false,
            isActive: true,
          },
          // 2. Médico permitido con mayúsculas en BD
          {
            id: "doc-2",
            fullName: "Dra. Laura Méndez",
            specialty: "Medicina Interna",
            email: "DRA_MENDEZ@CLINICA.EC",
            isMedico: true,
            isAdmin: false,
            isSecretaria: false,
            isPaciente: false,
            isActive: true,
          },
          // 3. Médico no permitido (correo fuera de allowlist)
          {
            id: "doc-3",
            fullName: "Dr. No Permitido",
            specialty: "Pediatría",
            email: "ajeno@hospital.org",
            isMedico: true,
            isAdmin: false,
            isSecretaria: false,
            isPaciente: false,
            isActive: true,
          },
          // 4. Admin con correo permitido (debe ser excluido por isAdmin: false)
          {
            id: "admin-1",
            fullName: "Admin con Correo",
            specialty: "Administración",
            email: "dr_vega@hospital.org",
            isMedico: false,
            isAdmin: true,
            isSecretaria: false,
            isPaciente: false,
            isActive: true,
          },
          // 5. Paciente con correo permitido (debe ser excluido por isPaciente: false)
          {
            id: "paciente-1",
            fullName: "Paciente con Correo",
            specialty: "Ninguna",
            email: "dra_mendez@clinica.ec",
            isMedico: false,
            isAdmin: false,
            isSecretaria: false,
            isPaciente: true,
            isActive: true,
          },
          // 6. Médico inactivo (debe ser excluido por isActive: true)
          {
            id: "doc-inactivo",
            fullName: "Dr. Retirado",
            specialty: "Traumatología",
            email: "dr_vega@hospital.org",
            isMedico: true,
            isAdmin: false,
            isSecretaria: false,
            isPaciente: false,
            isActive: false,
          },
          // 7. Médico con fullName nulo
          {
            id: "doc-noname",
            fullName: null,
            specialty: "Dermatología",
            email: "dr_vega@hospital.org",
            isMedico: true,
            isAdmin: false,
            isSecretaria: false,
            isPaciente: false,
            isActive: true,
          },
        ];

        // Filtrar según el where exacto generado por la query
        return mockDatabaseRecords.filter((record) => {
          if (where.isMedico !== record.isMedico) return false;
          if (where.isAdmin !== record.isAdmin) return false;
          if (where.isSecretaria !== record.isSecretaria) return false;
          if (where.isPaciente !== record.isPaciente) return false;
          if (where.isActive !== record.isActive) return false;
          if (where.fullName?.not !== undefined && record.fullName === null) return false;
          if (where.specialty?.not !== undefined && record.specialty === null) return false;

          const emailMatches = where.OR?.some((orClause: any) => {
            const expected = orClause.email.equals.toLowerCase();
            return record.email.toLowerCase() === expected;
          });
          return emailMatches;
        });
      });

      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      const result = await getPublicSpecialistsDirectory({}, context);

      // Verificación de argumentos exactos pasados a findMany
      expect(findManyMock).toHaveBeenCalledWith({
        where: {
          isMedico: true,
          isAdmin: false,
          isSecretaria: false,
          isPaciente: false,
          isActive: true,
          fullName: { not: null },
          specialty: { not: null },
          OR: [
            { email: { equals: "dr_vega@hospital.org", mode: "insensitive" } },
            { email: { equals: "dra_mendez@clinica.ec", mode: "insensitive" } },
          ],
        },
        select: {
          fullName: true,
          specialty: true,
        },
        orderBy: [
          { fullName: "asc" },
          { id: "asc" },
        ],
        take: PUBLIC_DIRECTORY_LIMIT,
      });

      // Solo los dos médicos activos y válidos deben ser retornados
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.fullName)).toEqual([
        "Dr. Carlos Vega",
        "Dra. Laura Méndez",
      ]);
    });
  });
});
