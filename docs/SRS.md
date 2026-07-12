# Software Requirements Specification (SRS)

**Project:** AssetFlow — Enterprise Asset & Resource Management System
**Version:** 1.0
**Date:** 2026-07-12
**Status:** Baseline (hackathon)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **AssetFlow**, a centralized ERP platform for tracking, allocating, and maintaining an organization's physical assets and shared resources. It is the reference for the development team, and the acceptance criteria for the delivered system.

### 1.2 Scope
AssetFlow lets any organization (office, school, hospital, factory, agency) replace spreadsheets and paper logs with structured asset lifecycles, centralized resource booking, and real-time visibility into who holds what, where it is, and its condition.

**In scope:** departments, asset categories, employee directory, asset lifecycle, allocation/transfer, resource booking, maintenance approval workflow, audit cycles, notifications, KPI dashboard, reports.

**Out of scope:** purchasing, invoicing, and accounting. `Acquisition Cost` is stored for ranking/reporting only and is **not** linked to any financial ledger.

### 1.3 Definitions & Abbreviations
| Term | Meaning |
|------|---------|
| Asset | A trackable physical item (equipment, furniture, vehicle, room). |
| Asset Tag | Auto-generated human ID, format `AF-0001`. |
| Allocation | Assignment of an asset to an employee or department. |
| Transfer | Change of an asset's holder, gated by approval. |
| Booking | A time-slot reservation of a shared/bookable asset. |
| Audit Cycle | A scoped, time-bounded verification pass over a set of assets. |
| Discrepancy | An asset flagged Missing or Damaged during an audit. |
| RBAC | Role-Based Access Control. |
| SRS / HLD / LLD | Software Requirements Spec / High- / Low-Level Design. |

### 1.4 References
- AssetFlow Problem Statement (hackathon brief).
- POC Mockup: https://app.excalidraw.com/l/65VNwvy7c4X/5ceOBMjbDby
- Companion documents: [HLD.md](./HLD.md), [LLD.md](./LLD.md).

---

## 2. Overall Description

### 2.1 Product Perspective
A greenfield, self-contained web application. Single-tenant per deployment. Server-rendered Next.js app backed by a PostgreSQL database.

### 2.2 User Classes and Characteristics
Roles are **never self-assigned**. Signup always creates a plain Employee; only an Admin promotes users in the Employee Directory.

| Role | Characteristics & Privileges |
|------|------------------------------|
| **Admin** | Manages departments, categories, audit cycles, and role assignment. Views organization-wide analytics. |
| **Asset Manager** | Registers and allocates assets. Approves transfers, maintenance requests, returns, and audit discrepancy resolution. |
| **Department Head** | Views assets allocated to their department. Approves allocation/transfer requests within their department. Books resources on behalf of the department. |
| **Employee** | Views assets allocated to them. Books shared resources. Raises maintenance requests. Initiates return/transfer requests. |

### 2.3 Operating Environment
- **Client:** Modern evergreen browser (Chrome, Edge, Firefox, Safari); responsive down to mobile widths.
- **Server:** Node.js runtime hosting Next.js (App Router).
- **Database:** PostgreSQL 14+.

### 2.4 Design & Implementation Constraints
- Stack fixed to Next.js + TypeScript + PostgreSQL + Prisma.
- Custom JWT + bcrypt authentication (no third-party auth provider).
- No financial/accounting integration.
- Role assignment restricted to the Admin-only Employee Directory.

### 2.5 Assumptions & Dependencies
- One organization per database instance.
- The first Admin is provisioned via seed/bootstrap, not via signup.
- Photos/documents are referenced by URL; file storage backend is pluggable.

---

## 3. Functional Requirements

Requirements are grouped by screen. Each is testable. Priority: **M** = Must, **S** = Should, **C** = Could.

