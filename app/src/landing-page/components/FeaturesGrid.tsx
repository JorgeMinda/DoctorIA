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

export function FeaturesGrid({ features, className = "" }: FeaturesGridProps) {
  return (
    <div
      className="mx-auto my-16 flex max-w-7xl flex-col gap-4 md:my-24 lg:my-40"
      id="features"
    >
      <SectionTitle
        title="Características"
        description="Lo que DoctorIA hace por tu práctica clínica."
      />
      <div
        className={cn(
          "mx-4 grid auto-rows-[minmax(140px,auto)] grid-cols-2 gap-4 md:mx-6 md:grid-cols-4 lg:mx-8 lg:grid-cols-6",
          className,
        )}
      >
        {features.map((feature) => (
          <FeaturesGridItem
            key={feature.name + feature.description}
            {...feature}
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
  direction = "col",
  align = "center",
  size = "medium",
  fullWidthIcon = true,
}: GridFeature) {
  const gridFeatureSizeToClasses: Record<GridFeature["size"], string> = {
    small: "col-span-1",
    medium: "col-span-2 md:col-span-2 lg:col-span-2",
    large: "col-span-2 md:col-span-2 lg:col-span-2 row-span-2",
  };

  const directionToClass: Record<
    NonNullable<GridFeature["direction"]>,
    string
  > = {
    col: "flex-col",
    row: "flex-row",
    "row-reverse": "flex-row-reverse",
    "col-reverse": "flex-col-reverse",
  };

  const gridFeatureCard = (
    <Card
      className={cn(
        "group relative h-full min-h-[140px] cursor-pointer overflow-hidden rounded-2xl border-border/60 bg-card transition-all duration-300",
        "hover:border-cyan-400/25 hover:bg-card-accent hover:shadow-[0_0_30px_rgba(54,199,244,0.12)]",
        gridFeatureSizeToClasses[size],
      )}
    >
      {/* Línea superior con gradiente sutil en hover */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/0 to-transparent transition-all duration-300 group-hover:via-cyan-400/50"
      />
      <CardContent className="flex h-full flex-col items-center justify-center p-4">
        {fullWidthIcon && (icon || emoji) ? (
          <div className="mb-4 flex w-full items-center justify-center">
            {icon ? (
              <span className="flex size-12 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/5 text-cyan-300 transition-all duration-300 group-hover:border-cyan-400/30 group-hover:bg-cyan-400/10 group-hover:shadow-[0_0_20px_rgba(54,199,244,0.25)]">
                {icon}
              </span>
            ) : emoji ? (
              <span className="text-4xl">{emoji}</span>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center gap-3",
              directionToClass[direction],
              align === "center"
                ? "items-center justify-center"
                : "justify-start",
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg">
              {icon ? (
                icon
              ) : emoji ? (
                <span className="text-2xl">{emoji}</span>
              ) : null}
            </div>
            <CardTitle
              className={cn(align === "center" ? "text-center" : "text-left")}
            >
              {name}
            </CardTitle>
          </div>
        )}
        {fullWidthIcon && (icon || emoji) && (
          <CardTitle className="text-foreground mb-2 text-center">
            {name}
          </CardTitle>
        )}
        <CardDescription
          className={cn(
            "text-muted-foreground text-xs leading-relaxed",
            fullWidthIcon || direction === "col" || align === "center"
              ? "text-center"
              : "text-left",
          )}
        >
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
        className={gridFeatureSizeToClasses[size]}
      >
        {gridFeatureCard}
      </a>
    );
  }

  return gridFeatureCard;
}
