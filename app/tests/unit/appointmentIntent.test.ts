import { describe, it, expect, beforeEach } from "vitest";
import {
  saveAppointmentIntent,
  getValidAppointmentIntent,
  clearAppointmentIntent,
  APPOINTMENT_INTENT_STORAGE_KEY,
  APPOINTMENT_INTENT_TTL_MS,
} from "../../src/patient/appointmentIntent";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("Gestor de Intención de Agendamiento (F2)", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = new MemoryStorage();
  });

  it("guarda exitosamente una categoría válida existente en el catálogo", () => {
    const success = saveAppointmentIntent("pediatria", mockStorage);
    expect(success).toBe(true);

    const savedRaw = mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();

    const parsed = JSON.parse(savedRaw!);
    expect(parsed.categoryId).toBe("pediatria");
    expect(parsed.categoryLabel).toBe("Pediatría");
    expect(typeof parsed.timestamp).toBe("number");
  });

  it("rechaza guardar 'all' por no ser una especialidad clínica agendable", () => {
    const success = saveAppointmentIntent("all", mockStorage);
    expect(success).toBe(false);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("rechaza guardar una categoría inexistente o maliciosa", () => {
    const success = saveAppointmentIntent("categoria_falsa_sql_injection", mockStorage);
    expect(success).toBe(false);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("recupera la intención si está dentro del TTL de 15 minutos", () => {
    const now = 1000000;
    saveAppointmentIntent("general", mockStorage);

    // Sobrescribir timestamp controlado
    const item = JSON.parse(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)!);
    item.timestamp = now;
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, JSON.stringify(item));

    // Consultar 5 minutos después (dentro de TTL)
    const retrieved = getValidAppointmentIntent(mockStorage, now + 5 * 60 * 1000);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.categoryId).toBe("general");
    expect(retrieved?.categoryLabel).toBe("Atención General");
  });

  it("descarta y limpia automáticamente la intención si excedió el TTL de 15 minutos", () => {
    const now = 1000000;
    saveAppointmentIntent("urgencias", mockStorage);

    const item = JSON.parse(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)!);
    item.timestamp = now;
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, JSON.stringify(item));

    // Consultar 16 minutos después (fuera de TTL)
    const retrieved = getValidAppointmentIntent(mockStorage, now + APPOINTMENT_INTENT_TTL_MS + 1000);
    expect(retrieved).toBeNull();
    // Debe haber limpiado la clave
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("descarta y limpia datos corruptos o malformados", () => {
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, "{ json_invalido ");
    const retrieved = getValidAppointmentIntent(mockStorage);
    expect(retrieved).toBeNull();
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("clearAppointmentIntent elimina la clave del almacenamiento", () => {
    saveAppointmentIntent("odontologia", mockStorage);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).not.toBeNull();

    clearAppointmentIntent(mockStorage);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });
});
