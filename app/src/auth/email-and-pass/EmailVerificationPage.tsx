import { VerifyEmailForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "../AuthPageLayout";
import { AUTH_APPEARANCE } from "../ambientAuthTheme";

export function EmailVerificationPage() {
  return (
    <AuthPageLayout>
      <VerifyEmailForm appearance={AUTH_APPEARANCE} />
      <br />
      <span className="text-sm font-medium text-muted-foreground">
        If everything is okay,{" "}
        <WaspRouterLink
          to={routes.LoginRoute.to}
          className="text-primary underline underline-offset-2"
        >
          go to login
        </WaspRouterLink>
      </span>
    </AuthPageLayout>
  );
}