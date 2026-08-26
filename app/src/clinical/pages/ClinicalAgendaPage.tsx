import { useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getAgenda, updateCitaStatus } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  PhoneMissed,
  Plus,
  ShieldAlert,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";
import { toast } from "../../client/hooks/use-toast";
import { citaStatusLabel } from "../services/statusLabels";
import { NewAppointmentModal } from "../components/NewAppointmentModal";

function citaBadgeVariant(status: string) {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "warning";
  if (status === "CANCELLED") return "destructive";
  return "outline";
}

function CitaBadge({ status }: { status: string }) {
  return (
    <Badge variant={citaBadgeVariant(status) as any} className="mono-label">
      {citaStatusLabel(status)}
    </Badge>
  );
}

function metricTile(value: number | string, label: string) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function ClinicalAgendaPage() {
  const { data: user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNewCita, setShowNewCita] = useState(false);

  const { data: agenda, isLoading, refetch } = useQuery(getAgenda, {});
  const updateStatusFn = useAction(updateCitaStatus);

  const runTransition = async (
    citaId: string,
    status: string,
    label: string,
  ) => {
    setBusyId(citaId);
    try {
      await updateStatusFn({ citaId, status });
      toast({ title: label });
      await refetch();
    } catch (err: any) {
      toast({
        title: "No se pudo actualizar la cita",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!(user?.isMedico || user?.isSecretaria || user?.isAdmin)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>No tienes acceso a este módulo clínico.</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMedicoView = Boolean(user.isMedico && !user.isAdmin);

  // Secretaria/admin gestionan citas desde el panel de gestión.
  if (!isMedicoView) {
    const activeCitas = (agenda?.citas ?? []).filter(
      (c) => c.status === "SCHEDULED" || c.status === "IN_PROGRESS",
    );
    const historyCitas = (agenda?.citas ?? []).filter(
      (c) => c.status !== "SCHEDULED" && c.status !== "IN_PROGRESS",
    );

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
              Panel clínico
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gestión de citas
            </h1>
            <p className="text-sm text-muted-foreground">
              Programa citas, confirma asistencia o cancela turnos para liberar y ocupar horarios.
            </p>
          </div>
          <Button
            className="gap-1.5 shadow-[0_0_15px_rgba(0,218,243,0.25)]"
            onClick={() => setShowNewCita(true)}
          >
            <Plus className="size-4" />
            Nueva cita
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metricTile(agenda?.metrics.citasHoy ?? 0, "Citas hoy")}
          {metricTile(
            activeCitas.filter((c) => c.status === "SCHEDULED").length,
            "Programadas",
          )}
          {metricTile(
            activeCitas.filter((c) => c.status === "IN_PROGRESS").length,
            "En curso",
          )}
          {metricTile(
            agenda?.metrics.citasCompletadasHoy ?? 0,
            "Completadas hoy",
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Cargando agenda de citas…</p>
        )}

        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                Citas activas y agendadas ({activeCitas.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!isLoading && activeCitas.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                No hay citas agendadas activas en este momento.
              </div>
            )}
            <div className="divide-y divide-outline-variant/40">
              {activeCitas.map((cita) => (
                <div
                  key={cita.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-container/20"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <WaspRouterLink
                        to={routes.ClinicalPatientDetailRoute.to}
                        params={{ patientId: cita.patient.id }}
                        className="group flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <span>
                          {cita.patient.firstName} {cita.patient.lastName}
                        </span>
                        <ExternalLink className="size-3.5 opacity-60 group-hover:opacity-100" />
                      </WaspRouterLink>
                      <Badge variant="outline" className="mono-label">
                        {cita.patient.syntheticId}
                      </Badge>
                      <CitaBadge status={cita.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {new Date(cita.scheduledAt).toLocaleString()}
                      </span>
                      <span>· {cita.durationMinutes} min</span>
                      {cita.medico?.fullName && (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <UserRound className="size-3.5 text-primary" />
                          Dr. {cita.medico.fullName}
                        </span>
                      )}
                      {cita.reason && <span>· Motivo: {cita.reason}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <WaspRouterLink
                      to={routes.ClinicalPatientDetailRoute.to}
                      params={{ patientId: cita.patient.id }}
                    >
                      <Button size="sm" variant="secondary" className="gap-1 text-xs">
                        <ExternalLink className="size-3.5" />
                        Pre-clínico
                      </Button>
                    </WaspRouterLink>

                    {cita.status === "SCHEDULED" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busyId === cita.id}
                          onClick={() =>
                            runTransition(cita.id, "IN_PROGRESS", "Cita iniciada / Asistió")
                          }
                          className="gap-1 text-xs"
                        >
                          <Activity className="size-3.5" />
                          Asistió / Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === cita.id}
                          onClick={() =>
                            runTransition(
                              cita.id,
                              "NO_SHOW",
                              "Registrado: no asistió",
                            )
                          }
                          className="gap-1 text-xs"
                        >
                          <PhoneMissed className="size-3.5" />
                          No asistió
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === cita.id}
                          onClick={() =>
                            runTransition(cita.id, "CANCELLED", "Cita cancelada (horario liberado)")
                          }
                          className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="size-3.5" />
                          Cancelar cita
                        </Button>
                      </>
                    )}

                    {cita.status === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === cita.id}
                        onClick={() =>
                          runTransition(cita.id, "CANCELLED", "Cita cancelada")
                        }
                        className="gap-1 text-xs text-destructive"
                      >
                        <XCircle className="size-3.5" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {historyCitas.length > 0 && (
          <Card className="overflow-hidden border-outline-variant">
            <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 className="size-4 text-primary" />
                Historial reciente de citas ({historyCitas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-outline-variant/40">
                {historyCitas.slice(0, 10).map((cita) => (
                  <div
                    key={cita.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <WaspRouterLink
                          to={routes.ClinicalPatientDetailRoute.to}
                          params={{ patientId: cita.patient.id }}
                          className="text-sm font-medium text-foreground hover:underline hover:text-primary"
                        >
                          {cita.patient.firstName} {cita.patient.lastName}
                        </WaspRouterLink>
                        <Badge variant="outline" className="mono-label">
                          {cita.patient.syntheticId}
                        </Badge>
                        <CitaBadge status={cita.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{new Date(cita.scheduledAt).toLocaleString()}</span>
                        {cita.medico?.fullName && (
                          <span>· Dr. {cita.medico.fullName}</span>
                        )}
                        {cita.reason && <span>· {cita.reason}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {showNewCita && (
          <NewAppointmentModal
            open={showNewCita}
            onOpenChange={setShowNewCita}
            onDone={() => refetch()}
          />
        )}
      </div>
    );
  }

  const now = Date.now();
  const upcoming =
    agenda?.citas.filter(
      (c) =>
        new Date(c.scheduledAt).getTime() >= now - 15 * 60_000 &&
        ["SCHEDULED", "IN_PROGRESS"].includes(c.status),
    ) ?? [];
  const history =
    agenda?.citas.filter(
      (c) =>
        !["SCHEDULED", "IN_PROGRESS"].includes(c.status) ||
        new Date(c.scheduledAt).getTime() < now - 15 * 60_000,
    ) ?? [];

  const isEnCita = agenda?.currentStatus === "EN_CITA";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
            Panel clínico
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Mi agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Disponibilidad y citas del profesional.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
            isEnCita
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-success/40 bg-success/10 text-success"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              isEnCita
                ? "bg-warning shadow-[0_0_8px_var(--color-warning)]"
                : "bg-success shadow-[0_0_8px_var(--color-success)]"
            }`}
          />
          {isEnCita ? "En cita" : "Desocupado"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metricTile(
          agenda?.metrics.pacientesAtendidos ?? "—",
          "Pacientes atendidos",
        )}
        {metricTile(agenda?.metrics.atencionesHoy ?? "—", "Atenciones hoy")}
        {metricTile(agenda?.metrics.citasHoy ?? "—", "Citas hoy")}
        {metricTile(
          agenda?.metrics.citasCompletadasHoy ?? "—",
          "Citas completadas hoy",
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando agenda…</p>
      )}

      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="size-4 text-primary" />
            Próximas citas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!isLoading && upcoming.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No hay citas programadas próximas.
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="divide-y divide-outline-variant/40">
              {upcoming.map((cita) => (
                <div
                  key={cita.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <CalendarDays className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {cita.patient.firstName} {cita.patient.lastName}
                      </span>
                      <Badge variant="outline" className="mono-label">
                        {cita.patient.syntheticId}
                      </Badge>
                      <CitaBadge status={cita.status} />
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
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {cita.status === "SCHEDULED" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busyId === cita.id}
                          onClick={() =>
                            runTransition(
                              cita.id,
                              "IN_PROGRESS",
                              "Cita iniciada",
                            )
                          }
                        >
                          <Activity className="size-4" />
                          Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === cita.id}
                          onClick={() =>
                            runTransition(
                              cita.id,
                              "NO_SHOW",
                              "Registrado: no asistió",
                            )
                          }
                        >
                          <PhoneMissed className="size-4" />
                          No asistió
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === cita.id}
                          onClick={() =>
                            runTransition(
                              cita.id,
                              "CANCELLED",
                              "Cita cancelada",
                            )
                          }
                        >
                          <XCircle className="size-4" />
                          Cancelar
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
                        <FileCheck2 className="size-4" />
                        Completar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-4 text-primary" />
            Historial de citas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!isLoading && history.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Aún no hay historial de citas.
            </div>
          )}
          {history.length > 0 && (
            <div className="divide-y divide-outline-variant/40">
              {history.map((cita) => (
                <div
                  key={cita.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Users className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {cita.patient.firstName} {cita.patient.lastName}
                      </span>
                      <Badge variant="outline" className="mono-label">
                        {cita.patient.syntheticId}
                      </Badge>
                      <CitaBadge status={cita.status} />
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
