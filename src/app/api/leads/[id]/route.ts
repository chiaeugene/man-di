import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { LEAD_STATUSES, DEPOSIT_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id, profileId: profile.id },
      include: {
        conversation: { include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } },
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found.");

    const packages = await prisma.package.findMany({
      where: { profileId: profile.id },
      select: { id: true, name: true },
    });

    return { lead, packages };
  });
}

const PatchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  depositStatus: z.enum(DEPOSIT_STATUSES).optional(),
  customerName: z.string().max(200).nullish(),
  phone: z.string().max(50).nullish(),
  eventDate: z.string().max(100).nullish(),
  location: z.string().max(200).nullish(),
  eventType: z.string().max(100).nullish(),
  budgetRange: z.string().max(100).nullish(),
  nextAction: z.string().max(500).nullish(),
});

// Manual edits by the photographer. This is the ONLY path to money states
// ("Deposit Paid", "Booked") — the AI cannot set them.
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const lead = await prisma.lead.findFirst({ where: { id, profileId: profile.id } });
    if (!lead) throw new ApiError(404, "Lead not found.");

    const body = PatchSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid lead data.");

    const data: Record<string, unknown> = { ...body.data };

    // Confirming the deposit implies the booking is secured.
    if (body.data.depositStatus === "CONFIRMED" && !body.data.status) {
      data.status = "Booked";
    }

    const updated = await prisma.lead.update({ where: { id }, data });
    return { lead: updated };
  });
}
