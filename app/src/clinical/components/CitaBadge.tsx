import { Badge } from "../../client/components/ui/badge";
import { cn } from "../../client/utils";
import {
  STATUS_CONFIG,
  type AppointmentStatus,
} from "../services/statusLabels";

export function initialsOf(patient: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase();
}

export function CitaBadge({
  status,
  patientInitials,
  compact,
}: {
  status: string;
  patientInitials?: string;
  compact?: boolean;
}) {
  const config =
    STATUS_CONFIG[status as AppointmentStatus] ?? STATUS_CONFIG.SCHEDULED;
  return (
    <Badge
      variant={config.variant}
      className={cn("mono-label gap-1.5", config.className)}
    >
      {patientInitials && (
        <span className="flex size-4 items-center justify-center rounded-full bg-black/10 text-[9px] font-extrabold uppercase">
          {patientInitials}
        </span>
      )}
      {compact ? config.short : config.label}
    </Badge>
  );
}
