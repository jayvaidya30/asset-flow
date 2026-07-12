import type { Role } from "@prisma/client";
import { getSession } from "./session";
import type { SessionPayload } from "./auth";

/**
 * Role-based access helpers. Use `requireRole` at the top of any Route Handler
 * that must be restricted, and `hasRole` for conditional UI/logic.
 *
 * Spec role rules:
 *   ADMIN            — org setup, role assignment, org-wide analytics
 *   ASSET_MANAGER    — register/allocate assets, approve transfers/maintenance/returns
 *   DEPARTMENT_HEAD  — dept-scoped views, approve dept allocation/transfer, book resources
 *   EMPLOYEE         — view own assets, book resources, raise maintenance, request return/transfer
 */

const ROLE_RANK: Record<Role, number> = {
  ADMIN: 3,
  ASSET_MANAGER: 2,
  DEPARTMENT_HEAD: 1,
  EMPLOYEE: 0,
};

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
  }
}

export function hasRole(session: SessionPayload | null, ...roles: Role[]): boolean {
  if (!session) return false;
  const roleSet = new Set(roles);
  return roleSet.has(session.role);
}

export function hasMinRole(session: SessionPayload | null, minRole: Role): boolean {
  if (!session) return false;
  return ROLE_RANK[session.role] >= ROLE_RANK[minRole];
}

/** Throws AuthError if not logged in, or lacks one of the allowed roles. Returns the session. */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Not authenticated");
  const roleSet = new Set(roles);
  if (roles.length && !roleSet.has(session.role)) {
    throw new AuthError(403, "Insufficient permissions");
  }
  return session;
}

/** Just requires a logged-in user, any role. */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Not authenticated");
  return session;
}
