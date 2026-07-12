import type { Lead, PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncGoogleCalendarOnLeadUpdate } from "@/lib/google-calendar/sync";

// The one place that ever applies a lead update involving money-state
// fields — whether triggered by the photographer's own edits (PATCH
// /api/leads/[id], which may include other field changes in the same
// request) or a verified AI payment confirmation (recordInboundImageMessage,
// which only ever passes { depositStatus: "CONFIRMED" }). `data` is mutated
// and used as-is, same as the original inline PATCH handler logic.
export async function applyLeadEdit(
  profile: PhotographerProfile,
  lead: Lead,
  data: Record<string, unknown>
): Promise<Lead> {
  // Confirming the deposit implies the booking is secured.
  if (data.depositStatus === "CONFIRMED" && !data.status) {
    data.status = "Booked";
  }
  await syncGoogleCalendarOnLeadUpdate(profile, lead, data);
  return prisma.lead.update({ where: { id: lead.id }, data });
}

// Convenience wrapper for the AI-verified auto-confirm path, which never has
// other simultaneous field edits to apply.
export async function confirmDepositAndBook(profile: PhotographerProfile, lead: Lead): Promise<Lead> {
  return applyLeadEdit(profile, lead, { depositStatus: "CONFIRMED" });
}
