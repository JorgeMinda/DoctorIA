import { useState } from "react";
import { useQuery } from "wasp/client/operations";
import { getAuditLog } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { auditActionLabel } from "../services/statusLabels";

export function ClinicalAuditPage() {
  const { data: user } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(getAuditLog, {
    page,
  });

  if (!user) {
    return <div className="mt-10 px-6 lg:m-8">Debe iniciar sesión.</div>;
  }

  return (
    <div className="mt-10 px-6">
      <div className="mb-4 lg:mx-8">
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Registro funcional de acciones clínicas (sin contenido clínico).
        </p>
      </div>

      {error && (
        <div className="mb-4 lg:mx-8">
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">
              {error.message}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mb-4 lg:mx-8">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Registro</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-6 text-sm">Cargando…</div>}
          {data && data.entries.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Sin registros para mostrar.
            </div>
          )}
          {data && data.entries.length > 0 && (
            <div className="divide-y">
              {data.entries.map((entry: any) => (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {auditActionLabel(entry.action)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {entry.user?.fullName ?? entry.user?.username ?? entry.user?.email}
                    {" · "}
                    {entry.resourceType} {entry.resourceId ? `#${entry.resourceId.slice(0, 8)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="mb-4 flex items-center justify-center gap-2 lg:mx-8">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {page} de {data.totalPages}
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
    </div>
  );
}
