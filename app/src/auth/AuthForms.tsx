import { FormEvent, useEffect, useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useNavigate } from "react-router";
import {
  login,
  signup,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "wasp/client/auth";
import { Button } from "../client/components/ui/button";
import { Input } from "../client/components/ui/input";

const fieldClass =
  "bg-surface/60 border-outline-variant text-foreground placeholder:text-muted-foreground focus-visible:ring-primary";

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-red-400" role="alert">
      {message}
    </p>
  );
}

function FieldSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-xs font-medium text-emerald-400" role="status">
      {message}
    </p>
  );
}

import { useAction } from "wasp/client/operations";
import { directVerifyUserEmail } from "wasp/client/operations";

export function LoginFormES() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const directVerifyFn = useAction(directVerifyUserEmail);

  const handleDirectVerify = async () => {
    if (!email.trim()) {
      setError("Ingresa primero tu correo para verificarlo.");
      return;
    }
    setVerifying(true);
    try {
      const res: any = await directVerifyFn({ email: email.trim() });
      setVerifyNotice(res?.message || "Cuenta verificada con éxito. Ya puedes ingresar con tu contraseña.");
      setError(null);
    } catch (err: any) {
      setError(err?.message || "No se pudo verificar la cuenta.");
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setVerifyNotice(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate("/patient/link");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Correo electrónico
        </label>
        <Input
          className={fieldClass}
          type="email"
          autoComplete="email"
          required
          placeholder="medico@doctoria.app"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Contraseña
        </label>
        <Input
          className={fieldClass}
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className="space-y-1.5">
          <FieldError message={error} />
          <button
            type="button"
            onClick={handleDirectVerify}
            disabled={verifying}
            className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 block text-center w-full"
          >
            {verifying ? "Activando cuenta..." : "¿No recibiste el correo de activación? Haz clic aquí para activar tu cuenta"}
          </button>
        </div>
      )}
      {verifyNotice && <FieldSuccess message={verifyNotice} />}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Ingresando…" : "Iniciar sesión"}
      </Button>
      <div className="space-y-1 pt-1 text-center text-sm font-medium text-muted-foreground">
        <p>
          ¿Olvidaste tu contraseña?{" "}
          <WaspRouterLink
            to={routes.RequestPasswordResetRoute.to}
            className="text-primary underline underline-offset-2"
          >
            Recupérala
          </WaspRouterLink>
        </p>
        <p>
          ¿Aún no tienes cuenta?{" "}
          <WaspRouterLink
            to={routes.SignupRoute.to}
            className="text-primary underline underline-offset-2"
          >
            Regístrate
          </WaspRouterLink>
        </p>
      </div>
    </form>
  );
}

import { directVerifyUserEmail, requestPatientLink } from "wasp/client/operations";

export function SignupFormES() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"CEDULA" | "PASAPORTE" | "OTRO">("CEDULA");
  const [documento, setDocumento] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const directVerifyFn = useAction(directVerifyUserEmail);
  const requestPatientLinkFn = useAction(requestPatientLink);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (!documento.trim()) {
        setError("Ingresa tu número de documento de identidad.");
        setLoading(false);
        return;
      }

      // 1. Registro estándar nativo de Wasp
      const signupRes = await signup({
        email: email.trim(),
        password,
        username: email.trim().split("@")[0],
        isAdmin: false,
      });

      if (!signupRes.success) {
        setError("No se pudo completar el registro. Verifica los datos.");
        setLoading(false);
        return;
      }

      // 2. Iniciar sesión (con auto-verificación directa para evitar bloqueo de Resend sandbox)
      try {
        await login({ email: email.trim(), password });
      } catch {
        try {
          await directVerifyFn({ email: email.trim() });
          await login({ email: email.trim(), password });
        } catch {
          // Continuar
        }
      }

      // 3. Crear la solicitud de vinculación en PostgreSQL
      try {
        await requestPatientLinkFn({
          tipoDocumento,
          documento: documento.trim(),
          paisEmisor: "EC",
        });
      } catch (linkErr: any) {
        console.error("Error al registrar solicitud de vinculación:", linkErr);
      }

      navigate("/patient/link", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "No se pudo completar el registro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Tipo de Documento
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTipoDocumento("CEDULA")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
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
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
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
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
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
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          {tipoDocumento === "CEDULA"
            ? "Número de Cédula (10 dígitos)"
            : tipoDocumento === "PASAPORTE"
            ? "Número de Pasaporte"
            : "Número de Documento o Código PAC"}
        </label>
        <Input
          className={fieldClass}
          type="text"
          required
          placeholder={
            tipoDocumento === "CEDULA"
              ? "Ej: 1710034065"
              : tipoDocumento === "PASAPORTE"
              ? "Ej: A1234567"
              : "Ej: PAC-011"
          }
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Correo electrónico
        </label>
        <Input
          className={fieldClass}
          type="email"
          autoComplete="email"
          required
          placeholder="paciente@doctoria.app"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Contraseña
        </label>
        <Input
          className={fieldClass}
          type="password"
          autoComplete="new-password"
          required
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <FieldError message={error} />
      <FieldSuccess message={success} />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Registrando…" : "Crear cuenta y solicitar vinculación"}
      </Button>
      <p className="text-center text-sm font-medium text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <WaspRouterLink
          to={routes.LoginRoute.to}
          className="text-primary underline underline-offset-2"
        >
          Inicia sesión
        </WaspRouterLink>
      </p>
    </form>
  );
}

