import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalId = z.string().cuid().nullable().optional();

const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  headId: optionalId,
  parentId: optionalId,
});

export const GET = handle(async (req) => {
  await requireAuth();

  const url = new URL(req.url);
  const { page, pageSize } = paginationSchema.parse(
    Object.fromEntries(url.searchParams)
  );
  const skip = (page - 1) * pageSize;

  const include = {
    head: { select: { id: true, name: true, email: true, role: true } },
    parent: { select: { id: true, name: true } },
    _count: { select: { members: true, children: true } },
  } as const;

  const [departments, total] = await Promise.all([
    prisma.department.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include,
      skip,
      take: pageSize,
    }),
    prisma.department.count(),
  ]);

  return ok({ departments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

export const POST = handle(async (req) => {
  const session = await requireRole("ADMIN");
  const body = departmentSchema.parse(await req.json());

  if (body.headId) {
    const head = await prisma.employee.findUnique({ where: { id: body.headId } });
    if (!head) return fail("Selected department head was not found", 404);
  }
  if (body.parentId) {
    const parent = await prisma.department.findUnique({ where: { id: body.parentId } });
    if (!parent) return fail("Selected parent department was not found", 404);
  }

  const department = await prisma.department.create({
    data: {
      name: body.name,
      status: body.status ?? "ACTIVE",
      headId: body.headId ?? undefined,
      parentId: body.parentId ?? undefined,
    },
    include: {
      head: { select: { id: true, name: true, email: true, role: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { members: true, children: true } },
    },
  });

  await logActivity(session.sub, "DEPARTMENT_CREATED", "Department", department.id, {
    name: department.name,
  });

  return ok(department, 201);
});
