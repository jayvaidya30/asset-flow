import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const customFieldSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["text", "number", "date", "boolean"]),
});

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  customFields: z.array(customFieldSchema).optional().nullable(),
});

export const PATCH = handle(async (req, ctx) => {
  const session = await requireRole("ADMIN");
  const { id } = await ctx.params;
  const body = categoryUpdateSchema.parse(await req.json());

  const existing = await prisma.assetCategory.findUnique({ where: { id } });
  if (!existing) return fail("Category not found", 404);

  if (body.name && body.name !== existing.name) {
    const duplicate = await prisma.assetCategory.findUnique({ where: { name: body.name } });
    if (duplicate) return fail("A category with that name already exists", 409);
  }

  const category = await prisma.assetCategory.update({
    where: { id },
    data: {
      name: body.name,
      status: body.status,
      customFields:
        body.customFields === undefined
          ? undefined
          : ((body.customFields ?? Prisma.JsonNull) as Prisma.InputJsonValue),
    },
    include: { _count: { select: { assets: true } } },
  });

  await logActivity(session.sub, "CATEGORY_UPDATED", "AssetCategory", category.id, {
    name: category.name,
    status: category.status,
  });

  return ok(category);
});

export const DELETE = handle(async (_req, ctx) => {
  const session = await requireRole("ADMIN");
  const { id } = await ctx.params;

  const existing = await prisma.assetCategory.findUnique({ where: { id } });
  if (!existing) return fail("Category not found", 404);

  const category = await prisma.assetCategory.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await logActivity(session.sub, "CATEGORY_DEACTIVATED", "AssetCategory", category.id, {
    name: category.name,
  });

  return ok(category);
});
