import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { SetupClient } from "./setup-client";

export default async function Page() {
  await requireRole("ADMIN");

  const [departments, categories, employees] = await Promise.all([
    prisma.department.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        headId: true,
        parentId: true,
        head: { select: { id: true, name: true, email: true, role: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { members: true, children: true } },
      },
    }),
    prisma.assetCategory.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        customFields: true,
        _count: { select: { assets: true } },
      },
    }),
    prisma.employee.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        department: { select: { id: true, name: true } },
        headedDepartments: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <SetupClient
      initialDepartments={departments}
      initialCategories={categories}
      initialEmployees={employees}
    />
  );
}
