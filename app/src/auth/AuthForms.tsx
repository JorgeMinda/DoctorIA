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

export function LoginFormES() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
      <FieldError message={error} />
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

export function SignupFormES() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await signup({
        email,
        password,
        username: email,
        isAdmin: false,
      });
      if (res.success) {
        setSuccess(
          "Cuenta creada. Revisa tu correo para verificarla (si aplica) e inicia sesión.",
        );
        setEmail("");
        setPassword("");
      } else {
        setError("No se pudo completar el registro. Intenta de nuevo.");
      }
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
        {loading ? "Creando cuenta…" : "Crear cuenta"}
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
