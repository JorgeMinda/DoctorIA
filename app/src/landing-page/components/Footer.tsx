import { Clock, Facebook, Github, Linkedin, MapPin, Twitter } from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
}

const SOCIAL_LINKS = [
  { label: "LinkedIn", icon: Linkedin },
  { label: "Twitter / X", icon: Twitter },
  { label: "Facebook", icon: Facebook },
  { label: "GitHub", icon: Github },
];

function LinkColumn({
  title,
  items,
}: {
  title: string;
  items: NavigationItem[];
}) {
  return (
    <div>
      <h3 className="text-foreground text-sm font-semibold leading-6">{title}</h3>
      <ul role="list" className="mt-6 space-y-4">
        {items.map((item) => (
          <li key={item.name}>
            <a
              href={item.href}
              className="text-muted-foreground hover:text-primary text-sm leading-6 transition-colors duration-200"
            >
              {item.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({
  footerNavigation,
}: {
  footerNavigation: {
    app: NavigationItem[];
    company: NavigationItem[];
    legal: NavigationItem[];
  };
}) {
  return (
    <div className="mx-auto mt-10 max-w-7xl px-6 lg:px-8">
      <footer
        aria-labelledby="footer-heading"
        className="relative border-t border-border/60"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-wine-600 via-wine-400 to-[#58595b]"
        />
        <h2 id="footer-heading" className="sr-only">
          Pie de página
        </h2>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-14 md:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <a href="/" className="text-lg font-extrabold tracking-tight text-foreground">
              Doctor<span className="text-primary">IA</span>
            </a>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
              Asistencia clínica con IA para historiales clínicos digitales. La IA
              estructura; el médico decide.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                Quito · Ecuador
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-primary" />
                Lun–Vie 08:00–19:30
              </li>
            </ul>
            <div className="mt-5 flex gap-3">
              {SOCIAL_LINKS.map(({ label, icon: Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-all duration-200 hover:border-wine-400 hover:text-wine-400 hover:shadow-[0_0_10px_rgba(224,72,121,0.25)]"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <LinkColumn title="Aplicación" items={footerNavigation.app} />
          <LinkColumn title="Proyecto" items={footerNavigation.company} />
          <LinkColumn title="Legal" items={footerNavigation.legal} />
        </div>

        <div className="border-t border-white/10 bg-[#141016]">
          <div className="flex flex-col gap-2 py-4 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
            <p>
              © 2026 DoctorIA — Todos los derechos
              reservados.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="transition-colors duration-200 hover:text-wine-300"
              >
                Política de Privacidad
              </a>
              <a
                href="#"
                className="transition-colors duration-200 hover:text-wine-300"
              >
                Términos de Servicio
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}