import { describe, expect, it } from "vitest";
import {
  getAiProgress,
  runWithAiSlot,
} from "../../src/clinical/services/aiQueue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("aiQueue (cola single-slot de IA)", () => {
  it("devuelve el valor de la tarea ejecutada", async () => {
    await expect(runWithAiSlot("n-value", async () => 42)).resolves.toBe(42);
    expect(getAiProgress("n-value")).toBeNull();
  });

  it("expone el progreso QUEUED → RUNNING → null", async () => {
    const d = deferred<void>();
    const p = runWithAiSlot("n-progress", () => d.promise);

    expect(getAiProgress("n-progress")).toMatchObject({
      state: "QUEUED",
      startedAt: null,
    });

    await flush();
    const running = getAiProgress("n-progress");
    expect(running?.state).toBe("RUNNING");
    expect(typeof running?.startedAt).toBe("number");

    d.resolve();
    await p;
    expect(getAiProgress("n-progress")).toBeNull();
  });

  it("ejecuta en FIFO: la segunda tarea empieza solo cuando la primera termina", async () => {
    const order: string[] = [];
    const d1 = deferred<string>();

    const p1 = runWithAiSlot("n-fifo-1", async () => {
      order.push("start-1");
      const value = await d1.promise;
      order.push("end-1");
      return value;
    });
    const p2 = runWithAiSlot("n-fifo-2", async () => {
      order.push("start-2");
      return "ok-2";
    });

    await flush();
    expect(order).toEqual(["start-1"]);

    d1.resolve("done-1");
    await expect(p1).resolves.toBe("done-1");
    await expect(p2).resolves.toBe("ok-2");
    expect(order).toEqual(["start-1", "end-1", "start-2"]);
  });

  it("posición: la solicitud en cola se desplaza al frente al liberarse el slot", async () => {
    const d1 = deferred<void>();
    const d2 = deferred<void>();

    const p1 = runWithAiSlot("n-pos-1", () => d1.promise);
    const p2 = runWithAiSlot("n-pos-2", () => d2.promise);

    await flush();
    expect(getAiProgress("n-pos-1")).toMatchObject({ state: "RUNNING" });
    expect(getAiProgress("n-pos-2")).toMatchObject({
      state: "QUEUED",
      position: 1,
    });

    d1.resolve();
    await p1;
    await flush();
    expect(getAiProgress("n-pos-2")).toMatchObject({
      state: "RUNNING",
      position: 0,
    });

    d2.resolve();
    await p2;
    expect(getAiProgress("n-pos-2")).toBeNull();
  });

  it("una tarea que falla no bloquea la cola", async () => {
    const p1 = runWithAiSlot("n-fail", async () => {
      throw new Error("boom");
    });
    const p2 = runWithAiSlot("n-after-fail", async () => "ok");

    await expect(p1).rejects.toThrow("boom");
    await expect(p2).resolves.toBe("ok");
    expect(getAiProgress("n-fail")).toBeNull();
    expect(getAiProgress("n-after-fail")).toBeNull();
  });
});
