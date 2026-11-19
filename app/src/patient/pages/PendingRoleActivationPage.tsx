import { useNavigate } from "react-router";
import { logout } from "wasp/client/auth";
import { useQuery } from "wasp/client/operations";
import { getMyLinkRequestStatus } from "wasp/client/operations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../client/components/ui/card";
import { Button } from "../../client/components/ui/button";
import { Badge } from "../../client/components/ui/badge";
import { Clock, LogOut, ShieldAlert, UserCheck, ArrowRight } from "lucide-react";
import { AppFooterBar } from "../../client/components/AppFooterBar";

export function PendingRoleActivationPage() {
  const navigate = useNavigate();
  const { data: requestStatusData } = useQuery(getMyLinkRequestStatus);
  const requestStatus = requestStatusData as any;

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Ignorar errores al cerrar sesión
    } finally {
      navigate("/", { replace: true });
    }
  };

  const isPendingApproval = requestStatus?.status === "PENDING";

  return (
    <div className="min-h-[80vh] flex flex-col justify-between p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="mx-auto max-w-lg w-full my-auto space-y-6">
        <Card className="border-outline-variant bg-surface/90 shadow-lg backdrop-blur-md">
          <CardHeader className="text-center p-6 pb-4 space-y-3">
            <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mx-auto flex items-center justify-center">
              <Clock className="size-7 animate-pulse" />
            </div>

            <div className="flex justify-center">
              <Badge variant="warning" className="px-3 py-1 font-semibold uppercase tracking-wider text-[11px]">
                Pendiente de Aprobación por Administración
              </Badge>
            </div>

            <CardTitle className="text-xl sm:text-2xl font-extrabold text-foreground">
              Cuenta Pendiente de Activación
            </CardTitle>

            <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Tu cuenta se encuentra registrada en la plataforma, pero aún no tiene un rol clínico habilitado (Médico, Secretaría o Paciente).
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-2 space-y-5">
            {isPendingApproval ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-foreground space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-500">
                  <UserCheck className="size-4 shrink-0" />
                  <span>Solicitud de Vinculación en Revisión</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Ya has enviado una solicitud de vinculación con tu cédula. La administración hospitalaria se encuentra verificando los registros clínicos para habilitar tu rol de Paciente.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    onClick={() => navigate("/patient/link")}
                  >
                    Ver Estado de Solicitud
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground space-y-2">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <UserCheck className="size-4 shrink-0" />
                  <span>¿Eres paciente de nuestra institución?</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Si ya tienes una historia clínica o deseas solicitar acceso a tus citas y consultas, vincula tu número de cédula para iniciar el proceso de verificación.
                </p>
                <div className="pt-2">
                  <Button
                    className="w-full gap-2 text-xs font-semibold h-10 shadow-sm"
                    onClick={() => navigate("/patient/link")}
                  >
                    Solicitar Acceso Paciente (Vincular Cédula)
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-outline-variant/60 bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldAlert className="size-4 text-amber-500 shrink-0" />
                <span>Protocolo de Seguridad Hospitalaria</span>
              </div>
              <p>
                Por razones de confidencialidad y gobernanza clínica (Principio P5), el acceso a las funciones operativas debe ser autorizado por la administración de la institución.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full gap-2 text-xs font-semibold h-10 border-outline-variant text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Cerrar Sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AppFooterBar className="mt-8" />
    </div>
  );
}
