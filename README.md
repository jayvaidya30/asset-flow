# AssetFlow

Enterprise Asset & Resource Management System — hackathon build.

**Stack:** Next.js (App Router) · TypeScript · PostgreSQL · Prisma · custom JWT+bcrypt auth · Tailwind + shadcn-style UI.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure DB + secret
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET

# 3. Create schema + seed demo data
npm run db:push             # or: npm run db:migrate
npm run db:seed

# 4. Run
npm run dev                 # http://localhost:3000
```

**Demo logins** (password `Password123!`): `admin@assetflow.dev`, `manager@assetflow.dev`,
`head@assetflow.dev`, `priya@assetflow.dev` (holds laptop AF-0001), `raj@assetflow.dev`.

Useful scripts: `npm run db:studio` (browse data), `npm run db:reset` (wipe + reseed), `npm run typecheck`.

---

## Work division — 4 members, 4 vertical tracks

Each track owns its screens **end to end** (DB queries → API routes → UI). Branch off `main`,
work in `feature/<track>/*` branches, PR into `main`.

| Track | Owner | Screens | Route folders |
|-------|-------|---------|---------------|
| **1 · Platform & Org Setup** | | Login/Signup (1), Org Setup — Depts, Categories, Employee Directory + role promotion (3) | `src/app/(auth)/*`, `(app)/setup`, `src/lib/auth·session·rbac`, app shell |
| **2 · Asset Lifecycle** | | Asset Registration & Directory (4), Allocation & Transfer (5) | `(app)/assets`, `(app)/allocations`, `src/lib/asset-status.ts` |
| **3 · Booking, Maintenance & Audit** | | Resource Booking (6), Maintenance (7), Audit (8) | `(app)/bookings`, `(app)/maintenance`, `(app)/audits` |
| **4 · Dashboard, Reports & Notifications** | | Dashboard KPIs (2), Reports (9), Activity & Notifications (10) | `(app)/dashboard`, `(app)/reports`, `(app)/notifications` |

### Already built (shared foundation — don't rewrite, extend)

- **Auth**: `POST /api/auth/{login,signup,logout}`, JWT session cookie, `middleware.ts` route guard.
- **RBAC**: `requireRole(...)`, `requireAuth()`, `hasRole()` in `src/lib/rbac.ts`.
- **DB contract**: `prisma/schema.prisma` — all entities for all tracks, sectioned by owner.
- **API envelope**: `handle()`, `ok()`, `fail()` in `src/lib/api.ts` — use these so every endpoint matches.
- **Shared write helpers** (call these, don't hand-roll):
  - `notify()` / `notifyMany()` — `src/lib/notifications.ts` (any track emits; Track 4 reads).
  - `logActivity()` — `src/lib/activity.ts` (call after every state change).
  - `transitionAsset()` — `src/lib/asset-status.ts` — **the only place asset status changes.**
- **UI kit**: `src/components/ui/{button,input,card}.tsx` + `cn()`. Add more shadcn components as needed.

### Shared-ownership rules (agree before touching)

1. **Asset status is written by 3 tracks.** Only ever change it via `transitionAsset()`. Never `prisma.asset.update({ status })` directly.
2. **`prisma/schema.prisma` is shared.** Announce changes in the team channel; after editing run `npm run db:generate` and everyone re-pulls + `db:push`.
3. **Notifications/activity**: emit via the helpers so Track 4's feed & dashboard just work.
4. **`isBookable` flag** links Track 2 (registration) and Track 3 (booking).
5. **Overdue detection** (allocations past `expectedReturnDate`, bookings) lives in Track 2/3 queries; Track 4 consumes — don't duplicate the logic.

### Suggested API routes to build (per track)

```
Track 1  /api/departments        /api/categories        /api/employees  (+ role promotion)
Track 2  /api/assets             /api/allocations       /api/transfers
Track 3  /api/bookings           /api/maintenance       /api/audits
Track 4  /api/dashboard/kpis     /api/reports/*         /api/notifications
```

### Role permissions (from the spec)

- **Admin** — org setup, role assignment, org-wide analytics.
- **Asset Manager** — register/allocate assets, approve transfers/maintenance/returns + condition check-in.
- **Department Head** — dept-scoped views, approve dept allocation/transfer, book on behalf of dept.
- **Employee** — view own assets, book resources, raise maintenance, request return/transfer.

Enforce these with `requireRole(...)` at the top of each Route Handler.
