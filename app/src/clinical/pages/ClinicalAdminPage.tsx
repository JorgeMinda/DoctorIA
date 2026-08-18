import { useState } from "react";
import { useQuery } from "wasp/client/operations";
import { getPaginatedUsers } from "wasp/client/operations";
import {
  manageMedicoPatientAccess,
  manageSyntheticPatients,
} from "wasp/client/operations";
import { useAction } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  AlertCircle,
  KeyRound,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";

export function ClinicalAdminPage() {
  const { data: user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: medicos } = useQuery(getPaginatedUsers, {
    skipPages: 0,
    filter: { isMedico: true },
  });

  // Alta de paciente sintético
  const [synthId, setSynthId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("M");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [allergies, setAllergies] = useState("");

  // Asignación de acceso médico
  const [medicoId, setMedicoId] = useState("");
  const [accessPatientId, setAccessPatientId] = useState("");
  const [accessAction, setAccessAction] = useState<"GRANT" | "REVOKE">(
    "GRANT",
  );

  const managePatientsFn = useAction(manageSyntheticPatients);
  const manageAccessFn = useAction(manageMedicoPatientAccess);

  if (!user?.isAdmin || user.isMedico) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            Solo administradores pueden acceder a esta sección.
          </CardContent>
        </Card>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(successMsg);
    } catch (err: any) {
      setError(err?.message ?? "Operación fallida");
    }
  };

  const handleCreatePatient = () =>
    run(
      () =>
        managePatientsFn({
          action: "CREATE",
          data: {
            syntheticId: synthId,
            firstName,
            lastName,
            birthDate: new Date(birthDate),
            sex,
            medicalHistory: medicalHistory || null,
            allergies: allergies || null,
          },
        }),
      "Paciente sintético creado",
    );

  const handleManageAccess = () =>
    run(
      () =>
        manageAccessFn({
          action: accessAction,
          medicoId,
          patientId: accessPatientId,
        }),
      accessAction === "GRANT" ? "Acceso concedido" : "Acceso revocado",
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
          Gestión · Administración
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Administración
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de pacientes sintéticos y accesos de médicos.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}
      {notice && (
        <Card className="border-success/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-success">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {notice}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserPlus className="size-4 text-primary" />
              Alta de paciente sintético
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="border-outline-variant bg-surface"
                placeholder="ID sintético (PAC-xxx)"
                value={synthId}
                onChange={(e) => setSynthId(e.target.value)}
              />
              <Input
                className="border-outline-variant bg-surface"
                placeholder="Sexo (M/F/O)"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="border-outline-variant bg-surface"
                placeholder="Nombres"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                className="border-outline-variant bg-surface"
                placeholder="Apellidos"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <Input
              className="border-outline-variant bg-surface"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <Textarea
              className="border-outline-variant bg-surface"
              placeholder="Antecedentes médicos"
              rows={2}
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
            />
            <Textarea
              className="border-outline-variant bg-surface"
              placeholder="Alergias"
              rows={2}
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
            <Button
              onClick={handleCreatePatient}
              disabled={!synthId || !firstName || !lastName || !birthDate}
            >
              Crear paciente
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="size-4 text-primary" />
              Acceso Médico ↔ Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
            >
              <option value="">Seleccione un médico…</option>
              {medicos?.users.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.fullName ?? m.username ?? m.email}
                </option>
              ))}
            </select>
            <Input
              className="border-outline-variant bg-surface"
              placeholder="ID de paciente"
              value={accessPatientId}
              onChange={(e) => setAccessPatientId(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => setAccessAction("GRANT")}
                variant={accessAction === "GRANT" ? "default" : "outline"}
              >
                Otorgar acceso
              </Button>
              <Button
                onClick={() => setAccessAction("REVOKE")}
                variant={accessAction === "REVOKE" ? "destructive" : "outline"}
              >
                Revocar acceso
              </Button>
            </div>
            <Button
              onClick={handleManageAccess}
              disabled={!medicoId || !accessPatientId}
            >
              Aplicar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}