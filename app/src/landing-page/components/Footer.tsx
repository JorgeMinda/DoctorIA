interface NavigationItem {
  name: string;
  href: string;
}

export function Footer({
  footerNavigation,
}: {
  footerNavigation: {
    app: NavigationItem[];
    company: NavigationItem[];
  };
}) {
  return (
    <div className="mx-auto mt-6 max-w-7xl px-6 lg:px-8">
      <footer
        aria-labelledby="footer-heading"
        className="relative border-t border-border/60 py-24 sm:mt-32"
      >
        <h2 id="footer-heading" className="sr-only">
          Footer
        </h2>
        <div className="mt-10 flex items-start justify-end gap-20">
          <div>
            <h3 className="text-foreground text-sm font-semibold leading-6">
              Aplicación
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              {footerNavigation.app.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-muted-foreground hover:text-cyan-300 text-sm leading-6 transition-colors duration-200"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-foreground text-sm font-semibold leading-6">
              Proyecto
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              {footerNavigation.company.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="text-muted-foreground hover:text-cyan-300 text-sm leading-6 transition-colors duration-200"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
