import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { routes } from "wasp/client/router";
import { Toaster } from "../client/components/ui/toaster";
import "./Main.css";
import { NavBar } from "./components/NavBar/NavBar";
import { marketingNavigationItems } from "./components/NavBar/constants";
import { ClinicalLayout } from "./components/clinical-layout/ClinicalLayout";
import { CookieConsentBanner } from "./components/cookie-consent/Banner";

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export function App() {
  const location = useLocation();
  const isMarketingPage = useMemo(() => {
    return location.pathname === routes.LandingPageRoute.to;
  }, [location]);

  const navigationItems = isMarketingPage
    ? marketingNavigationItems
    : [];

  const shouldDisplayAppNavBar = useMemo(() => {
    return (
      location.pathname !== routes.LoginRoute.build() &&
      location.pathname !== routes.SignupRoute.build()
    );
  }, [location]);

  const isClinicalArea = useMemo(() => {
    return shouldDisplayAppNavBar && location.pathname.startsWith("/clinical");
  }, [location, shouldDisplayAppNavBar]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  return (
    <>
      <div className="bg-background text-foreground min-h-screen">
        {shouldDisplayAppNavBar ? (
          isClinicalArea ? (
            <ClinicalLayout>
              <Outlet />
            </ClinicalLayout>
          ) : (
            <>
              <NavBar navigationItems={navigationItems} />
              <div className="max-w-(--breakpoint-2xl) mx-auto">
                <Outlet />
              </div>
            </>
          )
        ) : (
          <div className="max-w-(--breakpoint-2xl) mx-auto">
            <Outlet />
          </div>
        )}
      </div>
      <Toaster position="bottom-right" />
      <CookieConsentBanner />
    </>
  );
}
