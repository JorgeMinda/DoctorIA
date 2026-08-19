import { useState } from "react";
import { useQuery } from "wasp/client/operations";
import { getAuditLog } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { AlertCircle, Lock, ScrollText } from "lucide-react";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";
import { auditActionLabel } from "../services/statusLabels";

export function ClinicalAuditPage() {
  const { data: user } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(getAuditLog, {
    page,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-warning" />
            Debe iniciar sesión para acceder a la auditoría.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
          Seguridad y trazabilidad
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Auditoría
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro funcional de acciones clínicas (sin contenido clínico).
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error.message}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ScrollText className="size-4 text-primary" />
            Registro
            <Badge variant="outline" className="mono-label ml-auto">
              {data ? `${data.entries.length} · pág ${page}` : "—"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Cargando registro…
            </div>
          )}
          {data && data.entries.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Sin registros para mostrar.
            </div>
          )}
          {data && data.entries.length > 0 && (
            <div className="divide-y divide-outline-variant/40">
              {data.entries.map((entry: any) => (
                <div
                  key={entry.id}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <ScrollText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">
                        {auditActionLabel(entry.action)}
                      </div>
                      {(entry.metadata?.adminAction === "CREATE" &&
                        entry.resourceType === "PATIENT" && (
                          <Badge variant="success">Creación de paciente</Badge>
                        )) ||
                        (entry.metadata?.adminAction === "UPDATE" && (
                          <Badge variant="outline">Edición</Badge>
                        )) ||
                        (entry.metadata?.adminAction === "DELETE" && (
                          <Badge variant="destructive">Eliminación</Badge>
                        ))}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {entry.user?.fullName ??
                          entry.user?.username ??
                          entry.user?.email}
                      </span>
                      <span>·</span>
                      <Badge variant="outline" className="mono-label">
                        {entry.resourceType}
                      </Badge>
                      {entry.patient && (
                        <span className="font-medium text-foreground">
                          {entry.patient.firstName} {entry.patient.lastName} (
                          {entry.patient.syntheticId})
                        </span>
                      )}
                      {entry.resourceId && !entry.patient && (
                        <span className="mono-label">
                          #{entry.resourceId.slice(0, 8)}
                        </span>
                      )}
                      <span>·</span>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

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
