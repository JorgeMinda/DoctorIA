import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAction } from "wasp/client/operations";
import { linkPatientAccount } from "wasp/client/operations";
import { useRole } from "../../client/hooks/useRole";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../client/components/ui/card";
import { toast } from "../../client/hooks/use-toast";
import { ShieldCheck, UserCheck, ArrowRight, Activity, AlertCircle } from "lucide-react";
import logo from "../../client/static/logo.jpeg";

export function LinkPatientPage() {
  const navigate = useNavigate();
  const { user, isMedico, isSecretaria, isAdmin, isPaciente, isLoading } = useRole();
  const [syntheticId, setSyntheticId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkFn = useAction(linkPatientAccount);

  useEffect(() => {
    if (isLoading) return;
    if (isMedico || isSecretaria || isAdmin) {
      navigate("/clinical/patients", { replace: true });
    } else if (isPaciente) {
      navigate("/patient/dashboard", { replace: true });
    }
  }, [isLoading, isMedico, isSecretaria, isAdmin, isPaciente, navigate]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syntheticId.trim()) {
      setError("Ingresa el código sintético asignado (ej. PAC-001)");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await linkFn({ syntheticId: syntheticId.trim() });
      toast({
        title: "¡Perfil de Paciente Vinculado!",
        description: "Tu cuenta ha sido vinculada correctamente. Redirigiendo a tu portal...",
      });
      navigate("/patient/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "No se pudo vincular el perfil. Verifica el código e intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Verificando sesión...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="DoctorIA" className="size-12 rounded-xl shadow-lg border border-primary/20" />
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            DoctorIA
          </h1>
          <p className="text-xs uppercase tracking-widest text-primary mono-label mt-0.5">
            Portal del Paciente
          </p>
        </div>

        <Card className="border-outline-variant bg-surface/90 backdrop-blur-xl shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,218,243,0.15)]">
              <UserCheck className="size-6" />
            </div>
            <CardTitle className="text-lg font-semibold">
              Vincula tu Identificador Clínico
            </CardTitle>
            <CardDescription className="text-xs">
              Ingresa el código sintético <span className="font-mono text-primary font-medium">PAC-XXX</span> proporcionado por tu centro médico para acceder a tu historial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLink} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Código de Paciente (PAC-XXX)
                </label>
                <Input
                  type="text"
                  placeholder="Ej: PAC-001"
                  value={syntheticId}
                  onChange={(e) => setSyntheticId(e.target.value.toUpperCase())}
                  className="font-mono text-center tracking-widest text-base uppercase"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2 shadow-lg"
                disabled={busy}
              >
                {busy ? "Vinculando..." : "Vincular y Continuar"}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-6 border-t border-outline-variant/60 pt-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Información clínica sintética protegida con RNF-002</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
