import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const customFieldSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["text", "number", "date", "boolean"]),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  customFields: z.array(customFieldSchema).optional().nullable(),
});

export const GET = handle(async () => {
  await requireAuth();

  const categories = await prisma.assetCategory.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { assets: true } } },
  });

  return ok(categories);
});

export const POST = handle(async (req) => {
  const session = await requireRole("ADMIN");
  const body = categorySchema.parse(await req.json());

  const existing = await prisma.assetCategory.findUnique({ where: { name: body.name } });
  if (existing) return fail("A category with that name already exists", 409);

  const category = await prisma.assetCategory.create({
    data: {
      name: body.name,
      status: body.status ?? "ACTIVE",
      customFields: (body.customFields ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
    include: { _count: { select: { assets: true } } },
  });

  await logActivity(session.sub, "CATEGORY_CREATED", "AssetCategory", category.id, {
    name: category.name,
  });

  return ok(category, 201);
});
