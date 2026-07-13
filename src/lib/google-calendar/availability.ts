import type { PhotographerProfile } from "@prisma/client";
import { getValidAccessToken } from "./oauth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type BusyInterval = { start: string; end: string }; // ISO datetimes from Google

// Best-effort by design, same discipline as events.ts/sync.ts: a broken
// calendar check must never break Mandy's reply. Never throws.
//
// Deliberately reads the real event list instead of calling the freeBusy
// API. freeBusy only reports events marked "Busy" — an event the
// photographer created and left as (or manually set to) "Show as: Free" is
// invisible to it, even though it's a real commitment. Confirmed against a
// real production event: a genuine 8-9am booking was marked
// transparency:"transparent" and freeBusy silently reported the day as
// fully clear, which let Mandy offer that exact slot to a different
// customer. Treating every non-cancelled calendar event as occupied time —
// regardless of its Free/Busy marking — is the safe default for a
// scheduling assistant that can't rely on the photographer remembering to
// mark everything Busy.
export async function checkGoogleCalendarBusy(
  profile: PhotographerProfile,
  isoDate: string
): Promise<{ checked: boolean; busy: boolean; busyIntervals: BusyInterval[] }> {
  if (!profile.googleCalendarConnected || !profile.googleRefreshToken) {
    return { checked: false, busy: false, busyIntervals: [] };
  }
  try {
    const accessToken = await getValidAccessToken(profile.googleRefreshToken);
    const calendarId = profile.googleCalendarId || "primary";
    const params = new URLSearchParams({
      // RFC3339 requires an explicit UTC offset — Google rejects
      // offset-less timestamps with a 400. +08:00 = Malaysia.
      timeMin: `${isoDate}T00:00:00+08:00`,
      timeMax: `${isoDate}T23:59:59+08:00`,
      singleEvents: "true",
    });
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[google-calendar] event list check failed", res.status, await res.text());
      return { checked: false, busy: false, busyIntervals: [] };
    }
    const data = (await res.json()) as {
      items?: { status?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string } }[];
    };
    const busyIntervals: BusyInterval[] = (data.items ?? [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({ start: e.start?.dateTime ?? e.start?.date ?? "", end: e.end?.dateTime ?? e.end?.date ?? "" }))
      .filter((e) => e.start && e.end);
    return { checked: true, busy: busyIntervals.length > 0, busyIntervals };
  } catch (err) {
    console.error("[google-calendar] event list check failed (non-fatal)", err);
    return { checked: false, busy: false, busyIntervals: [] };
  }
}

// ---------- Time-slot math (pure functions, no I/O) ----------

const SLOT_STEP_MINUTES = 30;
export const DEFAULT_WORKING_HOURS_START = "09:00";
export const DEFAULT_WORKING_HOURS_END = "19:00";

export function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToHhMm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// A date-only string (all-day event boundary, e.g. "2026-08-08") is not an
// instant — anchor it to local midnight explicitly. Parsing it as a bare
// ISO date would read as UTC midnight, which is 8am local time in Malaysia,
// shifting an all-day block's start 8 hours late.
function toEpochMs(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+08:00`).getTime();
  return new Date(value).getTime();
}

// Converts a Google busy interval to [startMin, endMin) minutes-of-day for
// the given date, clamped to the day. Google returns the times in UTC or with
// offsets — normalize via the Malaysia offset the query itself used.
function busyIntervalToMinutes(interval: BusyInterval, isoDate: string): [number, number] | null {
  const dayStart = new Date(`${isoDate}T00:00:00+08:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const start = toEpochMs(interval.start);
  const end = toEpochMs(interval.end);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= dayStart || start >= dayEnd) return null;
  const clampedStart = Math.max(start, dayStart);
  const clampedEnd = Math.min(end, dayEnd);
  return [Math.floor((clampedStart - dayStart) / 60000), Math.ceil((clampedEnd - dayStart) / 60000)];
}

export type InternalBooking = { time: string | null }; // "HH:MM" or null (no time known)