### FR-1 Authentication (Login / Signup)
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-1.1 | Signup shall create an account with role **Employee only**; no role selection is offered at signup. | M |
| FR-1.2 | Users shall log in with email + password; sessions are validated on each protected request. | M |
| FR-1.3 | The system shall provide a forgot-password flow. | S |
| FR-1.4 | Passwords shall be stored only as salted hashes (bcrypt); never in plaintext. | M |
| FR-1.5 | Inactive employees shall be unable to log in. | M |

### FR-2 Dashboard / Home
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-2.1 | Display KPI cards: Assets Available, Assets Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns. | M |
| FR-2.2 | Overdue returns (past Expected Return Date) shall be highlighted separately from upcoming ones. | M |
| FR-2.3 | Provide quick actions: Register Asset, Book Resource, Raise Maintenance Request. | S |
| FR-2.4 | Dashboard content shall reflect the caller's role and scope. | M |

### FR-3 Organization Setup (Admin only)
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-3.1 | Admin shall create/edit/deactivate departments, assign a Department Head, optional Parent Department (hierarchy), and Active/Inactive status. | M |
| FR-3.2 | Admin shall create/edit asset categories with optional category-specific fields (e.g. warranty period). | M |
| FR-3.3 | Admin shall view the Employee Directory (Name, Email, Department, Role, Status). | M |
| FR-3.4 | Admin shall promote an Employee to Department Head or Asset Manager — **the only place roles are assigned**. | M |
| FR-3.5 | Only Admin may access any Organization Setup function. | M |

### FR-4 Asset Registration & Directory
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-4.1 | Register an asset with Name, Category, auto-generated Asset Tag (`AF-####`), Serial Number, Acquisition Date, Acquisition Cost, Condition, Location, photo/documents, and a shared/bookable flag. | M |
| FR-4.2 | Newly registered assets shall enter as **Available**. | M |
| FR-4.3 | Search/filter by Asset Tag, Serial Number, QR code, category, status, department, or location. | M |
| FR-4.4 | Display lifecycle status per asset (Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed). | M |
| FR-4.5 | Show per-asset allocation history and maintenance history. | M |
| FR-4.6 | Asset Tags shall be unique and monotonically generated. | M |

### FR-5 Asset Allocation & Transfer
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-5.1 | Allocate an asset to an employee/department with an optional Expected Return Date. | M |
| FR-5.2 | **Conflict rule:** the system shall block allocation of an already-held asset, display the current holder, and offer a Transfer Request instead. | M |
| FR-5.3 | Transfer workflow: Requested → Approved (Asset Manager / Department Head) → Re-allocated, with history updated automatically. | M |
| FR-5.4 | Return flow: mark returned, capture condition check-in notes; asset status reverts to Available. | M |
| FR-5.5 | Allocations past Expected Return Date shall be auto-flagged as overdue and feed the Dashboard and Notifications. | M |

### FR-6 Resource Booking
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-6.1 | Show a calendar view of a resource's existing bookings. | M |
| FR-6.2 | **Overlap validation:** reject a booking whose time range overlaps an existing one. Adjacent slots (end == start) are allowed. | M |
| FR-6.3 | Booking status lifecycle: Upcoming, Ongoing, Completed, Cancelled. | M |
| FR-6.4 | Support cancel/reschedule and a reminder notification before the slot starts. | S |
| FR-6.5 | Only assets flagged bookable may be booked. | M |

### FR-7 Maintenance Management
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-7.1 | Raise a request: select asset, describe issue, set priority, attach photo. | M |
| FR-7.2 | Workflow: Pending → Approved/Rejected (Asset Manager) → Technician Assigned → In Progress → Resolved. | M |
| FR-7.3 | On approval, asset status shall auto-update to Under Maintenance; on resolution, back to Available. | M |
| FR-7.4 | Maintenance history shall be retained per asset. | M |

