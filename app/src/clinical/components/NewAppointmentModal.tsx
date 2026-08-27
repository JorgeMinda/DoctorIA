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
import { AlertCircle, UserCheck } from "lucide-react";

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
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

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

  const { data: slots, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    medicoId && date
      ? { medicoId, date, durationMinutes: Number(duration) }
      : undefined,
  );

  const createCitaFn = useAction(manageCita);

  useEffect(() => {
    if (open) {
      setPatientId(defaultPatientId ?? "");
      setDate("");
      setTime("");
      setReason("");
      setBusy(false);
    }
  }, [defaultPatientId, open]);

  useEffect(() => {
    setTime("");
  }, [date, medicoId, duration, slots]);

  const allMedicos = medicosData?.medicos ?? [];
  const allPatients = patientsData?.patients ?? [];
  const freeSlots: string[] = slots?.freeSlots ?? [];

  // Paciente seleccionado y sus médicos autorizados
  const selectedPatient = allPatients.find((p: any) => p.id === patientId);
  const authorizedMedicoIds: string[] = (
    selectedPatient?.authorizedMedicos ?? []
  ).map((a: any) => a.medicoId);

  // Filtrar médicos si hay un paciente seleccionado
  const availableMedicos = patientId
    ? allMedicos.filter((m: any) => authorizedMedicoIds.includes(m.id))
    : allMedicos;

  // Si el médico seleccionado ya no es válido para este paciente, resetearlo
  useEffect(() => {
    if (patientId && medicoId && !authorizedMedicoIds.includes(medicoId)) {
      setMedicoId("");
    }
  }, [patientId, authorizedMedicoIds, medicoId]);

  // Si el paciente solo tiene un médico asignado, auto-seleccionarlo para agilizar
  useEffect(() => {
    if (patientId && availableMedicos.length === 1 && !medicoId) {
      setMedicoId(availableMedicos[0].id);
    }
  }, [patientId, availableMedicos, medicoId]);

  const handleCreate = async () => {
    if (!medicoId || !patientId || !date || !time) {
      toast({
        title: "Campos requeridos",
        description: "Por favor complete médico, paciente, fecha y hora.",
        variant: "destructive",
      });
      return;
    }

    // Validación de asignación médico-paciente
    if (!authorizedMedicoIds.includes(medicoId)) {
      toast({
        title: "Médico no asignado",
        description:
          "El profesional seleccionado no tiene asignación activa para este paciente.",
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
          durationMinutes: Number(duration),
          reason: reason.trim() || undefined,
        },
      });
      toast({ title: "Cita agendada correctamente" });
      onOpenChange(false);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="mono-label">
              🗓 Nueva cita
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Selección de Paciente */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Paciente</Label>
            <Select
              value={patientId}
              onValueChange={(val) => {
                setPatientId(val);
                setMedicoId("");
              }}
              disabled={loadingPatients}
            >
              <SelectTrigger className="border-outline-variant bg-surface">
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

          {/* Selección de Médico (filtrado por los autorizados para este paciente) */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center justify-between">
              <span>Médico asignado</span>
              {selectedPatient && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {availableMedicos.length}{" "}
                  {availableMedicos.length === 1
                    ? "médico asignado"
                    : "médicos asignados"}
                </span>
              )}
            </Label>
            <Select
              value={medicoId}
              onValueChange={setMedicoId}
              disabled={
                !patientId ||
                loadingMedicos ||
                availableMedicos.length === 0
              }
            >
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue
                  placeholder={
                    !patientId
                      ? "Seleccione primero un paciente"
                      : availableMedicos.length === 0
                        ? "Sin médicos asignados a este paciente"
                        : "Seleccione profesional médico"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableMedicos.map((m: any) => (
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

            {patientId && selectedPatient && availableMedicos.length === 0 && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                Este paciente no tiene médicos asignados. Un administrador debe
                asignarle un médico antes de programar una cita.
              </p>
            )}
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label htmlFor="na-date">Fecha</Label>
            <Input
              id="na-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-outline-variant bg-surface font-mono"
            />
          </div>

          {/* Hora */}
          <div className="space-y-1.5">
            <Label htmlFor="na-time">Hora (disponible)</Label>
            <Select
              value={time}
              onValueChange={setTime}
              disabled={!medicoId || !date || loadingSlots}
            >
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue
                  placeholder={
                    loadingSlots ? "Consultando…" : "Horarios libres"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {freeSlots.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {medicoId && date && freeSlots.length === 0 && !loadingSlots && (
              <p className="text-xs text-destructive">
                No hay horarios libres ese día para este médico.
              </p>
            )}
          </div>

          {/* Duración */}
          <div className="space-y-1.5">
            <Label htmlFor="na-dur">Duración (min)</Label>
            <Input
              id="na-dur"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="border-outline-variant bg-surface font-mono"
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="na-reason">Motivo de la cita (opcional)</Label>
            <Input
              id="na-reason"
              placeholder="Ej: Control de rutina, revisión de exámenes…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>
        </div>

        <DialogFooter>
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
      </DialogContent>
    </Dialog>
  );
}
