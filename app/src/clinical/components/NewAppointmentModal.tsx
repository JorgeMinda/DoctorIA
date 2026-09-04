import { useEffect, useState } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getDoctorsAgenda,
  getPatients,
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
import { AlertCircle, CalendarCheck, CheckCircle2, Clock, Plus, UserCheck } from "lucide-react";

export function NewAppointmentModal({
  open,
  onOpenChange,
  defaultPatientId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultPatientId?: string;
  onDone?: () => void;
}) {
  const [medicoId, setMedicoId] = useState("");
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{
    patientName: string;
    syntheticId: string;
    medicoName: string;
    date: string;
    time: string;
    reason?: string;
  } | null>(null);

  // Duración estándar fijada a 30 minutos
  const DURATION_MINUTES = 30;

  const { data: medicosData, isLoading: loadingMedicos } = useQuery(
    getDoctorsAgenda,
    {},
    { enabled: open },
  );

  const { data: patientsData, isLoading: loadingPatients } = useQuery(
    getPatients,
    {
      page: 1,
      pageSize: 200,
    },
    { enabled: open },
  );

  const hasSlotParams = Boolean(open && medicoId && date);
  const { data: slots, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    hasSlotParams
      ? { medicoId, date, durationMinutes: DURATION_MINUTES }
      : ({} as any),
    { enabled: hasSlotParams },
  );

  const createCitaFn = useAction(manageCita);

  const resetForm = () => {
    setPatientId(defaultPatientId ?? "");
    setMedicoId("");
    setDate("");
    setTime("");
    setReason("");
    setBusy(false);
    setCreatedSummary(null);
  };

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, defaultPatientId]);

  const allMedicos = medicosData?.medicos ?? [];
  const allPatients = patientsData?.patients ?? [];
  const freeSlots: string[] = slots?.freeSlots ?? [];

  // Paciente seleccionado y sus médicos autorizados
  const selectedPatient = allPatients.find((p: any) => p.id === patientId);
  const authorizedMedicoIds: string[] = (
    selectedPatient?.authorizedMedicos ?? []
  ).map((a: any) => a.medicoId);

  // Todos los médicos activos pueden ser seleccionados para la cita
  const availableMedicos = allMedicos;

  const handlePatientChange = (newPatientId: string) => {
    setPatientId(newPatientId);
    setTime("");
    const targetPatient = allPatients.find((p: any) => p.id === newPatientId);
    const authIds = (targetPatient?.authorizedMedicos ?? []).map(
      (a: any) => a.medicoId,
    );
    const validMedicos = allMedicos.filter((m: any) => authIds.includes(m.id));
    if (validMedicos.length === 1) {
      setMedicoId(validMedicos[0].id);
    }
  };

  const handleMedicoChange = (newMedicoId: string) => {
    setMedicoId(newMedicoId);
    setTime("");
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setTime("");
  };

  const handleCreate = async () => {
    if (!medicoId || !patientId || !date || !time) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete médico, paciente, fecha y hora.",
        variant: "destructive",
      });
      return;
    }

    if (!freeSlots.includes(time)) {
      toast({
        title: "Horario no disponible",
        description: "El horario seleccionado no está disponible.",
        variant: "destructive",
      });
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (scheduledAt.getTime() <= Date.now()) {
      toast({
        title: "Fecha inválida",
        description: "La cita no puede programarse en el pasado.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      await createCitaFn({
        action: "CREATE",
        data: {
          medicoId,
          patientId,
          scheduledAt,
          durationMinutes: DURATION_MINUTES,
          reason: reason.trim() || undefined,
        },
      });

      const chosenDoctor = allMedicos.find((m: any) => m.id === medicoId);

      setCreatedSummary({
        patientName: selectedPatient
          ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
          : "Paciente",
        syntheticId: selectedPatient?.syntheticId ?? "",
        medicoName: chosenDoctor?.fullName || chosenDoctor?.email || "Médico",
        date,
        time,
        reason: reason.trim() || undefined,
      });

      toast({ title: "Cita agendada correctamente" });
      onDone?.();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-primary" />
            Nueva cita médica
          </DialogTitle>
        </DialogHeader>

        {createdSummary ? (
          /* Resumen de Cita Creada */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-primary">
              <CheckCircle2 className="size-6 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm">
                  ¡Cita programada con éxito!
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  La cita ha quedado registrada en la agenda y en la ficha del
                  paciente.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-outline-variant/60 bg-surface/50 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-muted-foreground">Paciente:</span>
                <span className="font-semibold text-foreground">
                  {createdSummary.patientName} ({createdSummary.syntheticId})
                </span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-muted-foreground">Médico tratante:</span>
                <span className="font-medium text-foreground">
                  Dr. {createdSummary.medicoName}
                </span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-muted-foreground">Fecha y hora:</span>
                <span className="font-mono font-medium text-foreground">
                  {createdSummary.date} a las {createdSummary.time} (30 min)
                </span>
              </div>
              {createdSummary.reason && (
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="italic text-foreground">
                    {createdSummary.reason}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 pt-2">
              <Button
                variant="outline"
                onClick={resetForm}
                className="w-full sm:w-auto gap-1.5"
              >
                <Plus className="size-4" />
                Agendar otra cita
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Ver en agenda
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Formulario de Agendamiento */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Selección de Paciente */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Paciente</Label>
              <Select
                value={patientId || undefined}
                onValueChange={handlePatientChange}
                disabled={loadingPatients}
              >
                <SelectTrigger className="border-outline-variant bg-surface/70 backdrop-blur-sm">
                  <SelectValue
                    placeholder={
                      loadingPatients
                        ? "Cargando pacientes…"
                        : "Seleccione paciente"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {allPatients.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.syntheticId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selección de Médico */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center justify-between">
                <span>Profesional médico</span>
                {allMedicos.length > 0 && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {allMedicos.length}{" "}
                    {allMedicos.length === 1
                      ? "profesional disponible"
                      : "profesionales disponibles"}
                  </span>
                )}
              </Label>
              <Select
                value={medicoId || undefined}
                onValueChange={handleMedicoChange}
                disabled={
                  !patientId ||
                  loadingMedicos ||
                  availableMedicos.length === 0
                }
              >
                <SelectTrigger className="border-outline-variant bg-surface/70 backdrop-blur-sm">
                  <SelectValue
                    placeholder={
                      !patientId
                        ? "Seleccione primero un paciente"
                        : availableMedicos.length === 0
                          ? "Sin médicos activos disponibles"
                          : "Seleccione profesional médico"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableMedicos.map((m: any) => {
                    const isAssigned = authorizedMedicoIds.includes(m.id);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="size-3.5 text-primary" />
                          <span>{m.fullName || m.email}</span>
                          {m.specialty ? (
                            <span className="text-xs text-muted-foreground">
                              · {m.specialty}
                            </span>
                          ) : null}
                          {isAssigned && (
                            <Badge
                              variant="outline"
                              className="ml-1 text-[10px] py-0 px-1 text-primary border-primary/40"
                            >
                              Asignado
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="na-date">Fecha de la cita</Label>
              <Input
                id="na-date"
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="border-outline-variant bg-surface/70 font-mono backdrop-blur-sm"
              />
            </div>

            {/* Horarios Disponibles (Grid con diferenciación de color Disponible vs Ocupado) */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Horarios del día</Label>
                {date && medicoId && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {loadingSlots
                      ? "Consultando disponibilidad…"
                      : `${freeSlots.length} horarios libres`}
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

            {/* Motivo de la cita */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="na-reason">Motivo de la cita (opcional)</Label>
              <Input
                id="na-reason"
                placeholder="Ej: Control de rutina, revisión de exámenes, seguimiento…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border-outline-variant bg-surface/70 backdrop-blur-sm"
              />
            </div>

            <DialogFooter className="sm:col-span-2 pt-2">
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={
                  busy ||
                  !patientId ||
                  !medicoId ||
                  availableMedicos.length === 0 ||
                  !date ||
                  !time
                }
              >
                {busy ? "Agendando…" : "Crear cita"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
