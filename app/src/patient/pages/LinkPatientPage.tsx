import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAction, useQuery } from "wasp/client/operations";
import { requestPatientLink, getMyLinkRequestStatus } from "wasp/client/operations";
import { useRole } from "../../client/hooks/useRole";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../client/components/ui/card";
import { toast } from "../../client/hooks/use-toast";
import { ShieldCheck, UserCheck, ArrowRight, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { validateDocument, normalizeDocument } from "../../shared/utils/documentValidation";
import logo from "../../client/static/logo.jpeg";

export function LinkPatientPage() {
  const navigate = useNavigate();
  const { isMedico, isSecretaria, isAdmin, isPaciente, isLoading } = useRole();

  const [tipoDocumento, setTipoDocumento] = useState<"CEDULA" | "PASAPORTE" | "OTRO">("CEDULA");
  const [documento, setDocumento] = useState("");
  const [paisEmisor, setPaisEmisor] = useState("EC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLinkFn = useAction(requestPatientLink);
  const { data: requestStatus, refetch: refetchStatus } = useQuery(getMyLinkRequestStatus);

  useEffect(() => {
    if (isLoading) return;
    if (isMedico || isSecretaria || isAdmin) {
      navigate("/clinical/patients", { replace: true });
    } else if (isPaciente || requestStatus?.status === "ACTIVE") {
      navigate("/patient/dashboard", { replace: true });
    }
  }, [isLoading, isMedico, isSecretaria, isAdmin, isPaciente, requestStatus, navigate]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizeDocument(documento);
    if (!norm) {
      setError("Ingresa tu número de documento de identidad");
      return;
    }

    const validation = validateDocument(tipoDocumento, norm);
    if (!validation.isValid) {
      setError(validation.error || "El formato del documento no es válido");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await requestLinkFn({
        tipoDocumento,
        documento: norm,
        paisEmisor,
      });
      toast({
        title: "Solicitud Enviada",
        description: res.message || "Tu solicitud ha sido recibida.",
      });
      refetchStatus();
    } catch (err: any) {
      setError(err?.message || "No se pudo procesar la solicitud. Verifica los datos e intenta nuevamente.");
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

  // Estado: Solicitud Pendiente de Aprobación
  if (requestStatus?.status === "PENDING") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center">
            <img src={logo} alt="DoctorIA" className="size-12 rounded-xl shadow-lg border border-primary/20" />
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">DoctorIA</h1>
            <p className="text-xs uppercase tracking-widest text-primary mono-label mt-0.5">Portal del Paciente</p>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-xl shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                <Clock className="size-6 animate-pulse" />
              </div>
              <CardTitle className="text-lg font-semibold text-amber-300">
                Solicitud en Revisión
              </CardTitle>
              <CardDescription className="text-xs text-foreground/80 pt-1">
                Tu solicitud de vinculación fue enviada y está siendo revisada por el consultorio médico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="rounded-lg border border-outline-variant/60 bg-surface/80 p-4 text-xs text-muted-foreground space-y-2">
                <p>
                  Por seguridad y confidencialidad de tus datos médicos, un administrador verificará tu identidad antes de habilitar el acceso.
                </p>
                <p className="font-medium text-foreground">
                  Recibirás acceso a tu historial clínico y citas tan pronto sea aprobada.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => refetchStatus()}
                className="w-full gap-2 border-outline-variant"
              >
                Comprobar Estado
              </Button>
            </CardContent>
          </Card>
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
              Vincular mi Ficha de Paciente
            </CardTitle>
            <CardDescription className="text-xs">
              Ingresa tu documento de identidad oficial registrado en el consultorio. Tu solicitud será validada antes de habilitar el acceso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequest} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {requestStatus?.status === "REJECTED" && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <XCircle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-medium">Solicitud previa no aprobada</strong>
                    <span>{requestStatus.rejectionReason || "Por favor verifica tus datos e intenta nuevamente."}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Tipo de Documento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoDocumento("CEDULA");
                      setPaisEmisor("EC");
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      tipoDocumento === "CEDULA"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-outline-variant text-muted-foreground hover:bg-surface-container"
                    }`}
                  >
                    Cédula
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDocumento("PASAPORTE")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      tipoDocumento === "PASAPORTE"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-outline-variant text-muted-foreground hover:bg-surface-container"
                    }`}
                  >
                    Pasaporte
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDocumento("OTRO")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      tipoDocumento === "OTRO"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-outline-variant text-muted-foreground hover:bg-surface-container"
                    }`}
                  >
                    Otro / PAC
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {tipoDocumento === "CEDULA"
                    ? "Número de Cédula (10 dígitos)"
                    : tipoDocumento === "PASAPORTE"
                    ? "Número de Pasaporte"
                    : "Número de Documento o Código PAC"}
                </label>
                <Input
                  type="text"
                  placeholder={
                    tipoDocumento === "CEDULA"
                      ? "Ej: 1710034065"
                      : tipoDocumento === "PASAPORTE"
                      ? "Ej: A1234567"
                      : "Ej: PAC-011"
                  }
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
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
                {busy ? "Enviando solicitud..." : "Solicitar Vinculación"}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-6 border-t border-outline-variant/60 pt-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Validación y vinculación protegida con RNF-002 y HMAC</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
