import { AuthPageLayout } from "../AuthPageLayout";
import { ResetPasswordFormES } from "../AuthForms";

export function PasswordResetPage() {
  return (
    <AuthPageLayout>
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Restablecer contraseña
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Define tu nueva contraseña.
      </p>
      <ResetPasswordFormES />
    </AuthPageLayout>
  );
}
