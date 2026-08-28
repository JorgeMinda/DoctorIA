import { useEffect, useState } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getDoctorsAgenda,
  getAvailableSlots,
  manageCita,
} from "wasp/client/operations";
import { toast } from "../../client/hooks/use-toast";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../client/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "../../client/components/ui/dialog";
import { Badge } from "../../client/components/ui/badge";
import { Clock, Edit3, UserCheck } from "lucide-react";

export function EditAppointmentModal({
  open,
  onOpenChange,
  cita,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cita: any | null;
  onDone?: () => void;
}) {
  const [medicoId, setMedicoId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const DURATION_MINUTES = 30;

  const { data: medicosData, isLoading: loadingMedicos } = useQuery(
    getDoctorsAgenda,
    {},
    { enabled: open && Boolean(cita) },
  );

  const { data: slots, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    medicoId && date
      ? { medicoId, date, durationMinutes: DURATION_MINUTES }
      : undefined,
  );

  const manageCitaFn = useAction(manageCita);

  useEffect(() => {
    if (open && cita) {
      setMedicoId(cita.medicoId ?? cita.medico?.id ?? "");
      const d = new Date(cita.scheduledAt);
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = d.toTimeString().slice(0, 5);
      setDate(dateStr);
      setTime(timeStr);
      setReason(cita.reason ?? "");
      setBusy(false);
    }
  }, [open, cita]);

  const allMedicos = medicosData?.medicos ?? [];
  const freeSlots: string[] = slots?.freeSlots ?? [];

  // Incluir el horario actual de la cita si coincide con la fecha y médico seleccionados
  const displaySlots = [...freeSlots];
  if (
    cita &&
    time &&
    !displaySlots.includes(time) &&
    medicoId === (cita.medicoId ?? cita.medico?.id) &&
    date === new Date(cita.scheduledAt).toISOString().slice(0, 10)
  ) {
    displaySlots.push(time);
    displaySlots.sort();
  }

  const handleUpdate = async () => {
    if (!cita?.id) return;
    if (!medicoId || !date || !time) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete médico, fecha y hora.",
        variant: "destructive",
      });
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (scheduledAt.getTime() <= Date.now()) {
      toast({
        title: "Fecha inválida",
        description: "La cita no puede reprogramarse en el pasado.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      await manageCitaFn({
        action: "UPDATE",
        citaId: cita.id,
        data: {
          medicoId,
          scheduledAt,
          durationMinutes: DURATION_MINUTES,
          reason: reason.trim() || undefined,
        },
      });

      toast({ title: "Cita actualizada correctamente" });
      onOpenChange(false);
      onDone?.();
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

  if (!cita) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="mono-label gap-1.5 border-primary/40 text-primary">
              <Edit3 className="size-3.5" />
              Editar / Reprogramar cita
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Paciente (Inmutable para mantener coherencia de historial) */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground">Paciente</Label>
            <div className="flex items-center justify-between rounded-lg border border-outline-variant/60 bg-surface/50 p-3 text-sm">
              <span className="font-semibold text-foreground">
                {cita.patient?.firstName} {cita.patient?.lastName}
              </span>
              <Badge variant="outline" className="mono-label text-xs">
                {cita.patient?.syntheticId}
              </Badge>
            </div>
          </div>

          {/* Profesional Médico */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Médico asignado</Label>
            <Select
              value={medicoId || undefined}
              onValueChange={(val) => {
                setMedicoId(val);
                setTime("");
              }}
              disabled={loadingMedicos}
            >
              <SelectTrigger className="border-outline-variant bg-surface/70 backdrop-blur-sm">
                <SelectValue placeholder="Seleccione profesional médico" />
              </SelectTrigger>
              <SelectContent>
                {allMedicos.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-primary" />
                      <span>{m.fullName || m.email}</span>
                      {m.specialty ? (
                        <span className="text-xs text-muted-foreground">
                          · {m.specialty}
                        </span>
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-date">Fecha de la cita</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime("");
              }}
              className="border-outline-variant bg-surface/70 font-mono backdrop-blur-sm"
            />
          </div>

          {/* Horarios Disponibles */}
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center justify-between">
              <span>Horarios disponibles</span>
              {date && medicoId && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {loadingSlots
                    ? "Consultando disponibilidad…"
                    : `${displaySlots.length} horarios`}
                </span>
              )}
            </Label>

            {!medicoId || !date ? (
              <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface/30 p-3 text-center text-xs text-muted-foreground">
                Seleccione profesional y fecha para ver los turnos libres.
              </div>
            ) : loadingSlots ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface/30 p-4 text-xs text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                Verificando disponibilidad de horarios…
              </div>
            ) : displaySlots.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-xs text-destructive">
                No hay horarios libres ese día para este médico.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 max-h-36 overflow-y-auto p-1">
                {displaySlots.map((s) => {
                  const isSelected = time === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-mono font-medium transition-all ${
                        isSelected
                          ? "border-primary bg-primary/25 text-primary shadow-[0_0_12px_rgba(0,218,243,0.35)] scale-[1.02]"
                          : "border-outline-variant/60 bg-surface/50 text-foreground hover:bg-surface-high hover:border-outline backdrop-blur-sm"
                      }`}
                    >
                      <Clock className="size-3 opacity-70" />
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Motivo de la cita */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-reason">Motivo de la cita (opcional)</Label>
            <Input
              id="edit-reason"
              placeholder="Ej: Reprogramación por solicitud del paciente…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-outline-variant bg-surface/70 backdrop-blur-sm"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={handleUpdate}
            disabled={busy || !medicoId || !date || !time}
          >
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
