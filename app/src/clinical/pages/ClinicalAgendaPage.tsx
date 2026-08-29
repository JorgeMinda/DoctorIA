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
  Edit3,
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
import { EditAppointmentModal } from "../components/EditAppointmentModal";

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

import { useConfirm } from "../../client/hooks/use-confirm";

function MetricTile({
  value,
  label,
  color,
  active,
  onClick,
}: {
  value: number | string;
  label: string;
  color: "sky" | "amber" | "blue" | "emerald";
  active?: boolean;
  onClick?: () => void;
}) {
  const colorStyles = {
    sky: active
      ? "border-sky-400/70 bg-sky-500/20 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/50"
      : "border-outline-variant/60 bg-surface/50 hover:border-sky-400/50 hover:bg-sky-500/10",
    amber: active
      ? "border-amber-400/70 bg-amber-500/20 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.25)] ring-1 ring-amber-400/50"
      : "border-outline-variant/60 bg-surface/50 hover:border-amber-400/50 hover:bg-amber-500/10",
    blue: active
      ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50"
      : "border-outline-variant/60 bg-surface/50 hover:border-cyan-400/50 hover:bg-cyan-500/10",
    emerald: active
      ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.25)] ring-1 ring-emerald-400/50"
      : "border-outline-variant/60 bg-surface/50 hover:border-emerald-400/50 hover:bg-emerald-500/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border p-3.5 text-center backdrop-blur-md shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] ${colorStyles[color]}`}
    >
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 group-hover:text-foreground">
        {label}
      </p>
    </button>
  );
}

export function ClinicalAgendaPage() {
  const { data: user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNewCita, setShowNewCita] = useState(false);
  const [editingCita, setEditingCita] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED"
  >("ALL");

  const { confirm, ConfirmDialog } = useConfirm();

  const { data: agenda, isLoading, refetch } = useQuery(
    getAgenda,
    {},
    { enabled: Boolean(user) },
  );
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
    const rawActiveCitas = (agenda?.citas ?? []).filter(
      (c) => c.status === "SCHEDULED" || c.status === "IN_PROGRESS",
    );
    const historyCitas = (agenda?.citas ?? []).filter(
      (c) => c.status !== "SCHEDULED" && c.status !== "IN_PROGRESS",
    );

    const activeCitas =
      statusFilter === "ALL"
        ? rawActiveCitas
        : statusFilter === "COMPLETED"
          ? historyCitas.filter((c) => c.status === "COMPLETED")
          : rawActiveCitas.filter((c) => c.status === statusFilter);

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
          <MetricTile
            value={agenda?.metrics.citasHoy ?? 0}
            label="Citas hoy (Ver todas)"
            color="sky"
            active={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
          />
          <MetricTile
            value={rawActiveCitas.filter((c) => c.status === "SCHEDULED").length}
            label="Programadas"
            color="amber"
            active={statusFilter === "SCHEDULED"}
            onClick={() =>
              setStatusFilter((f) => (f === "SCHEDULED" ? "ALL" : "SCHEDULED"))
            }
          />
          <MetricTile
            value={rawActiveCitas.filter((c) => c.status === "IN_PROGRESS").length}
            label="En curso"
            color="blue"
            active={statusFilter === "IN_PROGRESS"}
            onClick={() =>
              setStatusFilter((f) => (f === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS"))
            }
          />
          <MetricTile
            value={agenda?.metrics.citasCompletadasHoy ?? 0}
            label="Completadas hoy"
            color="emerald"
            active={statusFilter === "COMPLETED"}
            onClick={() =>
              setStatusFilter((f) => (f === "COMPLETED" ? "ALL" : "COMPLETED"))
            }
          />
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Cargando agenda de citas…</p>
        )}

        <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md shadow-sm">
          <CardHeader className="border-b border-outline-variant/40 bg-surface-container/30">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                {statusFilter === "ALL"
                  ? `Citas activas y agendadas (${activeCitas.length})`
                  : statusFilter === "COMPLETED"
                    ? `Citas completadas filtradas (${activeCitas.length})`
                    : `Citas filtradas: ${citaStatusLabel(statusFilter)} (${activeCitas.length})`}
              </span>
              {statusFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="text-xs text-primary hover:underline"
                >
                  Ver todas
                </button>
              )}
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
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-all hover:bg-surface-high/30"
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
                          onClick={async () => {
                            const ok = await confirm({
                              title: "¿Cancelar esta cita?",
                              description: `Se cancelará la cita de ${cita.patient.firstName} ${cita.patient.lastName} y se liberará el horario del médico.`,
                              confirmText: "Sí, cancelar cita",
                              variant: "destructive",
                            });
                            if (ok) {
                              await runTransition(
                                cita.id,
                                "CANCELLED",
                                "Cita cancelada (horario liberado)",
                              );
                            }
                          }}
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
                        onClick={async () => {
                          const ok = await confirm({
                            title: "¿Cancelar cita en curso?",
                            description: `Se cancelará la cita en curso de ${cita.patient.firstName} ${cita.patient.lastName}.`,
                            confirmText: "Sí, cancelar",
                            variant: "destructive",
                          });
                          if (ok) {
                            await runTransition(cita.id, "CANCELLED", "Cita cancelada");
                          }
                        }}
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
          <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-outline-variant/40 bg-surface-container/30">
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
        <MetricTile
          value={agenda?.metrics.pacientesAtendidos ?? "—"}
          label="Pacientes atendidos"
          color="sky"
        />
        <MetricTile
          value={agenda?.metrics.atencionesHoy ?? "—"}
          label="Atenciones hoy"
          color="blue"
        />
        <MetricTile
          value={agenda?.metrics.citasHoy ?? "—"}
          label="Citas hoy"
          color="amber"
        />
        <MetricTile
          value={agenda?.metrics.citasCompletadasHoy ?? "—"}
          label="Citas completadas hoy"
          color="emerald"
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando agenda…</p>
      )}

      <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md shadow-sm">
        <CardHeader className="border-b border-outline-variant/40 bg-surface-container/30">
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
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-all hover:bg-surface-high/30"
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
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

      <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md shadow-sm">
        <CardHeader className="border-b border-outline-variant/40 bg-surface-container/30">
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
