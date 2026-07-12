import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const optionalId = z.string().cuid().nullable().optional();

const departmentUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  headId: optionalId,
  parentId: optionalId,
});

export const PATCH = handle(async (req, ctx) => {
  const session = await requireRole("ADMIN");
  const { id } = await ctx.params;
  const body = departmentUpdateSchema.parse(await req.json());

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return fail("Department not found", 404);
  if (body.parentId === id) return fail("A department cannot be its own parent", 422);

  if (body.headId) {
    const head = await prisma.employee.findUnique({ where: { id: body.headId } });
    if (!head) return fail("Selected department head was not found", 404);
  }
  if (body.parentId) {
    const parent = await prisma.department.findUnique({ where: { id: body.parentId } });
    if (!parent) return fail("Selected parent department was not found", 404);
  }

  const department = await prisma.department.update({
    where: { id },
    data: {
      name: body.name,
      status: body.status,
      headId: body.headId === null ? null : body.headId,
      parentId: body.parentId === null ? null : body.parentId,
    },
    include: {
      head: { select: { id: true, name: true, email: true, role: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { members: true, children: true } },
    },
  });

  await logActivity(session.sub, "DEPARTMENT_UPDATED", "Department", department.id, {
    name: department.name,
    status: department.status,
  });

  return ok(department);
});

export const DELETE = handle(async (_req, ctx) => {
  const session = await requireRole("ADMIN");
  const { id } = await ctx.params;

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return fail("Department not found", 404);

  const department = await prisma.department.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await logActivity(session.sub, "DEPARTMENT_DEACTIVATED", "Department", department.id, {
    name: department.name,
  });

  return ok(department);
});
