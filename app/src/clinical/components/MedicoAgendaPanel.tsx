import { useState } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import {
  adminGetPatients,
  getAgenda,
  manageCita,
  updateCitaStatus,
} from "wasp/client/operations";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  Pencil,
  PhoneMissed,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";
import { citaStatusLabel } from "../services/statusLabels";
import { toast } from "../../client/hooks/use-toast";

function citaBadgeVariant(status: string) {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "warning";
  if (status === "CANCELLED") return "destructive";
  return "outline";
}

function CitaBadge({ status }: { status: string }) {
  return (
    <Badge variant={citaBadgeVariant(status) as any} className="mono-label">
      {citaStatusLabel(status)}
    </Badge>
  );
}

function metric(value: number | string, label: string) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function NewCitaForm({
  medicoId,
  onDone,
}: {
  medicoId: string;
  onDone: () => void;
}) {
  const manageCitaFn = useAction(manageCita);
  const { data: patientsData } = useQuery(adminGetPatients, {
    page: 1,
    pageSize: 100,
    medicoId,
  });
  const [patientId, setPatientId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!patientId || !scheduledAt) return;
    setBusy(true);
    try {
      await manageCitaFn({
        action: "CREATE",
        data: {
          medicoId,
          patientId,
          scheduledAt: new Date(scheduledAt),
          durationMinutes: Number(durationMinutes) || 30,
          reason: reason || undefined,
        },
      });
      toast({ title: "Cita creada" });
      setPatientId("");
      setScheduledAt("");
      setReason("");
      onDone();
    } catch (err: any) {
      toast({
        title: "No se pudo crear la cita",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <p className="mono-label mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Nueva cita
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          <option value="">Seleccione un paciente asignado…</option>
          {patientsData?.patients.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.syntheticId} · {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
        <Input
          className="border-outline-variant bg-surface"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          type="number"
          min={5}
          max={240}
          placeholder="Duración (min)"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Motivo de la cita (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="mt-3">
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={busy || !patientId || !scheduledAt}
        >
          <Plus className="size-3.5" />
          Crear cita
        </Button>
      </div>
    </div>
  );
}

function EditCitaForm({ cita, onCancel }: { cita: any; onCancel: () => void }) {
  const manageCitaFn = useAction(manageCita);
  const [scheduledAt, setScheduledAt] = useState(
    new Date(cita.scheduledAt).toISOString().slice(0, 16),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(cita.durationMinutes),
  );
  const [reason, setReason] = useState(cita.reason ?? "");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await manageCitaFn({
        action: "UPDATE",
        citaId: cita.id,
        data: {
          scheduledAt: new Date(scheduledAt),
          durationMinutes: Number(durationMinutes) || 30,
          reason: reason || null,
        },
      });
      toast({ title: "Cita actualizada" });
      onCancel();
    } catch (err: any) {
      toast({
        title: "No se pudo actualizar la cita",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          className="border-outline-variant bg-surface"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          type="number"
          min={5}
          max={240}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface sm:col-span-2"
          placeholder="Motivo de la cita (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={busy || !scheduledAt}>
          Guardar cambios
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function MedicoAgendaPanel({ medicoId }: { medicoId: string }) {
  const { data: agenda, isLoading } = useQuery(getAgenda, { medicoId });
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const manageCitaFn = useAction(manageCita);
  const updateStatusFn = useAction(updateCitaStatus);

  const runTransition = async (
    citaId: string,
    status: string,
    label: string,
  ) => {
    setBusyId(citaId);
    try {
      await updateStatusFn({ citaId, status });
      toast({ title: label });
    } catch (err: any) {
      toast({
        title: "No se pudo actualizar la cita",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cita: any) => {
    setBusyId(cita.id);
    try {
      await manageCitaFn({ action: "DELETE", citaId: cita.id });
      toast({ title: "Cita eliminada" });
    } catch (err: any) {
      toast({
        title: "No se pudo eliminar la cita",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4 text-sm text-muted-foreground">
        Cargando agenda…
      </div>
    );
  }

  const agora = agenda!;
  const sorted = [...agora.citas].sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40">
      <div className="space-y-3 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              agora.currentStatus === "EN_CITA"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-success/40 bg-success/10 text-success"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                agora.currentStatus === "EN_CITA" ? "bg-warning" : "bg-success"
              }`}
            />
            {agora.currentStatus === "EN_CITA" ? "En cita" : "Desocupado"}
          </div>
          <Button size="sm" onClick={() => setShowNew((s) => !s)}>
            <Plus className="size-3.5" />
            Nueva cita
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metric(agora.metrics.pacientesAtendidos, "Pacientes atendidos")}
          {metric(agora.metrics.atencionesHoy, "Atenciones hoy")}
          {metric(agora.metrics.citasHoy, "Citas hoy")}
          {metric(agora.metrics.citasCompletadasHoy, "Completadas hoy")}
        </div>
      </div>

      {showNew && (
        <NewCitaForm medicoId={medicoId} onDone={() => setShowNew(false)} />
      )}

      {sorted.length === 0 && (
        <div className="px-6 pb-4 text-sm text-muted-foreground">
          Sin citas en el período.
        </div>
      )}
      {sorted.length > 0 && (
        <div className="divide-y divide-outline-variant/30 border-t border-outline-variant/40">
          {sorted.map((cita) => (
            <div key={cita.id}>
              <div className="flex flex-wrap items-center gap-4 px-6 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <CalendarDays className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {cita.patient.firstName} {cita.patient.lastName}
                    </span>
                    <Badge variant="outline" className="mono-label">
                      {cita.patient.syntheticId}
                    </Badge>
                    <CitaBadge status={cita.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {new Date(cita.scheduledAt).toLocaleString()}
                    </span>
                    <span>· {cita.durationMinutes} min</span>
                    {cita.reason && <span>· {cita.reason}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {cita.status === "SCHEDULED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === cita.id}
                        onClick={() =>
                          runTransition(cita.id, "IN_PROGRESS", "Cita iniciada")
                        }
                      >
                        <Activity className="size-3.5" />
                        Iniciar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === cita.id}
                        onClick={() =>
                          runTransition(
                            cita.id,
                            "NO_SHOW",
                            "No asistió registrado",
                          )
                        }
                      >
                        <PhoneMissed className="size-3.5" />
                        No asistió
                      </Button>
                    </>
                  )}
                  {cita.status === "IN_PROGRESS" && (
                    <Button
                      size="sm"
                      disabled={busyId === cita.id}
                      onClick={() =>
                        runTransition(cita.id, "COMPLETED", "Cita completada")
                      }
                    >
                      <CheckCircle2 className="size-3.5" />
                      Completar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === cita.id}
                    onClick={() =>
                      setEditingId(editingId === cita.id ? null : cita.id)
                    }
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  {cita.status !== "COMPLETED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={busyId === cita.id}
                      onClick={() => handleDelete(cita)}
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
                    </Button>
                  )}
                  {(cita.status === "SCHEDULED" ||
                    cita.status === "IN_PROGRESS") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === cita.id}
                      onClick={() =>
                        runTransition(cita.id, "CANCELLED", "Cita cancelada")
                      }
                    >
                      <XCircle className="size-3.5" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
              {editingId === cita.id && (
                <EditCitaForm cita={cita} onCancel={() => setEditingId(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
