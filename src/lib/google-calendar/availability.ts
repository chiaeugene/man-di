import type { PhotographerProfile } from "@prisma/client";
import { getValidAccessToken } from "./oauth";

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

// Best-effort by design, same discipline as events.ts/sync.ts: a broken
// calendar check must never break Mandy's reply. Never throws.
export async function checkGoogleCalendarBusy(
  profile: PhotographerProfile,
  isoDate: string
): Promise<{ checked: boolean; busy: boolean }> {
  if (!profile.googleCalendarConnected || !profile.googleRefreshToken) {
    return { checked: false, busy: false };
  }
  try {
    const accessToken = await getValidAccessToken(profile.googleRefreshToken);
    const calendarId = profile.googleCalendarId || "primary";
    const res = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // RFC3339 requires an explicit UTC offset — Google rejects
        // offset-less timestamps with a 400. +08:00 = Malaysia.
        timeMin: `${isoDate}T00:00:00+08:00`,
        timeMax: `${isoDate}T23:59:59+08:00`,
        timeZone: "Asia/Kuala_Lumpur",
        items: [{ id: calendarId }],
      }),
    });
    if (!res.ok) {
      console.error("[google-calendar] freebusy check failed", res.status, await res.text());
      return { checked: false, busy: false };
    }
    const data = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const busy = data.calendars?.[calendarId]?.busy ?? [];
    return { checked: true, busy: busy.length > 0 };
  } catch (err) {
    console.error("[google-calendar] freebusy check failed (non-fatal)", err);
    return { checked: false, busy: false };
  }
}

export type DateAvailability = {
  isoDate: string;
  googleChecked: boolean;
  googleBusy: boolean;
  internalBookedCount: number;
  maxBookingsPerDay: number | null;
  internalAtCapacity: boolean;
};

export async function resolveDateAvailability(
  profile: PhotographerProfile,
  isoDate: string,
  internalBookedCount: number
): Promise<DateAvailability> {
  const { checked, busy } = await checkGoogleCalendarBusy(profile, isoDate);
  const maxBookingsPerDay = profile.maxBookingsPerDay ?? null;
  return {
    isoDate,
    googleChecked: checked,
    googleBusy: busy,
    internalBookedCount,
    maxBookingsPerDay,
    internalAtCapacity: maxBookingsPerDay != null && internalBookedCount >= maxBookingsPerDay,
  };
}
