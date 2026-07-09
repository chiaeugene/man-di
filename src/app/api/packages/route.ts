import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { toJson } from "@/lib/json";
import { PackageInputSchema, serializePackage } from "@/lib/packages";

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const packages = await prisma.package.findMany({
      where: { profileId: profile.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      // Never load the raw file bytes here — metadata only (see serializeAttachment).
      include: { attachments: { orderBy: { sortOrder: "asc" }, omit: { data: true } } },
    });
    return { packages: packages.map(serializePackage) };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PackageInputSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid package data.");

    const created = await prisma.package.create({
      data: {
        profileId: profile.id,
        ...body.data,
        deliverables: toJson(body.data.deliverables),
        addOns: toJson(body.data.addOns),
      },
    });
    return { package: serializePackage(created) };
  });
}
