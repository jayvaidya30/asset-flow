import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui classname helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format the auto-incrementing asset tag, e.g. 1 -> "AF-0001". */
export function formatAssetTag(n: number): string {
  return `AF-${String(n).padStart(4, "0")}`;
}
