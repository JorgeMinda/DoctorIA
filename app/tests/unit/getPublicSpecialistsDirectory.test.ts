import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPublicSpecialistsDirectory,
  parseAllowedDirectoryEmails,
  clearDirectoryCache,
  type PublicSpecialistDto,
} from "../../src/patient/queries";
import { DEFAULT_CLINICAL_FACILITY, PUBLIC_DIRECTORY_LIMIT } from "../../src/patient/constants";

describe("Directorio Público de Especialistas (F1)", () => {
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

    it("parsea, recorta espacios, normaliza a minúsculas y deduplica correos correctamente", () => {
      const input = " Dr.Perez@Hospital.Org ,  DRA.GOMEZ@CLINICA.EC,  dr.perez@hospital.org  ,  dr.vega@test.com  ";
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
        },
        select: {
          id: true,
          fullName: true,
          specialty: true,
          email: true,
        },
        orderBy: [
          { fullName: "asc" },
          { id: "asc" },
        ],
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
        expect((item as any).publicIndex).toBeUndefined();

        expect(item.location).toBe(DEFAULT_CLINICAL_FACILITY.location);
        expect(item.generalHours).toBe(DEFAULT_CLINICAL_FACILITY.generalHours);
      }

      expect(result[0].fullName).toBe("Dra. Laura Méndez");
      expect(result[0].specialty).toBe("Medicina Interna");
    });

    it("prueba negativa: 'dr_vega@...' en la allowlist NO hace match con 'drxvega@...'", async () => {
      // Allowlist contiene explícitamente un correo con guion bajo
      process.env.PUBLIC_DIRECTORY_EMAILS = "dr_vega@hospital.org";

      const mockDbUsers = [
        // Médico legítimo coincidente
        {
          id: "doc-real",
          fullName: "Dr. Carlos Vega",
          specialty: "Cardiología",
          email: "dr_vega@hospital.org",
        },
        // Médico atacante o espurio que coincidiría si fuera un ILIKE sin escapar
        {
          id: "doc-spurious",
          fullName: "Dr. Trampa Sin Guion",
          specialty: "Cardiología Trampa",
          email: "drxvega@hospital.org",
        },
      ];

      const findManyMock = vi.fn().mockResolvedValue(mockDbUsers);
      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      const result = await getPublicSpecialistsDirectory({}, context);

      // Solo debe haber retornado al Dr. Carlos Vega; drxvega debe ser descartado
      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe("Dr. Carlos Vega");
      expect(result.some((r: any) => r.fullName === "Dr. Trampa Sin Guion")).toBe(false);
    });

    it("excluye filas con fullName o specialty nulos, vacíos o solo espacios", async () => {
      process.env.PUBLIC_DIRECTORY_EMAILS = "valido@hospital.org, sin_nombre@hospital.org, sin_esp@hospital.org";

      const mockDbUsers = [
        {
          fullName: "Dr. Válido",
          specialty: "Pediatría",
          email: "valido@hospital.org",
        },
        {
          fullName: null,
          specialty: "Neurología",
          email: "sin_nombre@hospital.org",
        },
        {
          fullName: "Dr. Sin Especialidad",
          specialty: "   ",
          email: "sin_esp@hospital.org",
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
          email: "dra.mendez@hospital.org",
        },
      ];

      const findManyMock = vi.fn().mockResolvedValue(mockDbUsers);
      const context = {
        entities: {
          User: { findMany: findManyMock },
        },
      };

      const res1 = await getPublicSpecialistsDirectory({}, context);
      expect(res1).toHaveLength(1);
      expect(findManyMock).toHaveBeenCalledTimes(1);

      const res2 = await getPublicSpecialistsDirectory({}, context);
      expect(res2).toEqual(res1);
      expect(findManyMock).toHaveBeenCalledTimes(1);

      clearDirectoryCache();
      const res3 = await getPublicSpecialistsDirectory({}, context);
      expect(res3).toEqual(res1);
      expect(findManyMock).toHaveBeenCalledTimes(2);
    });
  });
});
