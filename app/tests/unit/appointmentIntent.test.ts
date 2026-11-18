import { describe, it, expect, beforeEach } from "vitest";
import {
  saveAppointmentIntent,
  peekAppointmentIntent,
  consumeAppointmentIntent,
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

  it("guarda exitosamente una categoría válida existente en PATIENT_ATTENTION_CATEGORIES", () => {
    const success = saveAppointmentIntent("pediatria", mockStorage);
    expect(success).toBe(true);

    const savedRaw = mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();

    const parsed = JSON.parse(savedRaw!);
    expect(parsed.categoryId).toBe("pediatria");
    expect(parsed.categoryLabel).toBe("Pediatría");
    expect(typeof parsed.timestamp).toBe("number");
  });

  it("rechaza guardar 'all' por no ser una categoría clínica agendable", () => {
    const success = saveAppointmentIntent("all", mockStorage);
    expect(success).toBe(false);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("rechaza guardar 'urgencias' porque no admite agendamiento web (protocolo 911)", () => {
    const success = saveAppointmentIntent("urgencias", mockStorage);
    expect(success).toBe(false);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("rechaza guardar categorías inexistentes o texto libre malicioso", () => {
    const success = saveAppointmentIntent("categoria_falsa_sql_injection", mockStorage);
    expect(success).toBe(false);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("peekAppointmentIntent recupera la intención dentro de los 15 min sin eliminarla", () => {
    const now = 1000000;
    saveAppointmentIntent("general", mockStorage);

    const item = JSON.parse(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)!);
    item.timestamp = now;
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, JSON.stringify(item));

    // Consultar 5 minutos después (dentro del TTL)
    const peeked = peekAppointmentIntent(mockStorage, now + 5 * 60 * 1000);
    expect(peeked).not.toBeNull();
    expect(peeked?.categoryId).toBe("general");
    expect(peeked?.categoryLabel).toBe("Atención General");

    // peek NO borra el almacenamiento
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).not.toBeNull();
  });

  it("consumeAppointmentIntent recupera la intención y la borra inmediatamente (single-use)", () => {
    const now = 1000000;
    saveAppointmentIntent("pediatria", mockStorage);

    const item = JSON.parse(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)!);
    item.timestamp = now;
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, JSON.stringify(item));

    // Consumir intención
    const consumed = consumeAppointmentIntent(mockStorage, now + 2 * 60 * 1000);
    expect(consumed).not.toBeNull();
    expect(consumed?.categoryId).toBe("pediatria");

    // Debe haberse eliminado inmediatamente (un solo uso)
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();

    // Siguiente consumo debe dar null
    const secondConsume = consumeAppointmentIntent(mockStorage, now + 2 * 60 * 1000);
    expect(secondConsume).toBeNull();
  });

  it("descarta y limpia automáticamente la intención si excedió el TTL de 15 minutos", () => {
    const now = 1000000;
    saveAppointmentIntent("odontologia", mockStorage);

    const item = JSON.parse(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)!);
    item.timestamp = now;
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, JSON.stringify(item));

    // Consultar 16 minutos después (fuera de TTL)
    const retrieved = peekAppointmentIntent(mockStorage, now + APPOINTMENT_INTENT_TTL_MS + 1000);
    expect(retrieved).toBeNull();
    // Limpieza automática
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("descarta y limpia datos corruptos o con JSON inválido", () => {
    mockStorage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, "{ json_invalido ");
    const retrieved = peekAppointmentIntent(mockStorage);
    expect(retrieved).toBeNull();
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("clearAppointmentIntent elimina la clave del almacenamiento manualmente", () => {
    saveAppointmentIntent("odontologia", mockStorage);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).not.toBeNull();

    clearAppointmentIntent(mockStorage);
    expect(mockStorage.getItem(APPOINTMENT_INTENT_STORAGE_KEY)).toBeNull();
  });
});
