import { useState } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import {
  createEmergencyAssignment,
  getDoctorsAgenda,
} from "wasp/client/operations";
import { useNavigate } from "react-router";
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
import { AlertCircle, Flame, Siren, Stethoscope, UserCheck } from "lucide-react";

export function EmergencyAppointmentModal({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState("M");
  const [documento, setDocumento] = useState("");
  const [birthDate, setBirthDate] = useState("1990-01-01");
  const [medicoId, setMedicoId] = useState("");
  const [motivo, setMotivo] = useState("🚨 Atención de Emergencia Inmediata");
  const [busy, setBusy] = useState(false);

  const { data: doctorsData, isLoading: loadingDoctors } = useQuery(
    getDoctorsAgenda,
    {},
    { enabled: open },
  );

  const createEmergencyFn = useAction(createEmergencyAssignment);

  const medicos = doctorsData?.medicos ?? [];

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !sex) {
      toast({
        title: "Campos requeridos",
        description: "Nombre, apellido y sexo son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const res: any = await createEmergencyFn({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sex,
        documento: documento.trim() || undefined,
        birthDate: birthDate ? new Date(`${birthDate}T00:00:00`) : undefined,
        motivoConsulta: motivo.trim() || "🚨 Atención de Emergencia",
        medicoId: medicoId || undefined,
      });

      toast({
        title: "🚨 Cita Emergente Programada",
        description: `Paciente ${res?.patient?.syntheticId || ""} asignado a ${res?.cita?.medico?.fullName || "médico de turno"}.`,
      });

      onOpenChange(false);
      onDone?.();

      // Redirigir a la ficha clínica del paciente recién creado
      if (res.patient?.id) {
        navigate(`/clinical/patients/${res.patient.id}`);
      }
    } catch (err: any) {
      toast({
        title: "No se pudo registrar la emergencia",
        description: err?.message || "Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-destructive/40 bg-surface/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Badge
              variant="destructive"
              className="mono-label gap-1.5 border-destructive/60 bg-destructive/20 text-destructive shadow-sm"
            >
              <Siren className="size-3.5 animate-pulse" />
              Cita Emergente Express
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Crea el paciente sintético, asigna al médico disponible y habilita el turno clínico de inmediato.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
          {/* Nombres */}
          <div className="space-y-1">
            <Label htmlFor="em-firstName" className="text-xs font-semibold">
              Nombre(s) *
            </Label>
            <Input
              id="em-firstName"
              placeholder="Ej: Carlos"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>

          {/* Apellidos */}
          <div className="space-y-1">
            <Label htmlFor="em-lastName" className="text-xs font-semibold">
              Apellido(s) *
            </Label>
            <Input
              id="em-lastName"
              placeholder="Ej: Andrade"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border-outline-variant bg-surface"
            />
          </div>

          {/* Sexo */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Sexo *</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue placeholder="Seleccione sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino (M)</SelectItem>
                <SelectItem value="F">Femenino (F)</SelectItem>
                <SelectItem value="O">Otro (O)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cédula / Documento */}
          <div className="space-y-1">
            <Label htmlFor="em-doc" className="text-xs font-semibold">
              Cédula / Documento (opcional)
            </Label>
            <Input
              id="em-doc"
              placeholder="Máx. 10 caracteres"
              maxLength={10}
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className="border-outline-variant bg-surface font-mono"
            />
          </div>

          {/* Fecha de nacimiento */}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="em-birth" className="text-xs font-semibold">
              Fecha de nacimiento (o estimada)
            </Label>
            <Input
              id="em-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="border-outline-variant bg-surface font-mono"
            />
          </div>

          {/* Médico Asignado */}
          <div className="space-y-1 sm:col-span-2">
            <Label className="flex items-center justify-between text-xs font-semibold">
              <span>Médico de turno / receptor</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {medicos.length} disponibles
              </span>
            </Label>
            <Select
              value={medicoId || undefined}
              onValueChange={setMedicoId}
              disabled={loadingDoctors}
            >
              <SelectTrigger className="border-outline-variant bg-surface">
                <SelectValue
                  placeholder={
                    loadingDoctors
                      ? "Consultando médicos…"
                      : "Auto-asignar primer médico disponible"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {medicos.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-primary" />
                      <span>{m.fullName || m.email}</span>
                      {m.specialty && (
                        <span className="text-xs text-muted-foreground">
                          · {m.specialty}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo de emergencia */}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="em-reason" className="text-xs font-semibold">
              Motivo o síntoma principal de ingreso
            </Label>
            <Textarea
              id="em-reason"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="border-outline-variant bg-surface"
              placeholder="Describa brevemente el cuadro de ingreso…"
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleRegister}
            disabled={busy || !firstName.trim() || !lastName.trim()}
            className="gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
          >
            <Siren className="size-4" />
            {busy ? "Registrando emergencia…" : "Crear Cita Emergente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
