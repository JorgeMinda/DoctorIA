import { useState, useEffect } from "react";
import { Navigate } from "react-router";
import { useRole } from "../../client/hooks/useRole";
import { getRoleHomePath } from "../../client/roleHome";
import { hasStoredSessionToken } from "../../client/auth/sessionTokenAdapter";
import { PublicPatientPortal } from "./PublicPatientPortal";
import { Card, CardContent } from "../../client/components/ui/card";
import { Button } from "../../client/components/ui/button";
import { AppFooterBar } from "../../client/components/AppFooterBar";
import { RefreshCw, ServerCrash, Stethoscope } from "lucide-react";

/**
 * Esqueleto neutro de hidratación para evitar parpadeos visuales (FOUC)
 * mientras se valida el token de sesión contra el servidor.
 */
export function RootHydrationSkeleton() {
  return (
    <div
      className="min-h-[80vh] flex flex-col justify-between p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200"
      aria-busy="true"
      aria-label="Cargando portal"
    >
      <div className="mx-auto max-w-lg w-full my-auto text-center space-y-4">
        <div className="size-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 mx-auto flex items-center justify-center">
          <Stethoscope className="size-7 animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">DoctorIA</p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Validando sesión clínica...</span>
          </div>
        </div>
      </div>
      <AppFooterBar className="mt-8" />
    </div>
  );
}

/**
 * Puerta autenticada: se monta ÚNICAMENTE cuando existe un token almacenado en el cliente.
 * Llama a useRole() y gestiona la redirección por rol o el timeout de cold-start.
 */
export function AuthenticatedRootGate() {
  const { user, role, isLoading, isAuthenticated } = useRole();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [forceGuestView, setForceGuestView] = useState(false);

  // Detección de timeout de cold-start en servidor (10 segundos)
  useEffect(() => {
    if (!isLoading) return;

    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  // Si el usuario decide continuar como visitante tras el timeout
  if (forceGuestView) {
    return <PublicPatientPortal />;
  }

  // 1. Fase de carga de sesión
  if (isLoading) {
    if (hasTimedOut) {
      return (
        <div className="min-h-[80vh] flex flex-col justify-between p-4 sm:p-6 lg:p-8 animate-in fade-in">
          <div className="mx-auto max-w-md w-full my-auto">
            <Card className="border-amber-500/30 bg-surface/90 shadow-md">
              <CardContent className="p-6 text-center space-y-4">
                <div className="size-12 rounded-xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                  <ServerCrash className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    El servidor está tardando en responder
                  </p>
                  <p className="text-xs text-muted-foreground">
                    El servicio está iniciando tras un periodo de inactividad. Puedes esperar la conexión o explorar el portal como visitante.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto text-xs gap-1.5"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="size-3" />
                    Reintentar
                  </Button>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto text-xs"
                    onClick={() => setForceGuestView(true)}
                  >
                    Continuar como Visitante
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <AppFooterBar className="mt-8" />
        </div>
      );
    }

    return <RootHydrationSkeleton />;
  }

  // 2. Si el token expiró o la sesión no es válida, degradar a vista pública
  if (!isAuthenticated || !user) {
    return <PublicPatientPortal />;
  }

  // 3. Sesión activa: Redirección inmediata según rol institucional (sin parpadeo)
  const destination = getRoleHomePath(role, true);
  return <Navigate to={destination} replace />;
}

/**
 * Controlador de Entrada Raíz (DoctorIA - /).
 * 
 * Implementa una arquitectura síncrona en dos puertas:
 * - Si NO hay token guardado: Carga inmediata de PublicPatientPortal en 0 ms.
 * - Si HAY token guardado: Valida la sesión y redirige inmediatamente al panel correspondiente.
 */
export function RootPortalPage() {
  const hasToken = hasStoredSessionToken();

  if (!hasToken) {
    return <PublicPatientPortal />;
  }

  return <AuthenticatedRootGate />;
}
