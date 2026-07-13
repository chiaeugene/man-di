import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { parseJson, toJson } from "@/lib/json";
import {
  BrandBrainSchema,
  SalesBrainSchema,
  BookingBrainSchema,
  PackageRulesSchema,
} from "@/lib/ai/schemas";

// The settings page edits the compiled brains directly (power-user view of
// what onboarding produced).
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    return {
      brandBrain: BrandBrainSchema.parse(parseJson(profile.brandBrain, {})),
      salesBrain: SalesBrainSchema.parse(parseJson(profile.salesBrain, {})),
      bookingBrain: BookingBrainSchema.parse(parseJson(profile.bookingBrain, {})),
      packageRules: PackageRulesSchema.parse(parseJson(profile.packageRules, {})),
      onboardingStatus: profile.onboardingStatus,
      whatsappPhoneId: profile.whatsappPhoneId,
      // Connection status only — googleRefreshToken is never returned here.
      googleCalendarConnected: profile.googleCalendarConnected,
      googleAccountEmail: profile.googleAccountEmail,
      maxBookingsPerDay: profile.maxBookingsPerDay,
      autoConfirmPayments: profile.autoConfirmPayments,
      sessionDurationMinutes: profile.sessionDurationMinutes,
      workingHoursStart: profile.workingHoursStart,
      workingHoursEnd: profile.workingHoursEnd,
      bufferMinutes: profile.bufferMinutes,
      workingDays: profile.workingDays,
      minAdvanceNoticeHours: profile.minAdvanceNoticeHours,
    };
  });
}

const PutSchema = z.object({
  brandBrain: BrandBrainSchema.optional(),
  salesBrain: SalesBrainSchema.optional(),
  bookingBrain: BookingBrainSchema.optional(),
  packageRules: PackageRulesSchema.optional(),
  whatsappPhoneId: z.string().max(60).nullish(),
  maxBookingsPerDay: z.number().int().positive().nullish(),
  autoConfirmPayments: z.boolean().optional(),
  sessionDurationMinutes: z.number().int().positive().max(24 * 60).nullish(),
  workingHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(),
  workingHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(),
  bufferMinutes: z.number().int().min(0).max(480).nullish(),
  workingDays: z
    .string()
    .regex(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(,(Sun|Mon|Tue|Wed|Thu|Fri|Sat))*$/)
    .nullish(),
  minAdvanceNoticeHours: z.number().int().min(0).max(720).nullish(),
});

export async function PUT(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PutSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid settings data.");

    const data: Record<string, string | number | boolean | null> = {};
    if (body.data.brandBrain) data.brandBrain = toJson(body.data.brandBrain);
    if (body.data.salesBrain) data.salesBrain = toJson(body.data.salesBrain);
    if (body.data.bookingBrain) data.bookingBrain = toJson(body.data.bookingBrain);
    if (body.data.packageRules) data.packageRules = toJson(body.data.packageRules);
    if (body.data.whatsappPhoneId !== undefined) data.whatsappPhoneId = body.data.whatsappPhoneId?.trim() || null;
    if (body.data.maxBookingsPerDay !== undefined) data.maxBookingsPerDay = body.data.maxBookingsPerDay ?? null;
    if (body.data.autoConfirmPayments !== undefined) data.autoConfirmPayments = body.data.autoConfirmPayments;
    if (body.data.sessionDurationMinutes !== undefined) data.sessionDurationMinutes = body.data.sessionDurationMinutes ?? null;
    if (body.data.workingHoursStart !== undefined) data.workingHoursStart = body.data.workingHoursStart ?? null;
    if (body.data.workingHoursEnd !== undefined) data.workingHoursEnd = body.data.workingHoursEnd ?? null;
    if (body.data.bufferMinutes !== undefined) data.bufferMinutes = body.data.bufferMinutes ?? null;
    if (body.data.workingDays !== undefined) data.workingDays = body.data.workingDays ?? null;
    if (body.data.minAdvanceNoticeHours !== undefined) data.minAdvanceNoticeHours = body.data.minAdvanceNoticeHours ?? null;

    const updated = await prisma.photographerProfile.update({
      where: { id: profile.id },
      data,
    });

    return {
      brandBrain: BrandBrainSchema.parse(parseJson(updated.brandBrain, {})),
      salesBrain: SalesBrainSchema.parse(parseJson(updated.salesBrain, {})),
      bookingBrain: BookingBrainSchema.parse(parseJson(updated.bookingBrain, {})),
      packageRules: PackageRulesSchema.parse(parseJson(updated.packageRules, {})),
      whatsappPhoneId: updated.whatsappPhoneId,
      maxBookingsPerDay: updated.maxBookingsPerDay,
      autoConfirmPayments: updated.autoConfirmPayments,
      sessionDurationMinutes: updated.sessionDurationMinutes,
      workingHoursStart: updated.workingHoursStart,
      workingHoursEnd: updated.workingHoursEnd,
      bufferMinutes: updated.bufferMinutes,
      workingDays: updated.workingDays,
      minAdvanceNoticeHours: updated.minAdvanceNoticeHours,
    };
  });
}
