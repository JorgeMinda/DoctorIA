import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 border border-primary/35 text-primary shadow-[0_0_15px_rgba(0,218,243,0.15)] hover:bg-primary/25 hover:border-primary/50 backdrop-blur-md active:scale-[0.98]",
        destructive:
          "bg-destructive/15 border border-destructive/35 text-destructive shadow-sm hover:bg-destructive/25 hover:border-destructive/50 backdrop-blur-sm active:scale-[0.98]",
        outline:
          "border border-outline-variant/80 bg-surface/50 text-foreground shadow-sm hover:bg-surface-high hover:border-outline backdrop-blur-sm active:scale-[0.98]",
        secondary:
          "bg-surface/80 border border-outline-variant/60 text-foreground shadow-sm hover:bg-surface-high hover:border-outline backdrop-blur-sm active:scale-[0.98]",
        ghost: "hover:bg-surface-high/60 hover:text-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        ai: "bg-gradient-to-r from-primary/15 via-accent/20 to-primary/15 border border-primary/40 text-primary shadow-[0_0_15px_rgba(0,218,243,0.22)] hover:bg-primary/25 hover:border-primary/60 backdrop-blur-md active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
