import * as React from "react";
import { cn } from "@/lib/utils";

// Chevron rendered as a background image so callers can freely size the select
// (width/height via className) without breaking indicator alignment.
const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, style, ...props }, ref) => (
  <select
    ref={ref}
    style={{
      backgroundImage: chevron,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 0.6rem center",
      ...style,
    }}
    className={cn(
      "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-xs transition-colors",
      "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/40",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";
