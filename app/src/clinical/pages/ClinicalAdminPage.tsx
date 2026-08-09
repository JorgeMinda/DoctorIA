import { useState } from "react";
import { useQuery } from "wasp/client/operations";
import { getPaginatedUsers } from "wasp/client/operations";
import { manageMedicoPatientAccess, manageSyntheticPatients } from "wasp/client/operations";
import { useAction } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
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
  const [accessAction, setAccessAction] = useState<"GRANT" | "REVOKE">("GRANT");

  const managePatientsFn = useAction(manageSyntheticPatients);
  const manageAccessFn = useAction(manageMedicoPatientAccess);

  if (!user?.isAdmin || user.isMedico) {
    return (
      <div className="mt-10 px-6">
        <Card className="mb-4 lg:m-8">
          <CardContent className="p-6">
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
    <div className="mt-10 px-6">
      <div className="mb-4 lg:mx-8">
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de pacientes sintéticos y accesos de médicos.
        </p>
      </div>

      {error && (
        <div className="mb-4 lg:mx-8">
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        </div>
      )}
      {notice && (
        <div className="mb-4 lg:mx-8">
          <Card className="border-emerald-500/50">
            <CardContent className="p-4 text-sm text-emerald-600">{notice}</CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:mx-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Alta de paciente sintético
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="ID sintético (PAC-xxx)" value={synthId} onChange={(e) => setSynthId(e.target.value)} />
              <Input placeholder="Sexo (M/F/O)" value={sex} onChange={(e) => setSex(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nombres" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input placeholder="Apellidos" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <Textarea placeholder="Antecedentes médicos" rows={2} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} />
            <Textarea placeholder="Alergias" rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
            <Button
              onClick={handleCreatePatient}
              disabled={!synthId || !firstName || !lastName || !birthDate}
            >
              Crear paciente
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Acceso Médico ↔ Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
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
            <Button onClick={handleManageAccess} disabled={!medicoId || !accessPatientId}>
              Aplicar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
