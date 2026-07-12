import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, fail, ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { listAssets, nextAssetTag, parseAssetFilters } from "@/lib/assets";
import { requireAuth, requireRole } from "@/lib/rbac";

const optionalText = (max = 255) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().max(2048).optional()
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
    .transform((value) => new Date(value))
    .optional()
);

const optionalMoney = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a positive amount with up to two decimals").optional()
);

const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1),
  serialNumber: optionalText(120),
  acquisitionDate: optionalDate,
  acquisitionCost: optionalMoney,
  condition: optionalText(120),
  location: optionalText(180),
  photoUrl: optionalUrl,
  documentsUrl: optionalUrl,
  isBookable: z.boolean().default(false),
  customValues: z.record(z.unknown()).optional(),
});

export const GET = handle(async (req) => {
  await requireAuth();

  const filters = parseAssetFilters(new URL(req.url).searchParams);
  const assets = await listAssets(filters);

  return ok({ assets });
});

export const POST = handle(async (req) => {
  const session = await requireRole("ASSET_MANAGER");
  const body = createAssetSchema.parse(await req.json());

  const category = await prisma.assetCategory.findFirst({
    where: { id: body.categoryId, status: "ACTIVE" },
    select: { id: true },
  });

  if (!category) return fail("Select an active asset category", 422);

  const asset = await prisma.$transaction(async (tx: any) => {
    const assetTag = await nextAssetTag(tx);

    return tx.asset.create({
      data: {
        assetTag,
        name: body.name,
        categoryId: body.categoryId,
        serialNumber: body.serialNumber,
        acquisitionDate: body.acquisitionDate,
        acquisitionCost: body.acquisitionCost,
        condition: body.condition,
        location: body.location,
        photoUrl: body.photoUrl,
        documentsUrl: body.documentsUrl,
        isBookable: body.isBookable,
        customValues: body.customValues as object | undefined,
      },
      include: { category: true },
    });
  });

  await logActivity(session.sub, "ASSET_REGISTERED", "Asset", asset.id, {
    assetTag: asset.assetTag,
    name: asset.name,
  });

  return ok(asset, 201);
});