// Which start times can fit a full session without overlapping any Google
// busy interval or any internally booked session? Walks the working window
// in 30-minute steps. Internal bookings without a known time can't block a
// specific slot — the day-level maxBookingsPerDay cap covers those.
//
// bufferMinutes pads every commitment on both sides (travel/setup/rest time)
// before checking overlap — a session ending at 11:00 with a 30min buffer
// blocks new sessions from starting until 11:30, not 11:00.
//
// earliestStartMinute is a floor on the window's start, used to enforce a
// minimum-advance-notice rule for "today" (or any date close enough that the
// notice period spills into it) — computed by the caller since it depends on
// the real current time, not just the date being checked.
export function computeOpenSlots(opts: {
  isoDate: string;
  busyIntervals: BusyInterval[];
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  sessionDurationMinutes: number;
  internalBookings: InternalBooking[];
  bufferMinutes?: number | null;
  earliestStartMinute?: number | null;
}): string[] {
  const buffer = opts.bufferMinutes ?? 0;
  let windowStart = parseHhMm(opts.workingHoursStart) ?? parseHhMm(DEFAULT_WORKING_HOURS_START)!;
  if (opts.earliestStartMinute != null) windowStart = Math.max(windowStart, opts.earliestStartMinute);
  const windowEnd = parseHhMm(opts.workingHoursEnd) ?? parseHhMm(DEFAULT_WORKING_HOURS_END)!;
  const duration = opts.sessionDurationMinutes;

  const blocked: [number, number][] = [];
  for (const interval of opts.busyIntervals) {
    const mins = busyIntervalToMinutes(interval, opts.isoDate);
    if (mins) blocked.push([mins[0] - buffer, mins[1] + buffer]);
  }
  for (const booking of opts.internalBookings) {
    const start = parseHhMm(booking.time);
    if (start != null) blocked.push([start - buffer, start + duration + buffer]);
  }

  const open: string[] = [];
  for (let start = windowStart; start + duration <= windowEnd; start += SLOT_STEP_MINUTES) {
    const end = start + duration;
    const clashes = blocked.some(([bStart, bEnd]) => start < bEnd && end > bStart);
    if (!clashes) open.push(minutesToHhMm(start));
  }
  return open;
}

// The studio's own timezone weekday, regardless of the server's local TZ —
// noon anchors it safely away from any midnight boundary edge cases.
function isoDateWeekday(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuala_Lumpur", weekday: "short" }).format(d);
}

// Converts a minimum-advance-notice rule into a floor on the day's start
// minute. Returns null when the date is far enough out that no restriction
// applies, or a value >= 24*60 when the entire day is too soon to book at all.
function computeEarliestStartMinute(minAdvanceNoticeHours: number | null, isoDate: string): number | null {
  if (minAdvanceNoticeHours == null) return null;
  const earliestInstant = Date.now() + minAdvanceNoticeHours * 60 * 60 * 1000;
  const dayStart = new Date(`${isoDate}T00:00:00+08:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  if (earliestInstant <= dayStart) return null;
  if (earliestInstant >= dayEnd) return 24 * 60;
  return Math.ceil((earliestInstant - dayStart) / 60000);
}

export type DateAvailability = {
  isoDate: string;
  googleChecked: boolean;
  googleBusy: boolean;
  internalBookedCount: number;
  maxBookingsPerDay: number | null;
  internalAtCapacity: boolean;
  // Time-slot layer — null when no sessionDurationMinutes is configured
  // (full-day mode, e.g. weddings), which keeps day-level behavior.
  requestedTime: string | null;
  requestedTimeClash: boolean;
  openSlots: string[] | null;
  isNonWorkingDay: boolean;
};

export async function resolveDateAvailability(
  profile: PhotographerProfile,
  isoDate: string,
  internalBookings: InternalBooking[],
  requestedTime: string | null = null
): Promise<DateAvailability> {
  const workingDays = profile.workingDays
    ? profile.workingDays.split(",").map((d) => d.trim()).filter(Boolean)
    : null;
  const isNonWorkingDay = workingDays != null && !workingDays.includes(isoDateWeekday(isoDate));

  const { checked, busy, busyIntervals } = await checkGoogleCalendarBusy(profile, isoDate);
  const maxBookingsPerDay = profile.maxBookingsPerDay ?? null;
  const internalBookedCount = internalBookings.length;
  const duration = profile.sessionDurationMinutes ?? null;

  let openSlots: string[] | null = null;
  let requestedTimeClash = false;
  if (duration != null && checked) {
    if (isNonWorkingDay) {
      openSlots = [];
    } else {
      openSlots = computeOpenSlots({
        isoDate,
        busyIntervals,
        workingHoursStart: profile.workingHoursStart,
        workingHoursEnd: profile.workingHoursEnd,
        sessionDurationMinutes: duration,
        internalBookings,
        bufferMinutes: profile.bufferMinutes ?? 0,
        earliestStartMinute: computeEarliestStartMinute(profile.minAdvanceNoticeHours ?? null, isoDate),
      });
    }
    const reqStart = parseHhMm(requestedTime);
    if (reqStart != null) requestedTimeClash = !openSlots.includes(minutesToHhMm(reqStart));
  }

  return {
    isoDate,
    googleChecked: checked,
    // In slot mode, "some event exists today" is no longer a day-level
    // conflict by itself — open slots decide. Full-day mode keeps the
    // original meaning.
    googleBusy: duration != null && openSlots != null ? openSlots.length === 0 && busy : busy,
    internalBookedCount,
    maxBookingsPerDay,
    internalAtCapacity: maxBookingsPerDay != null && internalBookedCount >= maxBookingsPerDay,
    requestedTime,
    requestedTimeClash,
    openSlots,
    isNonWorkingDay,
  };
}
