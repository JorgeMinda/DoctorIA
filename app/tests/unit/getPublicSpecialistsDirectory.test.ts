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
  });
});
