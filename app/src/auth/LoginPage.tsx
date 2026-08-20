import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";
import { LoginFormES } from "./AuthForms";

export function LoginPage() {
  useRedirectIfLoggedIn();

  return (
    <AuthPageLayout>
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Iniciar sesión
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Accede con tu cuenta de DoctorIA.
      </p>
      <LoginFormES />
    </AuthPageLayout>
  );
}
