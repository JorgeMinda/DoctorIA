import { Menu } from "lucide-react";
import { useLocation } from "react-router";
import { useAuth } from "wasp/client/auth";
import { UserDropdown } from "../../../user/UserDropdown";
import { Button } from "../ui/button";
import { DarkModeSwitcher } from "../DarkModeSwitcher";
import { getClinicalSectionTitle } from "./nav-items";

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation();
  const { data: user, isLoading } = useAuth();
  const title = getClinicalSectionTitle(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-950/75 px-4 backdrop-blur-xl sm:px-6 lg:px-8 shadow-sm transition-colors duration-300">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10"
        onClick={onOpenMobile}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </Button>
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-slate-900 dark:text-white truncate text-lg font-bold tracking-tight">
          {title}
        </h1>
        <span className="mono-label text-slate-500 dark:text-slate-400 hidden truncate text-[11px] md:inline">
          {location.pathname}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DarkModeSwitcher />
        {isLoading ? null : user ? <UserDropdown user={user} /> : null}
      </div>
    </header>
  );
}
