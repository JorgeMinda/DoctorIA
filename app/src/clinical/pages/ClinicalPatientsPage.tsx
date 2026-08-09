import { useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useQuery } from "wasp/client/operations";
import { getPatients } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Input } from "../../client/components/ui/input";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";

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
      <div className="mt-10 px-6">
        <Card className="mb-4 lg:m-8">
          <CardContent className="p-6">
            Solo profesionales médicos habilitados pueden acceder a este módulo.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-10 px-6">
      <div className="mb-4 flex items-center justify-between lg:m-8 lg:mb-6">
        <h1 className="text-2xl font-bold">Pacientes</h1>
      </div>
      <div className="mb-4 lg:mx-8">
        <Input
          placeholder="Buscar por nombre, apellido o identificador sintético (PAC-…)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
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

      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Lista de pacientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-6 text-sm">Cargando…</div>}
          {data && data.patients.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No hay pacientes asignados a su cuenta.
            </div>
          )}
          {data && data.patients.length > 0 && (
            <div className="divide-y">
              {data.patients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <div className="text-sm font-semibold">
                      {patient.firstName} {patient.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {patient.syntheticId}
                      {" · "}
                      {patient.sex} ·{" "}
                      {new Date(patient.birthDate).toLocaleDateString()}
                    </div>
                  </div>
                  <WaspRouterLink
                    to={routes.ClinicalPatientDetailRoute.to}
                    params={{ patientId: patient.id }}
                  >
                    <Button variant="outline" size="sm">
                      Ver historia
                    </Button>
                  </WaspRouterLink>
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