export function RequestPasswordResetFormES() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await requestPasswordReset({ email });
      setSuccess("Te enviamos un enlace a tu correo para restablecer la contraseña.");
      setEmail("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo enviar el enlace. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Correo electrónico
        </label>
        <Input
          className={fieldClass}
          type="email"
          autoComplete="email"
          required
          placeholder="medico@doctoria.app"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <FieldError message={error} />
      <FieldSuccess message={success} />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando…" : "Enviar enlace"}
      </Button>
      <p className="text-center text-sm font-medium text-muted-foreground">
        <WaspRouterLink
          to={routes.LoginRoute.to}
          className="text-primary underline underline-offset-2"
        >
          Volver a iniciar sesión
        </WaspRouterLink>
      </p>
    </form>
  );
}

export function ResetPasswordFormES() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Falta el token de restablecimiento en la URL.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await resetPassword({ token, password });
      if (res.success) {
        setSuccess("Contraseña actualizada. Ya puedes iniciar sesión.");
        setPassword("");
      } else {
        setError("No se pudo restablecer la contraseña. El enlace puede haber expirado.");
      }
    } catch (err: any) {
      setError(err?.message ?? "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="mono-label text-[11px] uppercase tracking-wider text-muted-foreground">
          Nueva contraseña
        </label>
        <Input
          className={fieldClass}
          type="password"
          autoComplete="new-password"
          required
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <FieldError message={error} />
      <FieldSuccess message={success} />
      <Button type="submit" className="w-full" disabled={loading || !token}>
        {loading ? "Guardando…" : "Restablecer contraseña"}
      </Button>
      <p className="text-center text-sm font-medium text-muted-foreground">
        <WaspRouterLink
          to={routes.LoginRoute.to}
          className="text-primary underline underline-offset-2"
        >
          Ir a iniciar sesión
        </WaspRouterLink>
      </p>
    </form>
  );
}

export function VerifyEmailFormES() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!token) {
        if (active) {
          setLoading(false);
          setError("Falta el token de verificación en la URL.");
        }
        return;
      }
      try {
        const res = await verifyEmail({ token });
        if (active) {
          if (res.success) {
            setSuccess("Correo verificado correctamente. Ya puedes iniciar sesión.");
          } else {
            setError(res.reason ?? "No se pudo verificar el correo.");
          }
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "No se pudo verificar el correo.");
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="space-y-4">
      {loading && (
        <p className="text-sm font-medium text-muted-foreground">
          Verificando tu correo…
        </p>
      )}
      <FieldError message={error} />
      <FieldSuccess message={success} />
      <p className="text-center text-sm font-medium text-muted-foreground">
        <WaspRouterLink
          to={routes.LoginRoute.to}
          className="text-primary underline underline-offset-2"
        >
          Ir a iniciar sesión
        </WaspRouterLink>
      </p>
    </div>
  );
}
