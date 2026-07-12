import { Brand } from "@/components/brand";

const SAMPLE = [
  { tag: "AF-0001", label: "Allocated", dot: "bg-brand" },
  { tag: "AF-0042", label: "Available", dot: "bg-emerald-400" },
  { tag: "AF-0108", label: "Maintenance", dot: "bg-amber-400" },
  { tag: "AF-0231", label: "Booked", dot: "bg-brand" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / thesis panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.06]" />
        <div className="relative">
          <Brand className="[&_span.bg-primary]:bg-primary-foreground [&_span.bg-primary]:text-primary [&_.text-muted-foreground]:text-primary-foreground/50" />
        </div>

        <div className="relative max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground/50">
            Asset &amp; Resource Operations
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight">
            Know who holds what, where it is, and its condition.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            AssetFlow replaces spreadsheets with structured asset lifecycles, conflict-free
            resource booking, and a complete activity trail — in real time.
          </p>

          <div className="mt-8 space-y-2 rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.04] p-4">
            {SAMPLE.map((row) => (
              <div key={row.tag} className="flex items-center justify-between text-sm">
                <span className="font-mono tracking-tight text-primary-foreground/90">{row.tag}</span>
                <span className="flex items-center gap-1.5 text-primary-foreground/60">
                  <span className={`size-1.5 rounded-full ${row.dot}`} />
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[11px] uppercase tracking-widest text-primary-foreground/40">
          Enterprise Asset Management
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
