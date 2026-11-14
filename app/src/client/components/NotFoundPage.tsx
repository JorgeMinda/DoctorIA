import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useRole } from "../hooks/useRole";
import { getRoleHomePath } from "../roleHome";

export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const { role, isAuthenticated } = useRole();

  useEffect(() => {
    // Si el usuario escribió /dashboard o /Dashboard (en cualquier combinación de mayúsculas),
    // redirigir inteligentemente a su panel según su rol o al login si no tiene sesión iniciada.
    const normalized = location.pathname.toLowerCase().replace(/\/+$/, "");
    if (normalized === "/dashboard") {
      const destination = isAuthenticated ? getRoleHomePath(role) : "/login";
      navigate(destination, { replace: true });
    }
  }, [location.pathname, isAuthenticated, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold">404</h1>
        <p className="text-bodydark mb-8 text-lg">
          Oops! The page you're looking for doesn't exist.
        </p>
        <WaspRouterLink
          to={user ? routes.ClinicalPatientsRoute.to : routes.LandingPageRoute.to}
          className="text-accent-foreground bg-accent hover:bg-accent/90 inline-block rounded-lg px-8 py-3 font-semibold transition duration-300"
        >
          Go Back Home
        </WaspRouterLink>
      </div>
    </div>
  );
}
