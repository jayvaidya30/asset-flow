import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";

export const GET = handle(async () => {
  await requireRole("ADMIN");

  const employees = await prisma.employee.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      headedDepartments: { select: { id: true, name: true } },
    },
  });

  return ok(employees);
});
