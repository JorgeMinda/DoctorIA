import { Bot } from "lucide-react";
import { cn } from "../../client/utils";

interface FeatureProps {
  name: string;
  description: string | React.ReactNode;
  direction?: "row" | "row-reverse";
  highlightedComponent: React.ReactNode;
  tilt?: "left" | "right";
}

/**
 * A component that highlights a feature with a description and a highlighted component.
 * Shows text description on one side, and whatever component you want to show on the other side to demonstrate the functionality.
 */
export function HighlightedFeature({
  name,
  description,
  direction = "row",
  highlightedComponent,
  tilt,
}: FeatureProps) {
  const tiltToClass: Record<Required<FeatureProps>["tilt"], string> = {
    left: "rotate-1",
    right: "-rotate-1",
  };

  return (
    <div
      className={cn(
        "mx-auto my-16 flex max-w-6xl flex-col items-center justify-between gap-x-12 gap-y-10 px-6 transition-all duration-300 ease-in-out md:my-20 lg:px-8",
        direction === "row" ? "md:flex-row" : "md:flex-row-reverse",
      )}
    >
      <div className="flex-1 flex-col text-center md:text-left">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/5 px-3 py-1">
          <Bot className="size-3.5 text-violet-300" />
          <span className="text-violet-300 text-[11px] font-semibold tracking-[0.2em] uppercase">
            Asistencia clínica
          </span>
        </div>
        <h2 className="mb-3 text-4xl font-bold tracking-tight">{name}</h2>
        {typeof description === "string" ? (
          <p className="text-muted-foreground text-lg leading-8">
            {description}
          </p>
        ) : (
          description
        )}
      </div>
      <div
        className={cn(
          "flex w-full flex-1 items-center justify-center transition-transform duration-300 ease-in-out",
          tilt && tiltToClass[tilt],
        )}
      >
        {highlightedComponent}
      </div>
    </div>
  );
}
