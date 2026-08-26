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
  DialogClose,
} from "../../client/components/ui/dialog";
import { Badge } from "../../client/components/ui/badge";

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
  const [busy, setBusy] = useState(false);

  const { data: medicosData } = useQuery(getDoctorsAgenda, {});
  const { data: patientsData } = useQuery(getPatients, {
    page: 1,
    pageSize: 200,
  });
  const { data: slots, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    medicoId && date
      ? { medicoId, date, durationMinutes: Number(duration) }
      : null,
  );

  const createCitaFn = useAction(manageCita);

  useEffect(() => {
    setPatientId(defaultPatientId ?? "");
  }, [defaultPatientId, open]);
  useEffect(() => {
    setTime("");
  }, [date, medicoId, duration, slots]);

  const medicos = medicosData?.medicos ?? [];
  const patients = patientsData?.patients ?? [];
  const freeSlots: string[] = slots?.freeSlots ?? [];

  const handleCreate = async () => {
    if (!medicoId || !patientId || !date || !time) {
      toast({
        title: "Campos requeridos",
        description: "Médico, paciente, fecha y hora.",
        variant: "destructive",
      });
      return;
    }
    if (!freeSlots.includes(time)) {
      toast({
        title: "Horario no disponible",
        description: "Ese horario se solapa con otra cita.",
        variant: "destructive",
      });
      return;
    }
    const scheduledAt = new Date(`${date}T${time}:00`);
    if (scheduledAt.getTime() <= Date.now()) {
      toast({
        title: "Fecha inválida",
        description: "La cita no puede ser en el pasado.",
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
        },
      });
      toast({ title: "Cita creada" });
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
          <div className="space-y-1.5">
            <Label>Médico</Label>
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue placeholder="Seleccione profesional" />
              </SelectTrigger>
              <SelectContent>
                {medicos.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName || m.email}
                    {m.specialty ? ` · ${m.specialty}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue placeholder="Seleccione paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.syntheticId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="na-time">Hora (disponible)</Label>
            <Select
              value={time}
              onValueChange={setTime}
              disabled={!medicoId || !date || loadingSlots}
            >
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue
                  placeholder={loadingSlots ? "Cargando…" : "Horarios libres"}
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
                No hay horarios libres ese día.
              </p>
            )}
          </div>
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
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={busy}>
            {busy ? "Creando…" : "Crear cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
