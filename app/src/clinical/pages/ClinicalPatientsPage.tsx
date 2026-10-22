import { useState, useEffect } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useQuery, useAction } from "wasp/client/operations";
import { getPatients, manageSyntheticPatients } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Activity,
  ChevronRight,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
} from "lucide-react";
import { Input } from "../../client/components/ui/input";
import { Button } from "../../client/components/ui/button";
import { Card, CardContent } from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";
import {
  patientAge,
  sexLabel,
} from "../services/clinicalFormat";
import { PatientFormModal } from "../components/PatientFormModal";
import { EmergencyAppointmentModal } from "../components/EmergencyAppointmentModal";

export function ClinicalPatientsPage() {
  const { data: user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery(
    getPatients,
    {
      search: debouncedSearch || undefined,
      page,
      pageSize: 20,
    },
    { enabled: Boolean(user), staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const canCreatePatient = Boolean(user?.isSecretaria || user?.isAdmin);

  if (!(user?.isMedico || user?.isSecretaria || user?.isAdmin)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span>
        No tienes acceso a este módulo clínico.
      </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-cyan-400 font-semibold">
            Panel clínico
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Pacientes
          </h1>
          <p className="text-sm text-slate-300">
            Historia clínica asistida por DoctorIA · datos 100% sintéticos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreatePatient && (
            <Button
              variant="outline"
              onClick={() => setShowCreate(true)}
              className="gap-1.5 border-white/20 bg-white/5 hover:bg-white/10 text-white"
            >
              <Plus className="size-4" />
              Nuevo paciente
            </Button>
          )}
          {user?.isSecretaria && (
            <Button
              variant="destructive"
              onClick={() => setShowEmergency(true)}
              className="gap-1.5 border-destructive/40 bg-destructive/15 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-destructive/25 hover:border-destructive/60"
            >
              <Siren className="size-4 animate-pulse" />
              🚨 Cita Emergente
            </Button>
          )}
          {user?.isMedico && (
            <WaspRouterLink to={routes.ClinicalVoiceRoute.to}>
              <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(0,218,243,0.35)]">
                <Mic className="size-4" />
                Asistente de voz
              </Button>
            </WaspRouterLink>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="clinical-glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-400">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="mono-label text-[11px] uppercase tracking-wider text-slate-300 font-medium">
                Pacientes en vista
              </p>
              <p className="text-3xl font-bold text-white">
                {data ? data.patients.length : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="clinical-glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-400">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="mono-label text-[11px] uppercase tracking-wider text-slate-300 font-medium">
                Paginación
              </p>
              <p className="text-3xl font-bold text-white">
                {data ? `${page} / ${data.totalPages}` : "—"}
              </p>
              <p className="text-xs text-slate-400">
                {search ? `Búsqueda activa · ${data?.patients.length ?? 0} coincidencia(s)` : "Lista asignada por autorización"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="clinical-glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-cyan-400/40 shadow-[0_0_15px_rgba(0,218,243,0.3)]">
              <img
                src="/doctoria_robot_assistant.jpg"
                alt="DoctorIA"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0.5 right-0.5 flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="mono-label text-[11px] uppercase tracking-wider text-slate-300 font-medium">
                Asistencia IA
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant="success" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Operativa</Badge>
                <span className="text-[11px] text-slate-300">DoctorIA v1.0</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Estructuración clínica disponible
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="clinical-glass-input pl-9 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-cyan-400/20"
          placeholder="Buscar por nombre, apellido o identificador sintético (PAC-…)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">
            {error.message}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden clinical-glass-card">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/40 px-5 py-3 backdrop-blur-sm">
          <p className="mono-label text-[11px] uppercase tracking-wider text-slate-300 font-medium">
            Lista de pacientes asignados
          </p>
          <Badge variant="outline" className="mono-label border-white/20 bg-white/5 text-slate-200">
            {data
              ? search
                ? `${data.patients.length} resultado(s)`
                : `${data.patients.length} asignados`
              : "—"}
          </Badge>
        </div>

        <div className="divide-y divide-white/10">
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Cargando pacientes…
            </div>
          )}
          {data && data.patients.length === 0 && (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <div className="relative mb-3 size-16 overflow-hidden rounded-2xl border border-primary/30 shadow-[0_0_16px_rgba(0,218,243,0.2)]">
                <img
                  src="/doctoria_robot_assistant.jpg"
                  alt="DoctorIA Assistant"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-sm font-medium text-white">
                {search
                  ? "Sin resultados para la búsqueda"
                  : "No hay pacientes asignados a su cuenta"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                {search
                  ? "Verifica el término ingresado o intenta con el código sintético (PAC-XXX)."
                  : "Un administrador o secretaria debe otorgarte autorización médica para visualizar historias clínicas."}
              </p>
            </div>
          )}
          {data &&
            data.patients.length > 0 &&
            data.patients.map((patient) => (
              <div
                key={patient.id}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-cyan-500/10"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 text-sm font-bold text-cyan-300">
                  {patient.firstName[0]}
                  {patient.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-white">
                      {patient.firstName} {patient.lastName}
                    </span>
                    <Badge variant="outline" className="mono-label border-white/20 bg-white/5 text-slate-200">
                      {patient.syntheticId}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                    <span>{sexLabel(patient.sex)}</span>
                    <span>·</span>
                    <span>{patientAge(patient.birthDate)} años</span>
                    <span>·</span>
                    <span>
                      nac.
                      {new Date(patient.birthDate).toLocaleDateString()}
                    </span>
                    {patient.allergies && patient.allergies.trim() !== "" && (
                      <>
                        <span>·</span>
                        <span className="text-amber-400 font-medium">
                          Alergias: {patient.allergies}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <WaspRouterLink
                  to={routes.ClinicalPatientDetailRoute.to}
                  params={{ patientId: patient.id }}
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm" className="gap-1.5 border-white/20 bg-white/5 hover:bg-cyan-500/25 hover:border-cyan-400 text-white shadow-sm transition-all">
                    Ver historia
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </WaspRouterLink>
              </div>
            ))}
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-slate-950/40 px-5 py-3 backdrop-blur-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Anterior
            </Button>
            <span className="mono-label text-xs text-slate-300">
              {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Siguiente
            </Button>
          </div>
        )}
      </Card>

      {canCreatePatient && showCreate && (
        <PatientFormModal
          open={showCreate}
          onOpenChange={setShowCreate}
          onDone={() => refetch()}
        />
      )}

      {user?.isSecretaria && showEmergency && (
        <EmergencyAppointmentModal
          open={showEmergency}
          onOpenChange={setShowEmergency}
          onDone={() => refetch()}
        />
      )}
    </div>
  );
}