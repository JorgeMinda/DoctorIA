import { Link, useLocation } from "react-router";
import { useRole } from "../../hooks/useRole";
import logo from "../../static/logo.jpeg";
import { cn } from "../../utils";
import {
  getNavGroupsForRole,
  isClinicalNavItemActive,
} from "./nav-items";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user, role } = useRole();

  const navGroups = getNavGroupsForRole(role);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
        <img src={logo} alt="DoctorIA" className="size-8 rounded-md" />
        <div className="flex flex-col leading-tight">
          <span className="text-foreground font-semibold">DoctorIA</span>
          <span className="mono-label text-muted-foreground text-[10px] uppercase tracking-widest">
            Clinical Intelligence
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mono-label text-muted-foreground/70 px-3 pb-2 text-[10px] font-medium uppercase tracking-widest">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isClinicalNavItemActive(location.pathname, item.to);
                return (
                  <li key={item.name}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-all duration-200",
                        active
                          ? "border-primary/25 bg-primary/10 text-primary shadow-[0_0_16px_rgba(0,218,243,0.10)]"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" aria-hidden />
                      {item.name}
                      {active && (
                        <span className="ml-auto size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-surface-container border-outline-variant flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold uppercase text-primary">
              {(user.username ?? "?").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {user.username}
              </p>
              <p className="mono-label text-muted-foreground truncate text-[11px]">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="bg-surface fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border lg:block">
      <SidebarContent />
    </aside>
  );
}
