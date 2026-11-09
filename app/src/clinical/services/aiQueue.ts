// Cola en memoria de un solo slot para las llamadas de IA (free tier de
// OpenRouter: una solicitud a la vez) con progreso visible para el cliente.
// Sin tablas nuevas: el estado vive en el proceso del server y se expone a
// través de getClinicalNote (campo aiProgress).

export type AiProgress = {
  state: "QUEUED" | "RUNNING";
  queuedAt: number;
  startedAt: number | null;
  // Puestos por delante en la cola (0 = siguiente en ejecutar).
  position: number;
};

const states = new Map<string, AiProgress>();
const queue: string[] = [];
let tail: Promise<unknown> = Promise.resolve();

export function getAiProgress(noteId: string): AiProgress | null {
  return states.get(noteId) ?? null;
}

function refreshPositions() {
  for (let i = 0; i < queue.length; i++) {
    const st = states.get(queue[i]);
    if (st && st.state === "QUEUED") st.position = i;
  }
}

export function runWithAiSlot<T>(noteId: string, fn: () => Promise<T>): Promise<T> {
  if (!states.has(noteId)) {
    states.set(noteId, {
      state: "QUEUED",
      queuedAt: Date.now(),
      startedAt: null,
      position: queue.length,
    });
    queue.push(noteId);
  }
  refreshPositions();

  const run = tail.then(async () => {
    const st = states.get(noteId);
    states.set(noteId, {
      state: "RUNNING",
      queuedAt: st?.queuedAt ?? Date.now(),
      startedAt: Date.now(),
      position: 0,
    });
    try {
      return await fn();
    } finally {
      states.delete(noteId);
      const idx = queue.indexOf(noteId);
      if (idx >= 0) queue.splice(idx, 1);
      refreshPositions();
    }
  });

  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}
