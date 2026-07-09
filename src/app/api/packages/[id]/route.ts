import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { toJson } from "@/lib/json";
import { PackageInputSchema, serializePackage } from "@/lib/packages";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const existing = await prisma.package.findFirst({ where: { id, profileId: profile.id } });
    if (!existing) throw new ApiError(404, "Package not found.");

    const body = PackageInputSchema.partial().safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid package data.");

    const { deliverables, addOns, ...rest } = body.data;
    const updated = await prisma.package.update({
      where: { id },
      data: {
        ...rest,
        ...(deliverables !== undefined ? { deliverables: toJson(deliverables) } : {}),
        ...(addOns !== undefined ? { addOns: toJson(addOns) } : {}),
      },
      include: { attachments: { orderBy: { sortOrder: "asc" }, omit: { data: true } } },
    });
    return { package: serializePackage(updated) };
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const existing = await prisma.package.findFirst({ where: { id, profileId: profile.id } });
    if (!existing) throw new ApiError(404, "Package not found.");

    await prisma.package.delete({ where: { id } });
    return { ok: true };
  });
}
