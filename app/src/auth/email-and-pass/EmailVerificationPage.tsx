import { AuthPageLayout } from "../AuthPageLayout";
import { VerifyEmailFormES } from "../AuthForms";

export function EmailVerificationPage() {
  return (
    <AuthPageLayout>
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Verificación de correo
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Estamos verificando tu dirección de correo.
      </p>
      <VerifyEmailFormES />
    </AuthPageLayout>
  );
}
