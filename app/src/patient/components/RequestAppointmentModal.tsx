import { useState, useEffect } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getActiveDoctorsForPatient,
  getAvailableSlots,
  requestPatientAppointment,
} from "wasp/client/operations";
import { toast } from "../../client/hooks/use-toast";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { Textarea } from "../../client/components/ui/textarea";
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
} from "../../client/components/ui/dialog";
import { Badge } from "../../client/components/ui/badge";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Stethoscope,
} from "lucide-react";

interface RequestAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  patientName?: string;
  patientId?: string;
}

const ALL_DAY_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30",
];

export function RequestAppointmentModal({
  open,
  onOpenChange,
  onDone,
}: RequestAppointmentModalProps) {
  const [medicoId, setMedicoId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCita, setSubmittedCita] = useState<any | null>(null);

  const { data: doctorsData, isLoading: loadingDoctors } = useQuery(
    getActiveDoctorsForPatient,
    {},
    { enabled: open }
  );

  const hasSlotParams = Boolean(open && medicoId && date);
  const { data: slotsData, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    hasSlotParams
      ? {
          medicoId,
          date,
          durationMinutes: 30,
          timezoneOffset: new Date().getTimezoneOffset(),
        }
      : ({} as any),
    { enabled: hasSlotParams }
  );

  const requestAppointmentFn = useAction(requestPatientAppointment);

  const resetForm = () => {
    setMedicoId("");
    setDate("");
    setTime("");
    setReason("");
    setIsSubmitting(false);
    setSubmittedCita(null);
  };

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const doctors: any[] = Array.isArray(doctorsData) ? doctorsData : [];
  const freeSlots: string[] = (slotsData as any)?.freeSlots ?? [];
  const baseSlots = Array.from(new Set([...ALL_DAY_SLOTS, ...freeSlots])).sort();

  const selectedDoctor = doctors.find((d) => d.id === medicoId);

  const isSlotPast = (slotTime: string) => {
    if (!date) return false;
    const slotDate = new Date(`${date}T${slotTime}:00`);
    return slotDate.getTime() <= Date.now();
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicoId || !date || !time) {
      toast({
        title: "Campos requeridos",
        description: "Por favor selecciona un médico, fecha y horario disponible.",
        variant: "destructive",
      });
      return;
    }

    if (!freeSlots.includes(time)) {
      toast({
        title: "Horario no disponible",
        description: "El horario seleccionado ya está ocupado o no está habilitado.",
        variant: "destructive",
      });
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (scheduledAt.getTime() <= Date.now()) {
      toast({
        title: "Horario inválido",
        description: "La cita debe programarse en un horario futuro.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await requestAppointmentFn({
        medicoId,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: 30,
        reason: reason.trim() || "Consulta médica general",
      });

      setSubmittedCita({
        ...(res?.cita || {}),
        doctorName: selectedDoctor?.fullName || selectedDoctor?.email,
        specialty: selectedDoctor?.specialty || "Medicina General",
        date,
        time,
        reason: reason.trim() || "Consulta médica general",
      });

      toast({
        title: "✅ Solicitud de Cita Registrada",
        description: "Tu cita ha sido agendada y está pendiente de confirmación por secretaría o recepción.",
      });

      if (onDone) {
        onDone();
      }
    } catch (err: any) {
      toast({
        title: "Error al solicitar cita",
        description:
          err?.message ||
          "No se pudo completar la solicitud. Por favor intenta otro horario.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg border-outline-variant bg-surface text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <CalendarDays className="size-5 text-primary" />
            Solicitar Cita Médica
          </DialogTitle>
        </DialogHeader>

        {submittedCita ? (
          <div className="space-y-4 py-3">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
              <CheckCircle2 className="size-6 shrink-0 text-emerald-400 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground">
                  ¡Cita solicitada exitosamente!
                </h4>
                <p className="text-xs text-muted-foreground">
                  Tu turno ha quedado registrado en la agenda médica y en tu historial de citas.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/60 bg-surface-container/40 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-outline-variant/40">
                <span className="text-muted-foreground">Médico:</span>
                <span className="font-semibold text-foreground">
                  {submittedCita.doctorName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/40">
                <span className="text-muted-foreground">Especialidad:</span>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {submittedCita.specialty}
                </Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/40">
                <span className="text-muted-foreground">Fecha y Hora:</span>
                <span className="font-mono font-bold text-primary">
                  {new Date(`${submittedCita.date}T${submittedCita.time}:00`).toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  - {submittedCita.time}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Motivo:</span>
                <span className="font-medium text-foreground text-right max-w-[240px] truncate">
                  {submittedCita.reason}
                </span>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-between pt-2">
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                  `Cita Médica - ${submittedCita.doctorName}`
                )}&dates=${submittedCita.date.replace(/-/g, "")}T${submittedCita.time.replace(/:/g, "")}00/${submittedCita.date.replace(/-/g, "")}T${submittedCita.time.replace(/:/g, "")}00&details=${encodeURIComponent(
                  `Cita médica con ${submittedCita.doctorName} (${submittedCita.specialty}). Motivo: ${submittedCita.reason}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Añadir a Google Calendar
              </a>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                Cerrar y Ver Mis Citas
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* 1. Selección de Médico */}
            <div className="space-y-1.5">
              <Label htmlFor="doctor-select" className="text-xs font-semibold text-foreground">
                1. Selecciona Profesional Médico *
              </Label>
              <Select
                value={medicoId}
                onValueChange={(val) => {
                  setMedicoId(val);
                  setTime("");
                }}
              >
                <SelectTrigger
                  id="doctor-select"
                  className="border-outline-variant bg-surface-container/60 text-xs h-10"
                >
                  <SelectValue
                    placeholder={
                      loadingDoctors
                        ? "Cargando médicos disponibles…"
                        : doctors.length === 0
                        ? "No hay médicos disponibles"
                        : "Selecciona un médico"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="border-outline-variant bg-surface text-xs">
                  {doctors.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="size-3.5 text-primary" />
                        <span className="font-medium text-foreground">{doc.fullName || doc.email}</span>
                        {doc.specialty && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-outline-variant text-muted-foreground">
                            {doc.specialty}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Selección de Fecha */}
            <div className="space-y-1.5">
              <Label htmlFor="appointment-date" className="text-xs font-semibold text-foreground">
                2. Fecha deseada *
              </Label>
              <Input
                id="appointment-date"
                type="date"
                min={todayStr}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                }}
                className="border-outline-variant bg-surface-container/60 text-xs font-mono h-10"
              />
            </div>

            {/* 3. Selección de Horario (Disponibilidad en tiempo real) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  3. Horarios disponibles *
                </Label>
                {medicoId && date && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {loadingSlots ? "Consultando..." : `${freeSlots.length} turnos libres`}
                  </span>
                )}
              </div>

              {!medicoId || !date ? (
                <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container/30 p-4 text-center text-xs text-muted-foreground">
                  Selecciona primero un médico y una fecha para consultar la disponibilidad en tiempo real.
                </div>
              ) : loadingSlots ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container/30 p-6 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Verificando turnos disponibles con el profesional…
                </div>
              ) : (
                <div className="space-y-2.5">
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

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl border border-outline-variant/40 bg-surface-container/30">
                    {baseSlots.map((s) => {
                      const isPast = isSlotPast(s);
                      const isBusy = !freeSlots.includes(s) && !isPast;
                      const isFree = freeSlots.includes(s) && !isPast;
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
                              ? "Horario ocupado"
                              : isPast
                              ? "Horario pasado"
                              : "Disponible para solicitar"
                          }
                          className={`flex flex-col items-center justify-center rounded-lg border py-2 px-1 text-xs font-mono transition-all ${
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
                              <CheckCircle2 className="size-3 text-primary-foreground" />
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

            {/* 4. Motivo de la Cita */}
            <div className="space-y-1.5">
              <Label htmlFor="appointment-reason" className="text-xs font-semibold text-foreground">
                4. Motivo de consulta (opcional)
              </Label>
              <Textarea
                id="appointment-reason"
                placeholder="Describe brevemente tus síntomas o el motivo de la consulta (ej. Control de presión arterial, chequeo anual, etc.)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border-outline-variant bg-surface-container/60 text-xs min-h-[70px] resize-none"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-xs border-outline-variant text-muted-foreground"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!medicoId || !date || !time || isSubmitting}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Procesando solicitud…
                  </>
                ) : (
                  <>
                    <CalendarDays className="size-3.5" />
                    Confirmar Solicitud de Cita
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
