import { SignupForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";
import { AUTH_APPEARANCE } from "./ambientAuthTheme";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";

export function SignupPage() {
  useRedirectIfLoggedIn();

  return (
    <AuthPageLayout>
      <SignupForm appearance={AUTH_APPEARANCE} />
      <br />
      <span className="text-sm font-medium text-muted-foreground">
        I already have an account (
        <WaspRouterLink
          to={routes.LoginRoute.to}
          className="text-primary underline underline-offset-2"
        >
          go to login
        </WaspRouterLink>
        ).
      </span>
      <br />
    </AuthPageLayout>
  );
}