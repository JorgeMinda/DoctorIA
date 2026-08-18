import { LoginForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";
import { AUTH_APPEARANCE } from "./ambientAuthTheme";
import { useRedirectIfLoggedIn } from "./hooks/useRedirectIfLoggedIn";

export function LoginPage() {
  useRedirectIfLoggedIn();

  return (
    <AuthPageLayout>
      <LoginForm appearance={AUTH_APPEARANCE} />
      <br />
      <span className="text-sm font-medium text-muted-foreground">
        Don&apos;t have an account yet?{" "}
        <WaspRouterLink
          to={routes.SignupRoute.to}
          className="text-primary underline underline-offset-2"
        >
          Go to signup
        </WaspRouterLink>
        .
      </span>
      <br />
      <span className="text-sm font-medium text-muted-foreground">
        Forgot your password?{" "}
        <WaspRouterLink
          to={routes.RequestPasswordResetRoute.to}
          className="text-primary underline underline-offset-2"
        >
          Reset it
        </WaspRouterLink>
        .
      </span>
    </AuthPageLayout>
  );
}