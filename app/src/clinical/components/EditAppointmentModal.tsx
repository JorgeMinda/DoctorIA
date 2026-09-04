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

  const hasSlotParams = Boolean(open && Boolean(cita) && medicoId && date);
  const { data: slots, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    hasSlotParams
      ? { medicoId, date, durationMinutes: DURATION_MINUTES }
      : ({} as any),
    { enabled: hasSlotParams },
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

  const isSlotPast = (slotTime: string) => {
    if (!date) return false;
    const slotDate = new Date(`${date}T${slotTime}:00`);
    return slotDate.getTime() <= Date.now();
  };

  const ALL_DAY_SLOTS = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30",
  ];
  const baseSlots = Array.from(new Set([...ALL_DAY_SLOTS, ...displaySlots])).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
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

          {/* Horarios Disponibles vs Ocupados */}
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Horarios del día</Label>
              {date && medicoId && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {loadingSlots
                    ? "Consultando disponibilidad…"
                    : `${displaySlots.length} horarios libres`}
                </span>
              )}
            </div>

            {!medicoId || !date ? (
              <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface/30 p-3 text-center text-xs text-muted-foreground">
                Seleccione profesional y fecha para ver los turnos disponibles y ocupados.
              </div>
            ) : loadingSlots ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface/30 p-4 text-xs text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                Verificando disponibilidad de horarios…
              </div>
            ) : (
              <div className="space-y-2">
                {/* Leyenda de colores */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono px-1 text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    Disponible
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-400">
                    <span className="size-2 rounded-full bg-rose-400" />
                    Ocupado
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground/60">
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                    Pasado
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 max-h-48 overflow-y-auto p-1.5 border rounded-lg border-outline-variant/40 bg-surface/30">
                  {baseSlots.map((s) => {
                    const isPast = isSlotPast(s);
                    const isBusy = !displaySlots.includes(s) && !isPast;
                    const isFree = displaySlots.includes(s) && !isPast;
                    const isSelected = time === s;

                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!isFree}
                        onClick={() => setTime(s)}
                        title={
                          isSelected
                            ? "Horario seleccionado"
                            : isBusy
                            ? "Horario ocupado por otra cita"
                            : isPast
                            ? "Horario pasado"
                            : "Disponible para agendar"
                        }
                        className={`flex flex-col items-center justify-center rounded-lg border py-2 px-1 text-xs font-mono font-medium transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground font-bold shadow-[0_0_15px_rgba(0,218,243,0.4)] scale-105 ring-2 ring-primary"
                            : isBusy
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-400 line-through cursor-not-allowed opacity-80 select-none"
                            : isPast
                            ? "border-outline-variant/30 bg-surface/20 text-muted-foreground/40 line-through cursor-not-allowed select-none"
                            : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/25 hover:shadow-[0_0_10px_rgba(52,211,153,0.25)] cursor-pointer"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {isSelected ? (
                            <span className="size-1.5 rounded-full bg-primary-foreground" />
                          ) : isBusy ? (
                            <span className="size-1.5 rounded-full bg-rose-400" />
                          ) : isPast ? null : (
                            <Clock className="size-3 opacity-80" />
                          )}
                          {s}
                        </span>
                        {isBusy && (
                          <span className="text-[9px] font-sans text-rose-400/90 tracking-tight mt-0.5">
                            Ocupado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
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
