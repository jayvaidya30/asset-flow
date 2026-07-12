import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
        <Boxes className="size-[18px]" />
      </span>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">AssetFlow</span>
          <span className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Operations
          </span>
        </span>
      )}
    </div>
  );
}
