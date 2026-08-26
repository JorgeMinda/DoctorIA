import { useState } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getDoctorsAgenda,
  getPatients,
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";

export function SecretaryCitaPanel() {
  const [medicoId, setMedicoId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);

  const { data: medicosData } = useQuery(getDoctorsAgenda, {});
  const { data: patientsData } = useQuery(getPatients, {
    page: 1,
    pageSize: 200,
  });

  const createCitaFn = useAction(manageCita);

  const handleCreate = async () => {
    if (!medicoId || !patientId || !scheduledAt) {
      toast({
        title: "Campos requeridos",
        description: "Seleccione médico, paciente y fecha/hora.",
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
          scheduledAt: new Date(scheduledAt),
          durationMinutes: Number(duration),
        },
      });
      toast({ title: "Cita creada" });
      setScheduledAt("");
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

  const medicos = medicosData?.medicos ?? [];
  const patients = patientsData?.patients ?? [];

  return (
    <Card className="overflow-hidden border-outline-variant">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Badge variant="outline" className="mono-label">
            🗓 Nueva cita
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
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
          <Label htmlFor="cita-when">Fecha y hora</Label>
          <Input
            id="cita-when"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="border-outline-variant bg-surface font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cita-dur">Duración (min)</Label>
          <Input
            id="cita-dur"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="border-outline-variant bg-surface font-mono"
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={handleCreate} disabled={busy || !medicoId || !patientId || !scheduledAt}>
            {busy ? "Creando…" : "Crear cita"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
