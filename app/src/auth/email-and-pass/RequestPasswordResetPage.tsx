import { ForgotPasswordForm } from "wasp/client/auth";
import { AuthPageLayout } from "../AuthPageLayout";
import { AUTH_APPEARANCE } from "../ambientAuthTheme";

export function RequestPasswordResetPage() {
  return (
    <AuthPageLayout>
      <ForgotPasswordForm appearance={AUTH_APPEARANCE} />
    </AuthPageLayout>
  );
}