### FR-8 Asset Audit
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-8.1 | Create an Audit Cycle with scope (department/location) and date range. | M |
| FR-8.2 | Assign one or more auditors to a cycle. | M |
| FR-8.3 | An auditor shall mark each in-scope asset Verified / Missing / Damaged. | M |
| FR-8.4 | The system shall auto-generate a discrepancy report for flagged items. | M |
| FR-8.5 | Closing a cycle shall lock it and update affected asset statuses (e.g. confirmed-missing → Lost). | M |
| FR-8.6 | Audit history shall be retained per cycle. | M |

### FR-9 Reports & Analytics
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-9.1 | Asset utilization trends; most-used vs. idle assets. | S |
| FR-9.2 | Maintenance frequency by asset/category. | S |
| FR-9.3 | Assets due for maintenance or nearing retirement. | C |
| FR-9.4 | Department-wise allocation summary. | S |
| FR-9.5 | Resource booking heatmap (peak usage windows). | C |
| FR-9.6 | Reports shall be exportable. | S |

### FR-10 Activity Logs & Notifications
| ID | Requirement | Pri |
|----|-------------|-----|
| FR-10.1 | Generate notifications for: Asset Assigned, Maintenance Approved/Rejected, Booking Confirmed/Cancelled/Reminder, Transfer Approved, Overdue Return Alert, Audit Discrepancy Flagged. | M |
| FR-10.2 | Maintain a full activity log of admin/manager/employee actions (who did what, when). | M |
| FR-10.3 | Users shall see their notifications and be able to mark them read. | S |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | **Security** | All mutations require an authenticated session; every restricted endpoint enforces RBAC server-side. Roles cannot be self-elevated. Passwords are bcrypt-hashed. Session tokens are signed (JWT), httpOnly cookies. |
| NFR-2 | **Data integrity** | An asset cannot be double-allocated. Bookings cannot overlap. Asset status changes only through validated transitions. |
| NFR-3 | **Usability** | Responsive UI, consistent component library, clear conflict/error messaging (e.g. "currently held by Priya"). |
| NFR-4 | **Performance** | Common list/search queries return < 500 ms on seed-scale data; indexed lookups on status, category, tag, and booking time ranges. |
| NFR-5 | **Auditability** | Every state-changing action is recorded in the activity log with actor, action, entity, and timestamp. |
| NFR-6 | **Maintainability** | Modular, track-owned code; a single shared data contract (Prisma schema); shared helpers for notifications, activity, and status transitions. |
| NFR-7 | **Reliability** | Multi-step mutations (e.g. transfer approval, audit close) execute atomically within DB transactions. |
| NFR-8 | **Portability** | Runs against any PostgreSQL instance (local Docker or cloud) via a single `DATABASE_URL`. |

---

## 5. External Interface Requirements

- **User Interface:** Web UI (Next.js pages), role-filtered navigation, calendar view for bookings, tabbed Organization Setup.
- **API:** JSON over HTTPS. Uniform response envelope `{ ok: true, data } | { ok: false, error, details }`.
- **Database:** PostgreSQL accessed via Prisma ORM.
- **Files:** Photos/documents referenced by URL (storage backend pluggable).

---

## 6. Acceptance Criteria (traceability highlights)

| Scenario | Expected result | Traces to |
|----------|-----------------|-----------|
| Employee signs up | Account created as Employee; no role picker shown | FR-1.1 |
| Raj allocates a laptop Priya already holds | Blocked; UI shows "currently held by Priya" + Transfer Request button | FR-5.2 |
| Book Room B2 9:30–10:30 when 9:00–10:00 exists | Rejected (overlap) | FR-6.2 |
| Book Room B2 10:00–11:00 when 9:00–10:00 exists | Accepted (adjacent) | FR-6.2 |
| Maintenance request approved | Asset flips to Under Maintenance; requester notified | FR-7.2/7.3 |
| Audit cycle closed with a Missing item | Cycle locked; asset set to Lost; discrepancy recorded | FR-8.5 |
| Non-admin opens Organization Setup | Access denied (403) | FR-3.5 |

---

*End of SRS. See [HLD.md](./HLD.md) for architecture and [LLD.md](./LLD.md) for detailed design.*
