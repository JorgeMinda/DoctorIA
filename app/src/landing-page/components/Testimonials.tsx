import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "../../client/components/ui/card";
import { SectionTitle } from "./SectionTitle";

interface Testimonial {
  name: string;
  role: string;
  avatarSrc: string;
  socialUrl: string;
  quote: string;
}

export function Testimonials({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldShowExpand = testimonials.length > 5;
  const mobileItemsToShow = 3;
  const itemsToShow =
    shouldShowExpand && !isExpanded ? mobileItemsToShow : testimonials.length;

  return (
    <div className="mx-auto mt-32 max-w-7xl sm:mt-56 sm:px-6 lg:px-8">
      <SectionTitle title="Lo que dicen los profesionales" />

      <div className="relative z-10 w-full columns-1 gap-2 px-4 md:columns-2 md:gap-6 md:px-0 lg:columns-3">
          {testimonials.slice(0, itemsToShow).map((testimonial, idx) => (
          <div key={idx} className="mb-6 break-inside-avoid">
            <Card className="border-border/60 bg-card transition-all duration-300 hover:border-violet-400/25 hover:bg-card-accent hover:shadow-[0_0_30px_rgba(139,124,255,0.1)]">
              <CardContent className="p-6">
                <blockquote className="mb-4 leading-6">
                  <p className="text-foreground/90 text-sm italic leading-6">
                    {testimonial.quote}
                  </p>
                </blockquote>
              </CardContent>
              <CardFooter className="flex flex-col pt-0">
                <a
                  href={testimonial.socialUrl}
                  className="group flex w-full items-center gap-x-3 transition-all duration-200 hover:opacity-80"
                >
                  <img
                    src={testimonial.avatarSrc}
                    loading="lazy"
                    alt={`${testimonial.name}'s avatar`}
                    className="ring-cyan-400/20 group-hover:ring-cyan-400/40 h-10 w-10 shrink-0 rounded-full ring-2 transition-all duration-200"
                  />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="group-hover:text-foreground truncate text-sm font-semibold transition-colors duration-200">
                      {testimonial.name}
                    </CardTitle>
                    <CardDescription className="truncate text-xs">
                      {testimonial.role}
                    </CardDescription>
                  </div>
                </a>
              </CardFooter>
            </Card>
          </div>
        ))}
      </div>

      {shouldShowExpand && (
        <div className="mt-8 flex justify-center md:hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-6 py-3 text-sm font-medium transition-colors duration-200"
          >
            {isExpanded
              ? "Show Less"
              : `Show ${testimonials.length - mobileItemsToShow} More`}
          </button>
        </div>
      )}
    </div>
  );
}
