import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  LineChart,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-zinc-100 antialiased selection:bg-indigo-500/30">
      <SiteHeader />
      <main>
        <Hero />
        <LogoStrip />
        <Features />
        <Workflow />
        <Stats />
        <Testimonial />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-black">
            <Boxes className="size-[18px]" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">AssetFlow</span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Operations
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#workflow" className="transition-colors hover:text-white">
            Workflow
          </a>
          <a href="#stats" className="transition-colors hover:text-white">
            Platform
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-[0.98]"
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-14rem] size-[42rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]"
      />
      {/* subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 md:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300">
            <span className="size-1.5 rounded-full bg-indigo-400" />
            Enterprise asset & resource operations
          </span>

          <h1 className="mt-8 text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Track who holds what,
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              where it is, and its condition.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400">
            AssetFlow gives operations teams a single source of truth for every asset —
            allocations, transfers, bookings, maintenance and audits, all in real time.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[0.98] sm:w-auto"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              View the console
            </Link>
          </div>

          <p className="mt-4 font-mono text-xs text-zinc-500">
            Demo · admin@assetflow.dev · Password123!
          </p>
        </div>

        {/* console preview */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-2 shadow-2xl">
            <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0c0c0f]">
              <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
                <span className="size-2.5 rounded-full bg-zinc-700" />
                <span className="size-2.5 rounded-full bg-zinc-700" />
                <span className="size-2.5 rounded-full bg-zinc-700" />
                <span className="ml-4 font-mono text-xs text-zinc-500">app.assetflow.dev/dashboard</span>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-3">
                {[
                  { label: "Assets tracked", value: "1,284", tone: "text-white" },
                  { label: "In circulation", value: "912", tone: "text-indigo-300" },
                  { label: "Due for return", value: "37", tone: "text-amber-300" },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-xs text-zinc-500">{k.label}</p>
                    <p className={`mt-2 text-2xl font-semibold tabular-nums ${k.tone}`}>{k.value}</p>
                  </div>
                ))}
                <div className="sm:col-span-3">
                  <div className="flex items-end gap-2">
                    {[38, 52, 44, 68, 60, 82, 74, 96, 88, 71, 90, 64].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-indigo-600/40 to-indigo-400"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Logo strip                                                          */
/* ------------------------------------------------------------------ */

function LogoStrip() {
  const items = ["Operations", "Facilities", "IT Assets", "Field Teams", "Procurement", "Audit"];
  return (
    <section className="border-y border-white/5 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs uppercase tracking-widest text-zinc-600">
          Built for the teams that move inventory
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((label) => (
            <span key={label} className="text-sm font-medium text-zinc-500">
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Boxes,
    title: "Asset registry",
    body: "Register every device, tool and resource with categories, tags and a full custody history.",
  },
  {
    icon: RefreshCcw,
    title: "Allocation & transfer",
    body: "Hand assets to people or departments and move them with an auditable approval trail.",
  },
  {
    icon: MapPin,
    title: "Live location & status",
    body: "Always know where an asset is and its lifecycle state — in use, in transit, or in storage.",
  },
  {
    icon: ClipboardCheck,
    title: "Resource booking",
    body: "Let teams reserve bookable resources with conflict-free scheduling and check-in.",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    body: "Raise, approve and track maintenance so nothing critical slips through the cracks.",
  },
  {
    icon: ShieldCheck,
    title: "Audits & RBAC",
    body: "Run periodic audits and enforce who can do what with role-based access control.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-indigo-400">Everything in one console</p>
        <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          The full lifecycle of every asset
        </h2>
        <p className="mt-4 text-lg text-zinc-400">
          From the moment an asset is registered to the day it&apos;s retired — AssetFlow keeps a
          single, trustworthy record.
        </p>
      </div>

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group bg-[#09090b] p-8 transition-colors hover:bg-white/[0.03]"
          >
            <span className="flex size-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-indigo-300 transition-colors group-hover:border-indigo-400/40">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Workflow                                                            */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Register",
    body: "Add assets with categories, condition and custody. Bulk import or scan them in.",
  },
  {
    n: "02",
    title: "Allocate",
    body: "Assign to people or departments with approvals — every change is logged automatically.",
  },
  {
    n: "03",
    title: "Operate",
    body: "Book, transfer, service and return assets while status updates in real time.",
  },
  {
    n: "04",
    title: "Audit",
    body: "Reconcile the register with reality and export reports for compliance in a click.",
  },
];

function Workflow() {
  return (
    <section id="workflow" className="border-y border-white/5 bg-white/[0.02] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-indigo-400">How it works</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            A workflow your whole org can follow
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="font-mono text-sm text-indigo-400">{s.n}</span>
              <div className="mt-3 h-px w-full bg-gradient-to-r from-indigo-500/60 to-transparent" />
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

const STATS = [
  { value: "10k+", label: "Assets under management" },
  { value: "99.9%", label: "Register accuracy" },
  { value: "4", label: "Role-based access tiers" },
  { value: "Real-time", label: "Status & location" },
];

function Stats() {
  return (
    <section id="stats" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-[#09090b] p-8 text-center">
            <p className="bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonial                                                         */
/* ------------------------------------------------------------------ */

function Testimonial() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-24 md:pb-32">
      <figure className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-indigo-600/10 to-transparent p-10 text-center md:p-16">
        <LineChart className="mx-auto size-8 text-indigo-400" />
        <blockquote className="mt-6 text-balance text-2xl font-medium leading-snug tracking-tight md:text-3xl">
          &ldquo;We replaced three spreadsheets and a shared inbox with AssetFlow. For the first time,
          we actually trust our asset register.&rdquo;
        </blockquote>
        <figcaption className="mt-8 text-sm text-zinc-400">
          <span className="font-semibold text-white">Operations Lead</span> · Facilities & IT
        </figcaption>
      </figure>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CTA                                                                 */
/* ------------------------------------------------------------------ */

function CallToAction() {
  return (
    <section className="relative overflow-hidden border-t border-white/5">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[130px]"
      />
      <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
        <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Bring order to your assets.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg text-zinc-400">
          Spin up your operations console in minutes and see exactly what you own and where it is.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[0.98] sm:w-auto"
          >
            Get started free
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function SiteFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white text-black">
            <Boxes className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">AssetFlow</span>
        </div>
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} AssetFlow · Asset &amp; Resource Operations
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          Open the console
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </footer>
  );
}
