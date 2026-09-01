import { useState, useRef, useEffect, type ReactNode } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import { useConfirm } from "../../client/hooks/use-confirm";
import { RoleGuard } from "../../client/components/RoleGuard";
import {
  adminCreateMedicoUser,
  adminDeleteMedicoUser,
  adminGetPatients,
  adminUpdateMedicoUser,
  getAgenda,
  getAvailableSlots,
  getDoctorsAgenda,
  getPaginatedUsers,
  manageCita,
  manageMedicoPatientAccess,
  manageSyntheticPatients,
  updateCitaStatus,
  getPendingLinkRequests,
  approvePatientLinkRequest,
  rejectPatientLinkRequest,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Activity,
  AlertCircle,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit3,
  ExternalLink,
  KeyRound,
  Pencil,
  PhoneMissed,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Stethoscope,
  Trash2,
  UserCheck,
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
import { EditAppointmentModal } from "../components/EditAppointmentModal";

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
  onDismiss,
}: {
  error: string | null;
  notice: string | null;
  onDismiss?: () => void;
}) {
  if (!error && !notice) return null;
  const isError = Boolean(error);
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm transition-all animate-in fade-in slide-in-from-top-1 ${isError
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-success/40 bg-success/10 text-success"
        }`}
    >
      <div className="flex items-center gap-2.5">
        {isError ? (
          <AlertCircle className="size-4 shrink-0" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0" />
        )}
        <span className="font-medium">{error ?? notice}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
          title="Cerrar notificación"
        >
          <XCircle className="size-4" />
        </button>
      )}
    </div>
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
    emergencyName: patient.emergencyName ?? "",
    emergencyPhone: patient.emergencyPhone ?? "",
    insurance: patient.insurance ?? "",
  });

  const setProfileField = (field: keyof typeof profile, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      reportError("Nombre y apellido son requeridos");
      return;
    }
    if (!birthDate || !sex) {
      reportError("Fecha de nacimiento y sexo son requeridos");
      return;
    }
    const cleanDoc = documento.trim() ? documento.trim().slice(0, 10) : null;
    try {
      await managePatientsFn({
        action: "UPDATE",
        patientId: patient.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate: new Date(`${birthDate}T00:00:00`),
          sex,
          documento: cleanDoc,
          medicalHistory: medicalHistory.trim() || null,
          allergies: allergies.trim() || null,
          ...patientProfilePayload(profile),
        },
      });
      notice("Paciente actualizado correctamente");
      onCancel();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo actualizar el paciente");
    }
  };

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
  emergencyName: string;
  emergencyPhone: string;
  insurance: string;
}) {
  const h = data.heightCm?.trim() ? Number(data.heightCm) : null;
  const w = data.weightKg?.trim() ? Number(data.weightKg) : null;
  return {
    nationality: data.nationality?.trim() || null,
    heightCm: h !== null && !isNaN(h) && h > 0 ? Math.round(h) : null,
    weightKg: w !== null && !isNaN(w) && w > 0 ? Math.round(w) : null,
    ethnicity: data.ethnicity?.trim() || null,
    bloodType: data.bloodType || null,
    address: data.address?.trim() || null,
    phone: data.phone?.trim() || null,
    emergencyName: data.emergencyName?.trim() || null,
    emergencyPhone: data.emergencyPhone?.trim() || null,
    insurance: data.insurance?.trim() || null,
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
    emergencyName: string;
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
        placeholder="Nombre del contacto de emergencia"
        value={values.emergencyName}
        onChange={(e) => onChange("emergencyName", e.target.value)}
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
  onCreated,
}: {
  notice: Notice;
  reportError: ReportError;
  onCreated?: () => void;
}) {
  const managePatientsFn = useAction(manageSyntheticPatients);
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
    emergencyName: "",
    emergencyPhone: "",
    insurance: "",
  });

  const setProfileField = (field: keyof typeof profile, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      reportError("Nombre y apellido son obligatorios");
      return;
    }
    if (!birthDate || !sex) {
      reportError("Fecha de nacimiento y sexo son obligatorios");
      return;
    }
    const cleanDoc = documento.trim() ? documento.trim().slice(0, 10) : null;
    try {
      await managePatientsFn({
        action: "CREATE",
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate: new Date(`${birthDate}T00:00:00`),
          sex,
          documento: cleanDoc,
          medicalHistory: medicalHistory.trim() || null,
          allergies: allergies.trim() || null,
          ...patientProfilePayload(profile),
        },
      });
      notice("Paciente creado correctamente");
      onCreated?.();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo crear el paciente");
    }
  };

  return (
    <div className="border-b border-outline-variant/40 bg-surface/40 px-6 py-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          disabled={!firstName || !lastName || !birthDate}
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

  const { data, isLoading, error, refetch } = useQuery(adminGetPatients, {
    search: search || undefined,
    page,
    pageSize: 20,
  });
  const managePatientsFn = useAction(manageSyntheticPatients);
  const { confirm, ConfirmDialog } = useConfirm();

  const handleDelete = async (id: string, label: string) => {
    const ok = await confirm({
      title: "¿Eliminar paciente sintético?",
      description: `Se desactivará a ${label} de las vistas clínicas. Esta acción no se puede deshacer.`,
      confirmText: "Sí, eliminar",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await managePatientsFn({ action: "DELETE", patientId: id, data: {} });
      notice("Paciente eliminado correctamente");
      await refetch();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo eliminar el paciente");
    }
  };

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
        <CreatePatientForm
          notice={notice}
          reportError={reportError}
          onCreated={() => {
            setCreating(false);
            refetch();
          }}
        />
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        handleDelete(
                          patient.id,
                          `${patient.firstName} ${patient.lastName}`,
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
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
      {ConfirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Médicos
// ---------------------------------------------------------------------------

function CreateMedicoForm({
  notice,
  reportError,
  onSuccess,
}: {
  notice: Notice;
  reportError: ReportError;
  onSuccess?: () => void;
}) {
  const createMedicoFn = useAction(adminCreateMedicoUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordRules = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Al menos una mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Al menos un número", ok: /[0-9]/.test(password) },
  ];
  const passwordValid = passwordRules.every((r) => r.ok);

  const handleCreate = async () => {
    setBusy(true);
    try {
      await createMedicoFn({
        email,
        password,
        fullName: fullName || undefined,
        specialty: specialty || undefined,
      });
      notice("Médico creado exitosamente");
      setEmail("");
      setPassword("");
      setFullName("");
      setSpecialty("");
      onSuccess?.();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo crear el médico");
    } finally {
      setBusy(false);
    }
  };

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
            className={`flex items-center gap-1.5 text-xs ${rule.ok ? "text-emerald-500" : "text-muted-foreground"
              }`}
          >
            {rule.ok ? "✓" : "○"} {rule.label}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button
          onClick={handleCreate}
          disabled={busy || !email || !passwordValid}
        >
          <Stethoscope className="size-4" />
          {busy ? "Creando médico…" : "Crear médico"}
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
  onSuccess,
}: {
  medico: any;
  onCancel: () => void;
  notice: Notice;
  reportError: ReportError;
  onSuccess?: () => void;
}) {
  const updateMedicoFn = useAction(adminUpdateMedicoUser);
  const [fullName, setFullName] = useState(medico.fullName ?? "");
  const [specialty, setSpecialty] = useState(medico.specialty ?? "");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await updateMedicoFn({
        id: medico.id,
        fullName: fullName || undefined,
        specialty: specialty || undefined,
      });
      notice("Médico actualizado correctamente");
      onSuccess?.();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo actualizar el médico");
    } finally {
      setBusy(false);
    }
  };

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
        <Button onClick={handleSave} disabled={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
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
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [patientsForId, setPatientsForId] = useState<string | null>(null);
  const [agendaForId, setAgendaForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const deleteMedicoFn = useAction(adminDeleteMedicoUser);
  const updateMedicoFn = useAction(adminUpdateMedicoUser);

  const { data, isLoading, refetch } = useQuery(getPaginatedUsers, {
    skipPages,
    filter: {
      isActive: statusFilter === "ACTIVE",
      isMedico: statusFilter === "ACTIVE" ? true : undefined,
    },
  });

  const { data: doctorsData, refetch: refetchDoctors } = useQuery(
    getDoctorsAgenda,
    {},
  );

  const reloadData = async () => {
    await Promise.all([refetch(), refetchDoctors()]);
  };

  const handleReactivate = async (medico: any) => {
    setReactivatingId(medico.id);
    try {
      await updateMedicoFn({
        id: medico.id,
        isActive: true,
      });
      notice(`Médico ${medico.fullName || medico.email} reactivado correctamente`);
      await reloadData();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo reactivar el médico");
    } finally {
      setReactivatingId(null);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-surface/50 p-1">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ACTIVE");
              setSkipPages(0);
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${statusFilter === "ACTIVE"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Médicos Activos
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("INACTIVE");
              setSkipPages(0);
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${statusFilter === "INACTIVE"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Inactivos / Por reactivar
          </button>
        </div>

        <Button onClick={() => setCreating((c) => !c)}>
          <UserPlus className="size-4" />
          Nuevo médico
        </Button>
      </div>

      {creating && (
        <CreateMedicoForm
          notice={notice}
          reportError={reportError}
          onSuccess={() => {
            setCreating(false);
            reloadData();
          }}
        />
      )}

      <Card className="overflow-hidden border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3">
          <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
            {statusFilter === "ACTIVE"
              ? "Usuarios activos con rol Médico"
              : "Médicos inactivos / dados de baja"}
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
              {statusFilter === "ACTIVE"
                ? "No hay médicos registrados activos."
                : "No hay médicos inactivos actualmente."}
            </div>
          )}
          {data &&
            data.users.length > 0 &&
            data.users.map((medico: any) => {
              const doctor = doctorRows[medico.id];
              const enCita = doctor?.currentStatus === "EN_CITA";
              const isInactive = !medico.isActive || statusFilter === "INACTIVE";

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
                        {isInactive ? (
                          <Badge variant="destructive">Inactivo</Badge>
                        ) : (
                          <Badge variant="success">Médico</Badge>
                        )}
                        {!isInactive && doctor && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${enCita
                                ? "border-warning/40 bg-warning/10 text-warning"
                                : "border-success/40 bg-success/10 text-success"
                              }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${enCita ? "bg-warning" : "bg-success"
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
                        {!isInactive && doctor && (
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
                        {!isInactive && doctor && doctor.proximaCita && (
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
                      {isInactive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                          disabled={reactivatingId === medico.id}
                          onClick={() => handleReactivate(medico)}
                        >
                          <RotateCcw className="size-3.5" />
                          {reactivatingId === medico.id
                            ? "Reactivando…"
                            : "Reactivar cuenta"}
                        </Button>
                      ) : (
                        <>
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
                            Estadística
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "¿Desactivar cuenta médica?",
                                description: `Se retirará el acceso clínico de ${medico.fullName || medico.email}. Sus notas históricas se conservarán intactas.`,
                                confirmText: "Desactivar médico",
                                variant: "destructive",
                              });
                              if (!ok) return;

                              try {
                                await deleteMedicoFn({ id: medico.id });
                                notice("Médico desactivado correctamente");
                                await reloadData();
                              } catch (err: any) {
                                reportError(
                                  err?.message ?? "No se pudo desactivar el médico",
                                );
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            Eliminar
                          </Button>
                        </>
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
                      onSuccess={() => {
                        setEditingId(null);
                        reloadData();
                      }}
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
      {ConfirmDialog}
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
  const { confirm, ConfirmDialog } = useConfirm();
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

  const handleRevoke = async (
    medicoIdValue: string,
    patientIdValue: string,
    label: string,
  ) => {
    const ok = await confirm({
      title: "¿Revocar acceso médico?",
      description: `Se revocará el acceso clínico de ${label}. El médico ya no podrá registrar nuevas notas para este paciente.`,
      confirmText: "Revocar acceso",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await manageAccessFn({
        action: "REVOKE",
        medicoId: medicoIdValue,
        patientId: patientIdValue,
      });
      await refetchPatients();
      notice("Acceso revocado de " + label + " correctamente");
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo revocar el acceso");
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
                            aria-label={`Revocar acceso a ${m.fullName ?? m.email
                              }`}
                            className="text-destructive transition-opacity hover:opacity-70"
                            onClick={() =>
                              handleRevoke(
                                m.id,
                                patient.id,
                                m.fullName ?? m.email ?? "el médico",
                              )
                            }
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
        {ConfirmDialog}
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Duración estándar fijada a 30 minutos
  const DURATION_MINUTES = 30;

  const { data: slotsData, isLoading: loadingSlots } = useQuery(
    getAvailableSlots,
    medicoId && date
      ? { medicoId, date, durationMinutes: DURATION_MINUTES }
      : undefined,
  );

  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Horario de atención 24h: slots cada 30 minutos, 00:00 a 23:30.
  const SLOTS: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ["00", "30"]) {
      SLOTS.push(`${String(h).padStart(2, "0")}:${m}`);
    }
  }

  const buildScheduledAt = () => {
    if (!date || !time) return null;
    return new Date(`${date}T${time}:00`);
  };

  const isSlotPast = (slotTime: string) =>
    new Date(`${date}T${slotTime}:00`).getTime() <= Date.now();

  const isSlotBusy = (slotTime: string) => {
    if (!medicoId || !date) return false;
    if (slotsData) {
      return !slotsData.freeSlots.includes(slotTime);
    }
    return false;
  };

  const handleCreate = async () => {
    const at = buildScheduledAt();
    if (!medicoId || !patientId || !at || !time) {
      reportError("Por favor complete médico, paciente, fecha y hora de la cita.");
      return;
    }
    if (isSlotPast(time)) {
      reportError("No se puede programar una cita en el pasado.");
      return;
    }
    if (isSlotBusy(time)) {
      reportError(
        "El horario seleccionado ya está ocupado por este médico. Elige otro horario disponible.",
      );
      return;
    }

    setBusy(true);
    try {
      await manageCitaFn({
        action: "CREATE",
        data: {
          medicoId,
          patientId,
          scheduledAt: at,
          durationMinutes: DURATION_MINUTES,
          reason: reason.trim() || undefined,
        },
      });
      notice("Cita programada correctamente");
      setPatientId("");
      setTime("");
      setReason("");
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo programar la cita");
    } finally {
      setBusy(false);
    }
  };

  const patientOptions = patientsData?.patients ?? [];

  return (
    <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md">
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
            onChange={(e) => {
              setMedicoId(e.target.value);
              setTime("");
            }}
          >
            <option value="">Seleccione el médico…</option>
            {medicos?.users.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.fullName ?? m.username ?? m.email}
                {m.specialty ? ` · ${m.specialty}` : ""}
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
            className="border-outline-variant bg-surface sm:col-span-2"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
          />
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
                Horarios de atención (30 min por turno)
              </p>
              {medicoId && date && (
                <span className="text-[11px] text-muted-foreground">
                  {loadingSlots
                    ? "Consultando disponibilidad…"
                    : `${slotsData?.freeSlots.length ?? 0} horarios libres`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 max-h-40 overflow-y-auto p-1">
              {SLOTS.map((s) => {
                const past = isSlotPast(s);
                const busySlot = isSlotBusy(s);
                const isUnavailable = past || busySlot;
                const selected = time === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => setTime(s)}
                    title={
                      busySlot
                        ? "Horario ocupado por otra cita"
                        : past
                          ? "Horario pasado"
                          : "Disponible"
                    }
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${selected
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,218,243,0.3)] font-bold"
                        : busySlot
                          ? "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive/70 line-through"
                          : past
                            ? "cursor-not-allowed border-outline-variant/40 bg-surface/30 text-muted-foreground/40"
                            : "border-outline-variant bg-surface text-foreground hover:border-primary"
                      }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            className="border-outline-variant bg-surface sm:col-span-2"
            placeholder="Motivo de la cita (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={busy || !medicoId || !patientId || !time}
        >
          <Plus className="size-4" />
          {busy ? "Programando…" : "Programar cita"}
        </Button>
      </CardContent>
    </Card>
  );
}

function getGoogleCalendarUrl(cita: any) {
  const start = new Date(cita.scheduledAt);
  const end = new Date(start.getTime() + (cita.durationMinutes || 30) * 60 * 1000);
  const formatGDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const title = encodeURIComponent(`Cita Médica: ${cita.patient?.firstName} ${cita.patient?.lastName} (${cita.patient?.syntheticId})`);
  const details = encodeURIComponent(
    `Cita Médica DoctorIA\nPaciente: ${cita.patient?.firstName} ${cita.patient?.lastName} (${cita.patient?.syntheticId})\nMédico: ${cita.medico?.fullName || cita.medico?.email}\nMotivo: ${cita.reason || "Consulta médica general"}\nEstado: ${cita.status}`
  );
  const location = encodeURIComponent("Consultorio DoctorIA");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGDate(start)}/${formatGDate(end)}&details=${details}&location=${location}`;
}

