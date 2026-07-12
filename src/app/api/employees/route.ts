import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (req) => {
  await requireRole("ADMIN");

  const url = new URL(req.url);
  const { page, pageSize } = paginationSchema.parse(
    Object.fromEntries(url.searchParams)
  );
  const skip = (page - 1) * pageSize;

  const select = {
    id: true,
    name: true,
    email: true,
    role: true,
    status: true,
    createdAt: true,
    department: { select: { id: true, name: true } },
    headedDepartments: { select: { id: true, name: true } },
  } as const;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select,
      skip,
      take: pageSize,
    }),
    prisma.employee.count(),
  ]);

  return ok({ employees, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});
