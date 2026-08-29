import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router";
import { useRole, type ClinicalRole } from "../hooks/useRole";

export function RoleGuard({
  allowedRoles,
  fallbackTo = "/clinical/patients",
  children,
}: {
  allowedRoles: ClinicalRole[];
  fallbackTo?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { role, isLoading, isAuthenticated } = useRole();

  useEffect(() => {
    if (!isLoading && isAuthenticated && role && !allowedRoles.includes(role)) {
      navigate(fallbackTo, { replace: true });
    }
  }, [role, isLoading, isAuthenticated, allowedRoles, fallbackTo, navigate]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Verificando autorización…
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
