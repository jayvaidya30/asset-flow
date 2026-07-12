import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Signature data chip. Renders an asset tag / serial / short id in Geist Mono,
 * so machine identifiers read as machine identifiers throughout the app.
 */
export function AssetTag({
  className,
  muted = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-mono text-xs tracking-tight",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
      {...props}
    />
  );
}
