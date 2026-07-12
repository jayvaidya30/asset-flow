import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const departmentSchema = z.object({
  departmentId: z.string().cuid().nullable(),
});

export const PATCH = handle(async (req, ctx) => {
  const session = await requireRole("ADMIN");
  const { id } = await ctx.params;
  const { departmentId } = departmentSchema.parse(await req.json());

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { department: { select: { id: true, name: true } } },
  });
  if (!existing) return fail("Employee not found", 404);

  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return fail("Department not found", 404);
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: { departmentId },
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

  await logActivity(session.sub, "EMPLOYEE_DEPARTMENT_UPDATED", "Employee", employee.id, {
    email: employee.email,
    from: existing.department?.name ?? null,
    to: employee.department?.name ?? null,
  });

  return ok(employee);
});
