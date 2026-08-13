import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "../../client/components/ui/card";
import { cn } from "../../client/utils";
import { Feature } from "./Features";
import { SectionTitle } from "./SectionTitle";

export interface GridFeature extends Omit<Feature, "icon"> {
  icon?: React.ReactNode;
  emoji?: string;
  direction?: "col" | "row" | "col-reverse" | "row-reverse";
  align?: "center" | "left";
  size: "small" | "medium" | "large";
  fullWidthIcon?: boolean;
}

interface FeaturesGridProps {
  features: GridFeature[];
  className?: string;
}

/**
 * Composición desktop explícita y predecible sobre un grid de 6 columnas
 * (sin row-span, sin huecos de auto-placement):
 *   fila 1: 2 tarjetas (3+3)
 *   fila 2: 2 tarjetas (3+3)
 *   fila 3: 3 tarjetas (2+2+2)
 *   fila 4: 2 tarjetas (3+3)
 */
const DESKTOP_SPANS = [
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-3",
  "lg:col-span-3",
];

export function FeaturesGrid({ features, className = "" }: FeaturesGridProps) {
  return (
    <div
      className="mx-auto my-16 flex max-w-7xl flex-col gap-6 md:my-24"
      id="features"
    >
      <SectionTitle
        title="Características"
        description="Lo que DoctorIA hace por tu práctica clínica."
      />
      <div
        className={cn(
          "grid grid-cols-1 gap-4 px-6 md:grid-cols-2 md:px-8 lg:grid-cols-6",
          className,
        )}
      >
        {features.map((feature, idx) => (
          <FeaturesGridItem
            key={feature.name + feature.description}
            {...feature}
            desktopSpan={DESKTOP_SPANS[idx] ?? "lg:col-span-3"}
          />
        ))}
      </div>
    </div>
  );
}

function FeaturesGridItem({
  name,
  description,
  icon,
  emoji,
  href,
  desktopSpan,
}: GridFeature & { desktopSpan: string }) {
  const featureCard = (
    <Card className="group relative h-full min-h-[180px] overflow-hidden rounded-2xl border-border/60 bg-card transition-all duration-300 hover:border-cyan-400/25 hover:bg-card-accent hover:shadow-[0_0_30px_rgba(54,199,244,0.12)]">
      {/* Línea superior con gradiente sutil en hover */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/0 to-transparent transition-all duration-300 group-hover:via-cyan-400/50"
      />
      <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        {icon ? (
          <span className="flex size-12 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/5 text-cyan-300 transition-all duration-300 group-hover:border-cyan-400/30 group-hover:bg-cyan-400/10 group-hover:shadow-[0_0_20px_rgba(54,199,244,0.25)]">
            {icon}
          </span>
        ) : emoji ? (
          <span className="text-4xl">{emoji}</span>
        ) : null}
        <CardTitle className="text-foreground">{name}</CardTitle>
        <CardDescription className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );

  if (href) {
    const isExternal = href.startsWith("http");
    return (
      <a
        href={href}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={desktopSpan}
      >
        {featureCard}
      </a>
    );
  }

  return <div className={desktopSpan}>{featureCard}</div>;
}