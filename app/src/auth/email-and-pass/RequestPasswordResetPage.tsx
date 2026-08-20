import { AuthPageLayout } from "../AuthPageLayout";
import { RequestPasswordResetFormES } from "../AuthForms";

export function RequestPasswordResetPage() {
  return (
    <AuthPageLayout>
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Recuperar contraseña
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Te enviaremos un enlace a tu correo.
      </p>
      <RequestPasswordResetFormES />
    </AuthPageLayout>
  );
}
