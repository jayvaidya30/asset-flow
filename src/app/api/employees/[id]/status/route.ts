import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const PATCH = handle(async (req, ctx) => {
  const session = await requireRole("ADMIN");
  const { id } = await ctx.params;
  const { status } = statusSchema.parse(await req.json());

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return fail("Employee not found", 404);

  const activeAdmins = await prisma.employee.count({
    where: { role: "ADMIN", status: "ACTIVE" },
  });
  if (existing.role === "ADMIN" && status === "INACTIVE" && activeAdmins <= 1) {
    return fail("At least one active admin is required", 409);
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      department: { select: { id: true, name: true } },
      headedDepartments: { select: { id: true, name: true } },
    },
  });

  await logActivity(session.sub, "EMPLOYEE_STATUS_UPDATED", "Employee", employee.id, {
    email: employee.email,
    from: existing.status,
    to: employee.status,
  });

  return ok(employee);
});
