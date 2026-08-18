import { Badge } from "../../client/components/ui/badge";
import { statusLabel } from "../services/statusLabels";

export function statusBadgeVariant(status: string) {
  if (status === "CONFIRMED") return "success";
  if (status === "REVIEWED") return "warning";
  return "outline";
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusBadgeVariant(status)}>{statusLabel(status)}</Badge>;
}