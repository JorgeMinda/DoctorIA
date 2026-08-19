import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { CalendarDays, ShieldAlert } from "lucide-react";
import { Badge } from "../../client/components/ui/badge";
import { Button } from "../../client/components/ui/button";
import { Card, CardContent } from "../../client/components/ui/card";
import { patientAge, sexLabel } from "../services/clinicalFormat";

type ProfilePatient = {
  firstName: string;
  lastName: string;
  syntheticId: string;
  sex: string;
  birthDate: Date;
  medicalHistory: string | null;
  allergies: string | null;
  nationality?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  ethnicity?: string | null;
  bloodType?: string | null;
  address?: string | null;
  phone?: string | null;
  emergencyPhone?: string | null;
  insurance?: string | null;
};

function ProfileItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/60 bg-surface px-3 py-2">
      <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">
        {value && value.trim() !== "" ? value : "—"}
      </p>
    </div>
  );
}

export function PatientProfileHeader({
  patient,
  noteCount,
  epicrisisCount,
}: {
  patient: ProfilePatient;
  noteCount: number;
  epicrisisCount: number;
}) {
  return (
    <Card className="overflow-hidden border-outline-variant">
      <div className="border-b border-outline-variant/50 bg-surface-container/60 px-6 py-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-lg font-bold text-primary">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {patient.firstName} {patient.lastName}
              </h1>
              <Badge variant="outline" className="mono-label">
                {patient.syntheticId}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{sexLabel(patient.sex)}</span>
              <span>·</span>
              <span>{patientAge(patient.birthDate)} años</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                nac. {new Date(patient.birthDate).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
              <p className="text-lg font-semibold text-foreground">
                {noteCount}
              </p>
              <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
                Notas
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
              <p className="text-lg font-semibold text-foreground">
                {epicrisisCount}
              </p>
              <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
                Epicrisis
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Solo administradores pueden editar fichas"
          >
            <ShieldAlert className="size-3.5" />
            Editar ficha
          </Button>
          <WaspRouterLink
            to={routes.ClinicalAuditRoute.to}
            className="shrink-0"
          >
            <Button variant="outline" size="sm">
              Registro de auditoría
            </Button>
          </WaspRouterLink>
        </div>
      </div>
      <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Antecedentes
          </p>
          <p className="text-sm text-foreground">
            {patient.medicalHistory || "Sin antecedentes registrados."}
          </p>
        </div>
        <div>
          <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Alergias
          </p>
          {patient.allergies && patient.allergies.trim() !== "" ? (
            <Badge variant="warning">{patient.allergies}</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin alergias registradas.
            </p>
          )}
        </div>
      </CardContent>
      <div className="border-t border-outline-variant/50" />
      <CardContent className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <ProfileItem label="Nacionalidad" value={patient.nationality} />
        <ProfileItem label="Etnia" value={patient.ethnicity} />
        <ProfileItem
          label="Talla / Peso"
          value={`${patient.heightCm ? `${patient.heightCm} cm` : "—"} / ${
            patient.weightKg ? `${patient.weightKg} kg` : "—"
          }`}
        />
        <ProfileItem label="Tipo de sangre" value={patient.bloodType} />
        <ProfileItem label="Teléfono" value={patient.phone} />
        <ProfileItem label="Emergencia" value={patient.emergencyPhone} />
        <ProfileItem label="Dirección" value={patient.address} />
        <ProfileItem label="Seguro" value={patient.insurance} />
      </CardContent>
    </Card>
  );
}
