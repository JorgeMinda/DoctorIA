import { useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useQuery } from "wasp/client/operations";
import { getPatients } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Activity,
  ChevronRight,
  Mic,
  Search,
  ShieldCheck,
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

export function ClinicalPatientsPage() {
  const { data: user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(getPatients, {
    search: search || undefined,
    page,
    pageSize: 20,
  });

  if (!user?.isMedico || user.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              Solo profesionales médicos habilitados pueden acceder a este
              módulo.
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
          <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
            Panel clínico
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Historia clínica asistida por DoctorIA · datos 100% sintéticos
          </p>
        </div>
        <WaspRouterLink to={routes.ClinicalVoiceRoute.to}>
          <Button className="shadow-[0_0_20px_rgba(0,218,243,0.25)]">
            <Mic className="size-4" />
            Asistente de voz
          </Button>
        </WaspRouterLink>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-outline-variant bg-surface">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
                Pacientes en vista
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {data ? data.patients.length : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-outline-variant bg-surface">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Activity className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
                Paginación
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {data ? `${page} / ${data.totalPages}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search ? `Búsqueda activa · ${data?.patients.length ?? 0} coincidencia(s)` : "Lista asignada por autorización"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-outline-variant bg-surface">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
                Asistencia IA
              </p>
              <Badge variant="success">Operativa</Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                Estructuración clínica disponible
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="border-outline-variant bg-surface pl-9"
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

      <Card className="overflow-hidden border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant/50 bg-surface-container/60 px-5 py-3">
          <p className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
            Lista de pacientes asignados
          </p>
          <Badge variant="outline" className="mono-label">
            {data
              ? search
                ? `${data.patients.length} resultado(s)`
                : `${data.patients.length} asignados`
              : "—"}
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
                : "No hay pacientes asignados a su cuenta."}
            </div>
          )}
          {data &&
            data.patients.length > 0 &&
            data.patients.map((patient) => (
              <div
                key={patient.id}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
              >
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
                      nac.
                      {new Date(patient.birthDate).toLocaleDateString()}
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
                </div>
                <WaspRouterLink
                  to={routes.ClinicalPatientDetailRoute.to}
                  params={{ patientId: patient.id }}
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Ver historia
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </WaspRouterLink>
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