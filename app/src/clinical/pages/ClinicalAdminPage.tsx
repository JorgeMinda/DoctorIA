import { useState, type ReactNode } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import {
  adminCreateMedicoUser,
  adminDeleteMedicoUser,
  adminGetPatients,
  adminUpdateMedicoUser,
  getAgenda,
  getDoctorsAgenda,
  getPaginatedUsers,
  manageCita,
  manageMedicoPatientAccess,
  manageSyntheticPatients,
  updateCitaStatus,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  KeyRound,
  Pencil,
  PhoneMissed,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  XCircle,
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
import { Badge } from "../../client/components/ui/badge";
import { patientAge, sexLabel } from "../services/clinicalFormat";
import { citaStatusLabel } from "../services/statusLabels";
import { MedicoAgendaPanel } from "../components/MedicoAgendaPanel";

type Notice = (message: string) => void;
type ReportError = (message: string) => void;

const TAB_CLASS =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
const TAB_ACTIVE = "bg-primary/15 text-primary";
const TAB_IDLE =
  "text-muted-foreground hover:bg-accent/40 hover:text-foreground";

function run(
  fn: () => Promise<unknown>,
  notice: Notice,
  reportError: ReportError,
) {
  return async () => {
    try {
      await fn();
      notice("Operación realizada correctamente");
    } catch (err: any) {
      reportError(err?.message ?? "Operación fallida");
    }
  };
}

function StatusBanner({
  error,
  notice,
}: {
  error: string | null;
  notice: string | null;
}) {
  if (!error && !notice) return null;
  return (
    <Card className={error ? "border-destructive/50" : "border-success/50"}>
      <CardContent
        className={`flex items-start gap-2 p-4 text-sm ${
          error ? "text-destructive" : "text-success"
        }`}
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {error ?? notice}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab: Pacientes
// ---------------------------------------------------------------------------

function EditPatientForm({
  patient,
  onCancel,
  notice,
  reportError,
}: {
  patient: any;
  onCancel: () => void;
  notice: Notice;
  reportError: ReportError;
}) {
  const managePatientsFn = useAction(manageSyntheticPatients);
  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [birthDate, setBirthDate] = useState(
    new Date(patient.birthDate).toISOString().slice(0, 10),
  );
  const [sex, setSex] = useState(patient.sex);
  const [documento, setDocumento] = useState(patient.documento ?? "");
  const [medicalHistory, setMedicalHistory] = useState(
    patient.medicalHistory ?? "",
  );
  const [allergies, setAllergies] = useState(patient.allergies ?? "");
  const [profile, setProfile] = useState({
    nationality: patient.nationality ?? "",
    heightCm: patient.heightCm ? String(patient.heightCm) : "",
    weightKg: patient.weightKg ? String(patient.weightKg) : "",
    ethnicity: patient.ethnicity ?? "",
    bloodType: patient.bloodType ?? "",
    address: patient.address ?? "",
    phone: patient.phone ?? "",
    emergencyPhone: patient.emergencyPhone ?? "",
    insurance: patient.insurance ?? "",
  });

  const setProfileField = (field: keyof typeof profile, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const handleSave = run(
    () =>
      managePatientsFn({
        action: "UPDATE",
        patientId: patient.id,
        data: {
          firstName,
          lastName,
          birthDate: new Date(birthDate),
          sex,
          documento: documento || null,
          medicalHistory: medicalHistory || null,
          allergies: allergies || null,
          ...patientProfilePayload(profile),
        },
      }),
    notice,
    reportError,
  );

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        <Input
          className="border-outline-variant bg-surface"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        <select
          className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
        >
          <option value="M">Masculino (M)</option>
          <option value="F">Femenino (F)</option>
          <option value="O">Otro (O)</option>
        </select>
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Cédula o pasaporte (máx. 10)"
          maxLength={10}
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
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
        <div className="sm:col-span-2" />
        <ProfileFields values={profile} onChange={setProfileField} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          onClick={handleSave}
          disabled={!firstName || !lastName || !birthDate}
        >
          Guardar cambios
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function patientProfilePayload(data: {
  nationality: string;
  heightCm: string;
  weightKg: string;
  ethnicity: string;
  bloodType: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  insurance: string;
}) {
  return {
    nationality: data.nationality.trim() ? data.nationality.trim() : null,
    heightCm: data.heightCm ? Number(data.heightCm) : null,
    weightKg: data.weightKg ? Number(data.weightKg) : null,
    ethnicity: data.ethnicity.trim() ? data.ethnicity.trim() : null,
    bloodType: data.bloodType || null,
    address: data.address.trim() ? data.address.trim() : null,
    phone: data.phone.trim() ? data.phone.trim() : null,
    emergencyPhone: data.emergencyPhone.trim()
      ? data.emergencyPhone.trim()
      : null,
    insurance: data.insurance.trim() ? data.insurance.trim() : null,
  };
}

function ProfileFields({
  values,
  onChange,
}: {
  values: {
    nationality: string;
    heightCm: string;
    weightKg: string;
    ethnicity: string;
    bloodType: string;
    address: string;
    phone: string;
    emergencyPhone: string;
    insurance: string;
  };
  onChange: (field: keyof typeof values, value: string) => void;
}) {
  return (
    <>
      <Textarea
        className="border-outline-variant bg-surface"
        placeholder="Dirección"
        rows={2}
        value={values.address}
        onChange={(e) => onChange("address", e.target.value)}
      />
      <Textarea
        className="border-outline-variant bg-surface"
        placeholder="Seguro / entidad de salud (ej. IESS)"
        rows={2}
        value={values.insurance}
        onChange={(e) => onChange("insurance", e.target.value)}
      />
      <Input
        className="border-outline-variant bg-surface"
        placeholder="Nacionalidad"
        value={values.nationality}
        onChange={(e) => onChange("nationality", e.target.value)}
      />
      <Input
        className="border-outline-variant bg-surface"
        placeholder="Etnia / grupo étnico"
        value={values.ethnicity}
        onChange={(e) => onChange("ethnicity", e.target.value)}
      />
      <Input
        className="border-outline-variant bg-surface"
        type="number"
        min={1}
        max={300}
        placeholder="Talla (cm)"
        value={values.heightCm}
        onChange={(e) => onChange("heightCm", e.target.value)}
      />
      <Input
        className="border-outline-variant bg-surface"
        type="number"
        min={1}
        max={500}
        placeholder="Peso (kg)"
        value={values.weightKg}
        onChange={(e) => onChange("weightKg", e.target.value)}
      />
      <select
        className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
        value={values.bloodType}
        onChange={(e) => onChange("bloodType", e.target.value)}
      >
        {BLOOD_TYPES.map((bt) => (
          <option key={bt || "none"} value={bt}>
            {bt ? `Tipo de sangre: ${bt}` : "Tipo de sangre"}
          </option>
        ))}
      </select>
      <Input
        className="border-outline-variant bg-surface"
        placeholder="Teléfono"
        value={values.phone}
        onChange={(e) => onChange("phone", e.target.value)}
      />
      <Input
        className="border-outline-variant bg-surface"
        placeholder="Teléfono de emergencia"
        value={values.emergencyPhone}
        onChange={(e) => onChange("emergencyPhone", e.target.value)}
      />
    </>
  );
}

function CreatePatientForm({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const managePatientsFn = useAction(manageSyntheticPatients);
  const [synthId, setSynthId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [documento, setDocumento] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [allergies, setAllergies] = useState("");
  const [profile, setProfile] = useState({
    nationality: "",
    heightCm: "",
    weightKg: "",
    ethnicity: "",
    bloodType: "",
    address: "",
    phone: "",
    emergencyPhone: "",
    insurance: "",
  });

  const setProfileField = (field: keyof typeof profile, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const handleCreate = run(
    () =>
      managePatientsFn({
        action: "CREATE",
        data: {
          syntheticId: synthId,
          firstName,
          lastName,
          birthDate: new Date(birthDate),
          sex,
          documento: documento || null,
          medicalHistory: medicalHistory || null,
          allergies: allergies || null,
          ...patientProfilePayload(profile),
        },
      }),
    notice,
    reportError,
  );

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          className="border-outline-variant bg-surface"
          placeholder="ID sintético (PAC-xxx)"
          value={synthId}
          onChange={(e) => setSynthId(e.target.value)}
        />
        <select
          className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
        >
          <option value="">Sexo (M/F/O)</option>
          <option value="M">Masculino (M)</option>
          <option value="F">Femenino (F)</option>
          <option value="O">Otro (O)</option>
        </select>
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Cédula o pasaporte (máx. 10)"
          maxLength={10}
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
        />
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
        <Input
          className="border-outline-variant bg-surface"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        <div />
        <Textarea
          className="border-outline-variant bg-surface sm:col-span-2"
          placeholder="Antecedentes médicos"
          rows={2}
          value={medicalHistory}
          onChange={(e) => setMedicalHistory(e.target.value)}
        />
        <Textarea
          className="border-outline-variant bg-surface sm:col-span-2"
          placeholder="Alergias"
          rows={2}
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
        />
        <ProfileFields values={profile} onChange={setProfileField} />
      </div>
      <div className="mt-3">
        <Button
          onClick={handleCreate}
          disabled={!synthId || !firstName || !lastName || !birthDate}
        >
          <UserPlus className="size-4" />
          Crear paciente
        </Button>
      </div>
    </div>
  );
}

function PatientsTab({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery(adminGetPatients, {
    search: search || undefined,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="border-outline-variant bg-surface pl-9"
            placeholder="Buscar por nombre o PAC-…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button onClick={() => setCreating((c) => !c)}>
          <Plus className="size-4" />
          Nuevo paciente
        </Button>
      </div>

      {creating && (
        <CreatePatientForm notice={notice} reportError={reportError} />
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">
            {error.message}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3">
          <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
            Pacientes sintéticos
          </p>
          <Badge variant="outline" className="mono-label">
            {data ? `${data.patients.length} resultado(s)` : "—"}
          </Badge>
        </div>

        <div className="divide-y divide-outline-variant/40">
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Cargando pacientes…
            </div>
          )}
          {data && data.patients.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              {search
                ? "Sin resultados para la búsqueda."
                : "No hay pacientes registrados."}
            </div>
          )}
          {data &&
            data.patients.length > 0 &&
            data.patients.map((patient: any) => (
              <div key={patient.id}>
                <div className="group flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                    {patient.firstName[0]}
                    {patient.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <Badge variant="outline" className="mono-label">
                        {patient.syntheticId}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{sexLabel(patient.sex)}</span>
                      <span>·</span>
                      <span>{patientAge(patient.birthDate)} años</span>
                      <span>·</span>
                      <span>
                        {patient.authorizedMedicos.length} médico(s) asignado(s)
                      </span>
                      {patient.allergies && patient.allergies.trim() !== "" && (
                        <>
                          <span>·</span>
                          <span className="text-warning">
                            Alergias: {patient.allergies}
                          </span>
                        </>
                      )}
                    </div>
                    {patient.authorizedMedicos.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {patient.authorizedMedicos.map((m: any) => (
                          <Badge
                            key={m.id}
                            variant="secondary"
                            className="mono-label text-[10px]"
                          >
                            {m.fullName ?? m.username ?? m.email}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        setEditingId(
                          editingId === patient.id ? null : patient.id,
                        )
                      }
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                  </div>
                </div>
                {editingId === patient.id && (
                  <EditPatientForm
                    patient={patient}
                    onCancel={() => setEditingId(null)}
                    notice={notice}
                    reportError={reportError}
                  />
                )}
              </div>
            ))}
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-outline-variant/50 bg-surface-container/60 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="mono-label text-xs">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Médicos
// ---------------------------------------------------------------------------

function CreateMedicoForm({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const createMedicoFn = useAction(adminCreateMedicoUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");

  const passwordRules = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Al menos un número", ok: /[0-9]/.test(password) },
  ];
  const passwordValid = passwordRules.every((r) => r.ok);

  const handleCreate = run(
    () =>
      createMedicoFn({
        email,
        password,
        fullName: fullName || undefined,
        specialty: specialty || undefined,
      }),
    notice,
    reportError,
  );

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          className="border-outline-variant bg-surface"
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Especialidad"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />
      </div>
      <ul className="mt-2 space-y-1">
        {passwordRules.map((rule) => (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${
              rule.ok ? "text-emerald-500" : "text-muted-foreground"
            }`}
          >
            {rule.ok ? "✓" : "○"} {rule.label}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button
          onClick={handleCreate}
          disabled={!email || !passwordValid}
        >
          <Stethoscope className="size-4" />
          Crear médico
        </Button>
      </div>
    </div>
  );
}

function EditMedicoForm({
  medico,
  onCancel,
  notice,
  reportError,
}: {
  medico: any;
  onCancel: () => void;
  notice: Notice;
  reportError: ReportError;
}) {
  const updateMedicoFn = useAction(adminUpdateMedicoUser);
  const [fullName, setFullName] = useState(medico.fullName ?? "");
  const [specialty, setSpecialty] = useState(medico.specialty ?? "");

  const handleSave = run(
    () =>
      updateMedicoFn({
        id: medico.id,
        fullName: fullName || undefined,
        specialty: specialty || undefined,
      }),
    notice,
    reportError,
  );

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          className="border-outline-variant bg-surface"
          placeholder="Especialidad"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={handleSave}>Guardar cambios</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function MedicosTab({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const [skipPages, setSkipPages] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [patientsForId, setPatientsForId] = useState<string | null>(null);
  const [agendaForId, setAgendaForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMedicoFn = useAction(adminDeleteMedicoUser);

  const { data, isLoading } = useQuery(getPaginatedUsers, {
    skipPages,
    filter: { isMedico: true },
  });

  const { data: doctorsData } = useQuery(getDoctorsAgenda, {});

  const { data: patientsData } = useQuery(adminGetPatients, {
    page: 1,
    pageSize: 50,
    ...(patientsForId ? { medicoId: patientsForId } : {}),
  });

  const doctorRows =
    doctorsData?.medicos.reduce<Record<string, any>>((acc, doctor) => {
      acc[doctor.id] = doctor;
      return acc;
    }, {}) ?? {};

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating((c) => !c)}>
          <UserPlus className="size-4" />
          Nuevo médico
        </Button>
      </div>

      {creating && (
        <CreateMedicoForm notice={notice} reportError={reportError} />
      )}

      <Card className="overflow-hidden border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3">
          <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
            Usuarios con rol Médico
          </p>
          <Badge variant="outline" className="mono-label">
            {data ? `${data.users.length} resultado(s)` : "—"}
          </Badge>
        </div>

        <div className="divide-y divide-outline-variant/40">
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Cargando médicos…
            </div>
          )}
          {data && data.users.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No hay médicos registrados.
            </div>
          )}
          {data &&
            data.users.length > 0 &&
            data.users.map((medico: any) => {
              const doctor = doctorRows[medico.id];
              const enCita = doctor?.currentStatus === "EN_CITA";
              return (
                <div key={medico.id}>
                  <div className="group flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                      {medico.fullName
                        ? medico.fullName[0]
                        : (medico.email ?? medico.username ?? "?")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {medico.fullName ?? medico.username ?? medico.email}
                        </span>
                        <Badge variant="success">Médico</Badge>
                        {doctor && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                              enCita
                                ? "border-warning/40 bg-warning/10 text-warning"
                                : "border-success/40 bg-success/10 text-success"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                enCita ? "bg-warning" : "bg-success"
                              }`}
                            />
                            {enCita ? "En cita" : "Desocupado"}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="mono-label">{medico.email}</span>
                        {medico.specialty && (
                          <>
                            <span>·</span>
                            <span>{medico.specialty}</span>
                          </>
                        )}
                        {doctor && (
                          <>
                            <span>·</span>
                            <span>
                              {doctor.pacientesAtendidos} paciente(s)
                              atendido(s)
                            </span>
                            <span>·</span>
                            <span>{doctor.atencionesHoy} de hoy</span>
                          </>
                        )}
                        {doctor && doctor.proximaCita && (
                          <>
                            <span>·</span>
                            <span>
                              próx.{" "}
                              {new Date(doctor.proximaCita).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          setAgendaForId(
                            agendaForId === medico.id ? null : medico.id,
                          )
                        }
                      >
                        <CalendarClock className="size-3.5" />
                        Agenda
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          setPatientsForId(
                            patientsForId === medico.id ? null : medico.id,
                          )
                        }
                      >
                        <ClipboardList className="size-3.5" />
                        Pacientes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          setEditingId(
                            editingId === medico.id ? null : medico.id,
                          )
                        }
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                      {deletingId === medico.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              try {
                                await deleteMedicoFn({ id: medico.id });
                                setDeletingId(null);
                                notice("Médico eliminado correctamente");
                              } catch (err: any) {
                                reportError(
                                  err?.message ?? "No se pudo eliminar",
                                );
                                setDeletingId(null);
                              }
                            }}
                          >
                            Confirmar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(null)}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-destructive"
                          onClick={() => setDeletingId(medico.id)}
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                  {agendaForId === medico.id && (
                    <MedicoAgendaPanel medicoId={medico.id} />
                  )}
                  {patientsForId === medico.id && (
                    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
                      <p className="mono-label mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                        Pacientes asignados
                      </p>
                      {patientsData && patientsData.patients.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Sin pacientes asignados.
                        </p>
                      )}
                      {patientsData && patientsData.patients.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {patientsData.patients.map((p: any) => (
                            <Badge
                              key={p.id}
                              variant="outline"
                              className="mono-label"
                            >
                              {p.firstName} {p.lastName} · {p.syntheticId}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {editingId === medico.id && (
                    <EditMedicoForm
                      medico={medico}
                      onCancel={() => setEditingId(null)}
                      notice={notice}
                      reportError={reportError}
                    />
                  )}
                </div>
              );
            })}
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-outline-variant/50 bg-surface-container/60 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={skipPages <= 0}
              onClick={() => setSkipPages((s) => Math.max(0, s - 1))}
            >
              Anterior
            </Button>
            <span className="mono-label text-xs">
              {skipPages + 1} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={skipPages + 1 >= data.totalPages}
              onClick={() => setSkipPages((s) => s + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Asignaciones
// ---------------------------------------------------------------------------

function AssignmentsTab({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const manageAccessFn = useAction(manageMedicoPatientAccess);
  const [medicoId, setMedicoId] = useState("");
  const [accessPatientId, setAccessPatientId] = useState("");
  const [accessAction, setAccessAction] = useState<"GRANT" | "REVOKE">("GRANT");

  const { data: medicos } = useQuery(getPaginatedUsers, {
    skipPages: 0,
    filter: { isMedico: true },
  });
  const { data: patientsData, refetch: refetchPatients } = useQuery(
    adminGetPatients,
    {
      page: 1,
      pageSize: 50,
    },
  );

  const handleApply = async () => {
    try {
      await manageAccessFn({
        action: accessAction,
        medicoId,
        patientId: accessPatientId,
      });
      await refetchPatients();
      notice(
        accessAction === "REVOKE"
          ? "Acceso revocado correctamente"
          : "Acceso otorgado correctamente",
      );
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo aplicar el acceso");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-4 text-primary" />
            Acceso Médico ↔ Paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
            >
              <option value="">Seleccione un médico…</option>
              {medicos?.users.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.fullName ?? m.username ?? m.email}
                  {m.specialty ? ` · ${m.specialty}` : ""}
                </option>
              ))}
            </select>
            <select
              className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
              value={accessPatientId}
              onChange={(e) => setAccessPatientId(e.target.value)}
            >
              <option value="">Seleccione un paciente…</option>
              {patientsData?.patients.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.syntheticId} · {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <Button
              onClick={handleApply}
              disabled={!medicoId || !accessPatientId}
            >
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3">
          <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
            Asignaciones actuales
          </p>
          <Badge variant="outline" className="mono-label">
            {patientsData ? `${patientsData.patients.length} paciente(s)` : "—"}
          </Badge>
        </div>
        <div className="divide-y divide-outline-variant/40">
          {patientsData && patientsData.patients.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No hay pacientes registrados.
            </div>
          )}
          {patientsData &&
            patientsData.patients.map((patient: any) => (
              <div key={patient.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <Badge variant="outline" className="mono-label">
                        {patient.syntheticId}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {patient.authorizedMedicos.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Sin médicos asignados.
                        </span>
                      )}
                      {patient.authorizedMedicos.map((m: any) => (
                        <div
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-md border border-outline-variant/60 bg-surface px-2 py-0.5"
                        >
                           <Badge
                             variant="secondary"
                             className="border-0 bg-transparent p-0"
                           >
                             {m.fullName ?? m.username ?? m.email}
                             {m.specialty ? ` · ${m.specialty}` : ""}
                           </Badge>
                          <button
                            type="button"
                            aria-label={`Revocar acceso a ${
                              m.fullName ?? m.email
                            }`}
                            className="text-destructive transition-opacity hover:opacity-70"
                            onClick={() => {
                              const p = patient;
                              setMedicoId(m.id);
                              setAccessPatientId(p.id);
                              setAccessAction("REVOKE");
                              notice(
                                "Seleccione Aplicar para confirmar la revocación",
                              );
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setMedicoId("");
                      setAccessPatientId(patient.id);
                      setAccessAction("GRANT");
                      notice("Seleccione el médico y Aplicar para asignar");
                    }}
                  >
                    <Plus className="size-3.5" />
                    Asignar
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Citas (agendamiento para cada doctor)
// ---------------------------------------------------------------------------

function citaBadgeVariant(status: string) {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "warning";
  if (status === "CANCELLED") return "destructive";
  return "outline";
}

function AdminCitaBadge({ status }: { status: string }) {
  return (
    <Badge variant={citaBadgeVariant(status) as any} className="mono-label">
      {citaStatusLabel(status)}
    </Badge>
  );
}

function AdminScheduleForm({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const manageCitaFn = useAction(manageCita);
  const { data: medicos } = useQuery(getPaginatedUsers, {
    skipPages: 0,
    filter: { isMedico: true },
  });
  const { data: patientsData } = useQuery(adminGetPatients, {
    page: 1,
    pageSize: 100,
  });
  const [medicoId, setMedicoId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!medicoId || !patientId || !scheduledAt) return;
    setBusy(true);
    try {
      await manageCitaFn({
        action: "CREATE",
        data: {
          medicoId,
          patientId,
          scheduledAt: new Date(scheduledAt),
          durationMinutes: Number(durationMinutes) || 30,
          reason: reason || undefined,
        },
      });
      notice("Cita programada correctamente");
      setPatientId("");
      setScheduledAt("");
      setReason("");
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo programar la cita");
    } finally {
      setBusy(false);
    }
  };

  const patientOptions = patientsData?.patients ?? [];

  return (
    <Card className="overflow-hidden border-outline-variant">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="size-4 text-primary" />
          Programar cita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
            value={medicoId}
            onChange={(e) => setMedicoId(e.target.value)}
          >
            <option value="">Seleccione el médico…</option>
            {medicos?.users.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.fullName ?? m.username ?? m.email}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 w-full rounded-md border border-outline-variant bg-surface px-3 py-1 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Seleccione el paciente…</option>
            {patientOptions.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.syntheticId} · {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          <Input
            className="border-outline-variant bg-surface"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <Input
            className="border-outline-variant bg-surface"
            type="number"
            min={5}
            max={240}
            placeholder="Duración (min)"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
          <Input
            className="border-outline-variant bg-surface sm:col-span-2"
            placeholder="Motivo de la cita (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={busy || !medicoId || !patientId || !scheduledAt}
        >
          <Plus className="size-4" />
          Programar cita
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminCitasTab({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const { data: agenda, isLoading } = useQuery(getAgenda, {});
  const manageCitaFn = useAction(manageCita);
  const updateStatusFn = useAction(updateCitaStatus);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runTransition = async (
    citaId: string,
    status: string,
    label: string,
  ) => {
    setBusyId(citaId);
    try {
      await updateStatusFn({ citaId, status });
      notice(label);
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo actualizar la cita");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cita: any) => {
    setBusyId(cita.id);
    try {
      await manageCitaFn({ action: "DELETE", citaId: cita.id });
      notice("Cita eliminada");
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo eliminar la cita");
    } finally {
      setBusyId(null);
    }
  };

  const sorted = [...(agenda?.citas ?? [])].sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  return (
    <div className="space-y-4">
      <AdminScheduleForm notice={notice} reportError={reportError} />

      <Card className="overflow-hidden border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3">
          <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
            Citas de todos los médicos
          </p>
          <Badge variant="outline" className="mono-label">
            {agenda ? `${sorted.length} cita(s)` : "—"}
          </Badge>
        </div>

        <div className="divide-y divide-outline-variant/40">
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Cargando citas…
            </div>
          )}
          {agenda && sorted.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Sin citas en el período.
            </div>
          )}
          {agenda &&
            sorted.length > 0 &&
            sorted.map((cita: any) => (
              <div
                key={cita.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <CalendarDays className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {cita.medico.fullName ?? cita.medico.email}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm font-medium text-foreground">
                      {cita.patient.firstName} {cita.patient.lastName}
                    </span>
                    <Badge variant="outline" className="mono-label">
                      {cita.patient.syntheticId}
                    </Badge>
                    <AdminCitaBadge status={cita.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {new Date(cita.scheduledAt).toLocaleString()}
                    </span>
                    <span>· {cita.durationMinutes} min</span>
                    {cita.reason && <span>· {cita.reason}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {cita.status === "SCHEDULED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === cita.id}
                        onClick={() =>
                          runTransition(cita.id, "IN_PROGRESS", "Cita iniciada")
                        }
                      >
                        <Activity className="size-3.5" />
                        Iniciar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === cita.id}
                        onClick={() =>
                          runTransition(cita.id, "NO_SHOW", "No asistió")
                        }
                      >
                        <PhoneMissed className="size-3.5" />
                        No asistió
                      </Button>
                    </>
                  )}
                  {cita.status === "IN_PROGRESS" && (
                    <Button
                      size="sm"
                      disabled={busyId === cita.id}
                      onClick={() =>
                        runTransition(cita.id, "COMPLETED", "Cita completada")
                      }
                    >
                      <CheckCircle2 className="size-3.5" />
                      Completar
                    </Button>
                  )}
                  {(cita.status === "SCHEDULED" ||
                    cita.status === "IN_PROGRESS") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === cita.id}
                      onClick={() =>
                        runTransition(cita.id, "CANCELLED", "Cita cancelada")
                      }
                    >
                      <XCircle className="size-3.5" />
                      Cancelar
                    </Button>
                  )}
                  {cita.status !== "COMPLETED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={busyId === cita.id}
                      onClick={() => handleDelete(cita)}
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

type TabKey = "pacientes" | "medicos" | "asignaciones" | "citas";

export function ClinicalAdminPage() {
  const { data: user } = useAuth();
  const [tab, setTab] = useState<TabKey>("pacientes");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reportError = (message: string) => {
    setNotice(null);
    setError(message);
  };
  const showNotice = (message: string) => {
    setError(null);
    setNotice(message);
  };

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

  const tabs: { key: TabKey; label: string; icon: ReactNode }[] = [
    {
      key: "pacientes",
      label: "Pacientes",
      icon: <Users className="size-4" />,
    },
    {
      key: "medicos",
      label: "Médicos",
      icon: <Stethoscope className="size-4" />,
    },
    {
      key: "asignaciones",
      label: "Asignaciones",
      icon: <KeyRound className="size-4" />,
    },
    {
      key: "citas",
      label: "Citas",
      icon: <CalendarClock className="size-4" />,
    },
  ];

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
          Gestión de pacientes sintéticos, médicos y asignaciones de acceso.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-outline-variant bg-surface-container/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${TAB_CLASS} ${
              tab === t.key ? TAB_ACTIVE : TAB_IDLE
            } inline-flex items-center gap-1.5`}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <StatusBanner error={error} notice={notice} />

      {tab === "pacientes" && (
        <PatientsTab notice={showNotice} reportError={reportError} />
      )}
      {tab === "medicos" && (
        <MedicosTab notice={showNotice} reportError={reportError} />
      )}
      {tab === "asignaciones" && (
        <AssignmentsTab notice={showNotice} reportError={reportError} />
      )}
      {tab === "citas" && (
        <AdminCitasTab notice={showNotice} reportError={reportError} />
      )}
    </div>
  );
}
