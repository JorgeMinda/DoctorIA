import { AuthPageLayout } from "./AuthPageLayout";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";
import { SignupFormES } from "./AuthForms";

export function SignupPage() {
  useRedirectIfLoggedIn();

  return (
    <AuthPageLayout>
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Crear cuenta
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Regístrate para usar DoctorIA.
      </p>
      <SignupFormES />
    </AuthPageLayout>
  );
}
