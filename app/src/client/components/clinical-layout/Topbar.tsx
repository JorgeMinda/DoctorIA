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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/40 bg-white/60 dark:bg-slate-950/65 px-4 backdrop-blur-xl sm:px-6 lg:px-8 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-muted-foreground hover:text-foreground"
        onClick={onOpenMobile}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </Button>
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-foreground truncate text-lg font-bold tracking-tight">
          {title}
        </h1>
        <span className="mono-label text-muted-foreground/80 hidden truncate text-[11px] md:inline">
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