function AdminCitasTab({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const { data: agenda, isLoading, refetch } = useQuery(getAgenda, {});
  const manageCitaFn = useAction(manageCita);
  const updateStatusFn = useAction(updateCitaStatus);
  const { confirm, ConfirmDialog } = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingCita, setEditingCita] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [calDate, setCalDate] = useState<Date>(new Date());
  const [selectedDayCitas, setSelectedDayCitas] = useState<any[] | null>(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string | null>(null);

  const runTransition = async (
    citaId: string,
    status: string,
    label: string,
  ) => {
    setBusyId(citaId);
    try {
      await updateStatusFn({ citaId, status });
      notice(label);
      await refetch();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo actualizar la cita");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cita: any) => {
    const ok = await confirm({
      title: "¿Eliminar esta cita?",
      description: `Se eliminará la cita de ${cita.patient?.firstName} ${cita.patient?.lastName} (${new Date(cita.scheduledAt).toLocaleString()}).`,
      confirmText: "Eliminar cita",
      variant: "destructive",
    });
    if (!ok) return;

    setBusyId(cita.id);
    try {
      await manageCitaFn({ action: "DELETE", citaId: cita.id });
      notice("Cita eliminada");
      await refetch();
    } catch (err: any) {
      reportError(err?.message ?? "No se pudo eliminar la cita");
    } finally {
      setBusyId(null);
    }
  };

  const allCitas = agenda?.citas ?? [];
  const sorted = [...allCitas].sort(
    (a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  // Generador de cuadrícula del mes
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Lunes = 0

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const prevMonth = () => setCalDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalDate(new Date(year, month + 1, 1));
  const todayMonth = () => setCalDate(new Date());

  const getCitasForDay = (day: number) => {
    return allCitas.filter((c: any) => {
      const d = new Date(c.scheduledAt);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() === day
      );
    });
  };

  return (
    <div className="space-y-4">
      <AdminScheduleForm notice={notice} reportError={reportError} />

      <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3 gap-3">
          <div className="flex items-center gap-3">
            <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
              Agenda Médica · {agenda ? `${sorted.length} cita(s)` : "—"}
            </p>
            <div className="flex items-center rounded-lg border border-outline-variant bg-surface p-0.5 text-xs">
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("calendar")}
              >
                <Calendar className="size-3.5" />
                Calendario
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("list")}
              >
                <ClipboardList className="size-3.5" />
                Lista
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shadow-sm"
            >
              <ExternalLink className="size-3.5" />
              Abrir Google Calendar
            </a>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <div className="p-4 space-y-4">
            {/* Header del Calendario */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground capitalize">
                  {monthNames[month]} {year}
                </h3>
                <Button size="sm" variant="ghost" onClick={todayMonth} className="text-xs h-7 px-2">
                  Hoy
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={prevMonth} className="size-7 p-0">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={nextMonth} className="size-7 p-0">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Cuadrícula de Días */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-1 font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}

              {/* Días vacíos iniciales */}
              {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[75px] rounded-md border border-transparent p-1 bg-surface-container/10 opacity-30" />
              ))}

              {/* Días del mes */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayCitas = getCitasForDay(dayNum);
                const isToday =
                  new Date().getDate() === dayNum &&
                  new Date().getMonth() === month &&
                  new Date().getFullYear() === year;

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => {
                      if (dayCitas.length > 0) {
                        setSelectedDayCitas(dayCitas);
                        setSelectedDayLabel(`${dayNum} de ${monthNames[month]} ${year}`);
                      }
                    }}
                    className={`min-h-[75px] rounded-md border p-1 text-left transition-all flex flex-col justify-between ${
                      dayCitas.length > 0
                        ? "cursor-pointer hover:border-primary/60 hover:bg-primary/5 bg-surface"
                        : "bg-surface/30"
                    } ${
                      isToday
                        ? "border-primary font-bold shadow-sm bg-primary/10"
                        : "border-outline-variant/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {dayNum}
                      </span>
                      {dayCitas.length > 0 && (
                        <span className="text-[10px] rounded-full bg-primary/20 text-primary px-1.5 py-0.2 font-mono">
                          {dayCitas.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5 mt-1 overflow-hidden">
                      {dayCitas.slice(0, 2).map((c: any) => (
                        <div
                          key={c.id}
                          className="truncate rounded px-1 py-0.5 text-[9px] font-medium bg-primary/15 text-primary border border-primary/20"
                          title={`${new Date(c.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${c.patient.firstName} ${c.patient.lastName}`}
                        >
                          {new Date(c.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {c.patient.firstName}
                        </div>
                      ))}
                      {dayCitas.length > 2 && (
                        <div className="text-[9px] text-muted-foreground text-center">
                          +{dayCitas.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detalle de Citas del Día Seleccionado en el Calendario */}
            {selectedDayCitas && (
              <div className="rounded-xl border border-primary/30 bg-surface p-4 space-y-3 animate-in fade-in shadow-lg">
                <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    Citas del {selectedDayLabel} ({selectedDayCitas.length})
                  </h4>
                  <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => setSelectedDayCitas(null)}>
                    <XCircle className="size-4" />
                  </Button>
                </div>

                <div className="divide-y divide-outline-variant/40">
                  {selectedDayCitas.map((cita: any) => (
                    <div key={cita.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {new Date(cita.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {cita.patient.firstName} {cita.patient.lastName} ({cita.patient.syntheticId})
                          </span>
                          <AdminCitaBadge status={cita.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Médico: {cita.medico.fullName ?? cita.medico.email} · {cita.durationMinutes} min
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={getGoogleCalendarUrl(cita)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs border border-primary/40 bg-primary/10 px-2 py-1 rounded-md text-primary hover:bg-primary/20 transition-colors"
                        >
                          <ExternalLink className="size-3" />
                          Google Calendar
                        </a>
                        {cita.status === "SCHEDULED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => runTransition(cita.id, "IN_PROGRESS", "Cita iniciada")}
                          >
                            Iniciar
                          </Button>
                        )}
                        {cita.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => runTransition(cita.id, "COMPLETED", "Cita completada")}
                          >
                            Completar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
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
                  <div className="flex shrink-0 flex-wrap gap-1.5 items-center">
                    <a
                      href={getGoogleCalendarUrl(cita)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs border border-primary/40 bg-primary/10 px-2.5 py-1.5 rounded-md text-primary hover:bg-primary/20 transition-colors shadow-sm font-medium"
                      title="Añadir a Google Calendar"
                    >
                      <ExternalLink className="size-3.5" />
                      Google Calendar
                    </a>

                    {cita.status === "SCHEDULED" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === cita.id}
                          onClick={() => setEditingCita(cita)}
                          className="gap-1 text-xs"
                        >
                          <Edit3 className="size-3.5" />
                          Editar
                        </Button>
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
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
        )}
      </Card>

      {editingCita && (
        <EditAppointmentModal
          open={Boolean(editingCita)}
          onOpenChange={(v) => !v && setEditingCita(null)}
          cita={editingCita}
          onDone={() => refetch()}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Solicitudes de Vinculación de Pacientes (Fase Producción)
// ---------------------------------------------------------------------------

function PendingLinkRequestsTab({
  notice,
  reportError,
}: {
  notice: Notice;
  reportError: ReportError;
}) {
  const { data: requests, isLoading, refetch } = useQuery(getPendingLinkRequests);
  const { data: patientsData } = useQuery(adminGetPatients, { page: 1, pageSize: 100 });
  const approveFn = useAction(approvePatientLinkRequest);
  const rejectFn = useAction(rejectPatientLinkRequest);
  const { confirm, ConfirmDialog } = useConfirm();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<Record<string, string>>({});

  // Modal para Crear Nueva Ficha y Aprobar
  const [newPatientModalReq, setNewPatientModalReq] = useState<any | null>(null);
  const [newPatientData, setNewPatientData] = useState<{
    firstName: string;
    lastName: string;
    birthDate: string;
    sex: "M" | "F" | "OTHER";
    allergies: string;
    medicalHistory: string;
  }>({
    firstName: "",
    lastName: "",
    birthDate: "1990-01-01",
    sex: "M",
    allergies: "",
    medicalHistory: "",
  });

  const allPatients = patientsData?.patients || [];
  const unlinkedPatients = allPatients.filter((p: any) => !p.userId);
  const availablePatients = unlinkedPatients.length > 0 ? unlinkedPatients : allPatients;

  const handleApproveExisting = async (req: any) => {
    const targetId = req.patient?.id || selectedPatientId[req.id];
    if (!targetId) {
      reportError("Por favor selecciona una ficha de paciente en el menú desplegable antes de vincular.");
      return;
    }

    const patientToLink = req.patient || availablePatients.find((p: any) => p.id === targetId);
    const patientName = patientToLink
      ? `${patientToLink.firstName} ${patientToLink.lastName} (${patientToLink.syntheticId})`
      : "el paciente seleccionado";

    const ok = await confirm({
      title: "¿Vincular y aprobar paciente?",
      description: `Se vinculará la cuenta del usuario ${req.user?.email} con la ficha médica existente de ${patientName}. El paciente obtendrá acceso inmediato a su historial y citas.`,
      confirmText: "Aprobar Vinculación",
      cancelText: "Cancelar",
      variant: "default",
    });
    if (!ok) return;

    setBusyId(req.id);
    try {
      await approveFn({ requestId: req.id, patientId: targetId });
      notice("Vinculación de paciente aprobada exitosamente");
      refetch();
    } catch (err: any) {
      reportError(err?.message || "No se pudo aprobar la vinculación");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAndApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientModalReq) return;

    setBusyId(newPatientModalReq.id);
    try {
      const res: any = await approveFn({
        requestId: newPatientModalReq.id,
        createNewPatient: true,
        newPatientData: {
          firstName: newPatientData.firstName.trim() || undefined,
          lastName: newPatientData.lastName.trim() || undefined,
          birthDate: newPatientData.birthDate,
          sex: newPatientData.sex,
          allergies: newPatientData.allergies.trim() || undefined,
          medicalHistory: newPatientData.medicalHistory.trim() || undefined,
        },
      });
      notice(`Ficha médica (${res?.syntheticId || "creada"}) creada y vinculada exitosamente.`);
      setNewPatientModalReq(null);
      refetch();
    } catch (err: any) {
      reportError(err?.message || "No se pudo crear la ficha del paciente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setBusyId(requestId);
    try {
      await rejectFn({ requestId, reason: rejectionReason.trim() || undefined });
      notice("Solicitud de vinculación rechazada");
      setRejectModalId(null);
      setRejectionReason("");
      refetch();
    } catch (err: any) {
      reportError(err?.message || "No se pudo rechazar la solicitud");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-outline-variant">
        <CardContent className="p-8 text-center text-xs text-muted-foreground">
          Cargando solicitudes pendientes...
        </CardContent>
      </Card>
    );
  }

  const list = requests || [];

  return (
    <div className="space-y-4">
      <Card className="border-outline-variant shadow-sm">
        <CardHeader className="border-b border-outline-variant/60 bg-surface-container/40 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-primary" />
              Solicitudes de Vinculación de Pacientes ({list.length})
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              {list.length} pendientes
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-outline-variant/40">
          {list.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <CheckCircle2 className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-medium text-foreground">No hay solicitudes pendientes</p>
              <p>Todas las solicitudes de vinculación han sido procesadas.</p>
            </div>
          ) : (
            list.map((req: any) => (
              <div
                key={req.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-surface-container/20 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  {req.patient ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {req.patient.firstName} {req.patient.lastName}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-outline-variant">
                        {req.patient.syntheticId}
                      </Badge>
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        {req.documentType}: {req.requestedDocument || "Registrado"}
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-amber-300">
                          Documento Solicitado: {req.requestedDocument || "(Sin especificar)"}
                        </span>
                        <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          {req.documentType} ({req.paisEmisor || "EC"})
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                          Nuevo Paciente
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          O vincular a ficha existente:
                        </label>
                        <select
                          className="text-xs bg-surface border border-primary/40 rounded-md px-3 py-1.5 text-foreground font-medium focus:ring-1 focus:ring-primary shadow-sm max-w-xs"
                          value={selectedPatientId[req.id] || ""}
                          onChange={(e) => setSelectedPatientId({ ...selectedPatientId, [req.id]: e.target.value })}
                        >
                          <option value="">-- Seleccionar Paciente Registrado --</option>
                          {availablePatients.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.syntheticId} - {p.firstName} {p.lastName} {p.documento ? `(CI: ${p.documento})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Usuario solicitante: <strong className="text-foreground">{req.user?.email}</strong></span>
                    <span>·</span>
                    <span>Fecha solicitud: {new Date(req.createdAt).toLocaleString("es-ES")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {!req.patient && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs shadow-sm"
                      onClick={() => {
                        setNewPatientModalReq(req);
                        setNewPatientData({
                          firstName: "",
                          lastName: "",
                          birthDate: "1990-01-01",
                          sex: "M",
                          allergies: "",
                          medicalHistory: "",
                        });
                      }}
                      disabled={busyId === req.id}
                    >
                      <UserPlus className="size-3.5" />
                      + Crear Ficha y Aprobar
                    </Button>
                  )}

                  <Button
                    size="sm"
                    className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                    onClick={() => handleApproveExisting(req)}
                    disabled={busyId === req.id}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {busyId === req.id ? "Aprobando..." : req.patient ? "Aprobar" : "Vincular a Seleccionado"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                    onClick={() => {
                      setRejectModalId(req.id);
                      setRejectionReason("");
                    }}
                    disabled={busyId === req.id}
                  >
                    <XCircle className="size-3.5" />
                    Rechazar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal para Crear Nueva Ficha de Paciente y Aprobar */}
      {newPatientModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <UserPlus className="size-5 text-emerald-400" />
                Crear Nueva Ficha Clínica y Vincular
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={() => setNewPatientModalReq(null)}
              >
                <XCircle className="size-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Se registrará una nueva ficha de paciente y se vinculará a la cuenta de{" "}
              <strong className="text-foreground">{newPatientModalReq.user?.email}</strong> con Documento{" "}
              <strong className="text-foreground">{newPatientModalReq.requestedDocument}</strong>.
            </p>

            <form onSubmit={handleCreateAndApprove} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Nombres (opcional)</label>
                  <Input
                    placeholder="Ej: Milton Alexander"
                    value={newPatientData.firstName}
                    onChange={(e) => setNewPatientData({ ...newPatientData, firstName: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Apellidos (opcional)</label>
                  <Input
                    placeholder="Ej: Curimilma S."
                    value={newPatientData.lastName}
                    onChange={(e) => setNewPatientData({ ...newPatientData, lastName: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Fecha de Nacimiento</label>
                  <Input
                    type="date"
                    value={newPatientData.birthDate}
                    onChange={(e) => setNewPatientData({ ...newPatientData, birthDate: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Sexo</label>
                  <select
                    className="w-full text-xs bg-surface border border-outline-variant rounded-md px-3 py-2 text-foreground"
                    value={newPatientData.sex}
                    onChange={(e) => setNewPatientData({ ...newPatientData, sex: e.target.value as any })}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Alergias (opcional)</label>
                <Input
                  placeholder="Ej: Penicilina, Mariscos (o Ninguna)"
                  value={newPatientData.allergies}
                  onChange={(e) => setNewPatientData({ ...newPatientData, allergies: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Antecedentes Médicos (opcional)</label>
                <Textarea
                  placeholder="Ej: Hipertensión arterial, cirugías previas, etc."
                  value={newPatientData.medicalHistory}
                  onChange={(e) => setNewPatientData({ ...newPatientData, medicalHistory: e.target.value })}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewPatientModalReq(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                  disabled={busyId === newPatientModalReq.id}
                >
                  <CheckCircle2 className="size-4" />
                  {busyId === newPatientModalReq.id ? "Creando y Aprobando..." : "Crear Ficha y Habilitar Paciente"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Motivo de Rechazo */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <XCircle className="size-5 text-destructive" />
              Rechazar Solicitud de Vinculación
            </h3>
            <p className="text-xs text-muted-foreground">
              Indica el motivo del rechazo (este mensaje será visible para el paciente cuando intente ingresar).
            </p>
            <Textarea
              placeholder="Ej: El número de documento no coincide con el registro del paciente en ventanilla."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs min-h-[80px]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejectModalId(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleReject(rejectModalId)}
                disabled={busyId === rejectModalId}
              >
                Confirmar Rechazo
              </Button>
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export function ClinicalAdminPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallbackTo="/clinical/patients">
      <ClinicalAdminPageContent />
    </RoleGuard>
  );
}

type TabKey = "pacientes" | "medicos" | "asignaciones" | "citas" | "solicitudes";

function ClinicalAdminPageContent() {
  const { data: user } = useAuth();
  const [tab, setTab] = useState<TabKey>("pacientes");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reportError = (message: string) => {
    clearTimer();
    setNotice(null);
    setError(message);
    timerRef.current = setTimeout(() => {
      setError(null);
    }, 5000);
  };

  const showNotice = (message: string) => {
    clearTimer();
    setError(null);
    setNotice(message);
    timerRef.current = setTimeout(() => {
      setNotice(null);
    }, 4000);
  };

  const handleDismissBanner = () => {
    clearTimer();
    setError(null);
    setNotice(null);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

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
      key: "solicitudes",
      label: "Solicitudes de Vinculación",
      icon: <UserCheck className="size-4" />,
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
          Gestión de pacientes, solicitudes de vinculación, médicos y asignaciones.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-outline-variant bg-surface-container/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${TAB_CLASS} ${tab === t.key ? TAB_ACTIVE : TAB_IDLE
              } inline-flex items-center gap-1.5`}
            onClick={() => {
              handleDismissBanner();
              setTab(t.key);
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <StatusBanner
        error={error}
        notice={notice}
        onDismiss={handleDismissBanner}
      />

      {tab === "pacientes" && (
        <PatientsTab notice={showNotice} reportError={reportError} />
      )}
      {tab === "solicitudes" && (
        <PendingLinkRequestsTab notice={showNotice} reportError={reportError} />
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
