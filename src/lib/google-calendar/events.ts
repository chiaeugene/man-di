import type { PhotographerProfile } from "@prisma/client";
import { getValidAccessToken } from "./oauth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarEventError extends Error {}

// Accepts the strict "YYYY-MM-DD" the AI is now instructed to produce, plus a
// lenient fallback for older leads / manual edits that predate that rule.
// Returns null if the value can't be resolved to a real calendar date.
export function parseEventDateToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Non-ISO strings (e.g. "14 November 2026") are parsed as local time by
  // JS, so read the date back out with local getters — using UTC getters
  // here would shift the date back a day in any UTC+ timezone.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function calendarId(profile: PhotographerProfile): string {
  return profile.googleCalendarId || "primary";
}

async function callCalendarApi(
  profile: PhotographerProfile,
  path: string,
  init: RequestInit
): Promise<Response> {
  if (!profile.googleRefreshToken) {
    throw new GoogleCalendarEventError("Google Calendar is not connected for this account.");
  }
  const accessToken = await getValidAccessToken(profile.googleRefreshToken);
  return fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId(profile))}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export type BookingEventDetails = {
  isoDate: string;
  startTime: string | null; // "HH:MM" 24h; null = all-day event
  durationMinutes: number | null; // session length; null = all-day event
  customerName: string | null;
  eventType: string | null;
  location: string | null;
  budgetRange: string | null;
};

// "HH:MM" + duration → RFC3339 dateTime pair with the Malaysia offset
// (Google rejects offset-less timestamps — same lesson as the freeBusy fix).
function timedRange(isoDate: string, startTime: string, durationMinutes: number) {
  const start = new Date(`${isoDate}T${startTime}:00+08:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = (d: Date) =>
    new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "+08:00");
  return { start: fmt(start), end: fmt(end) };
}

function buildEventBody(details: BookingEventDetails) {
  const summary = `${details.customerName || "Wedding"} — ${details.eventType || "Wedding"}`;
  const descriptionLines = [
    details.budgetRange ? `Budget: ${details.budgetRange}` : null,
    "Booked via Mandy",
  ].filter(Boolean);

  const timed =
    details.startTime && details.durationMinutes != null && /^([01]?\d|2[0-3]):[0-5]\d$/.test(details.startTime)
      ? timedRange(details.isoDate, details.startTime, details.durationMinutes)
      : null;

  return {
    summary,
    description: descriptionLines.join("\n"),
    location: details.location || undefined,
    start: timed ? { dateTime: timed.start, timeZone: "Asia/Kuala_Lumpur" } : { date: details.isoDate },
    end: timed ? { dateTime: timed.end, timeZone: "Asia/Kuala_Lumpur" } : { date: nextIsoDate(details.isoDate) },
  };
}

// Best-effort by design: calendar sync must never block a booking confirmation.
// Callers catch and log; the lead's own status update always proceeds.
export async function createBookingEvent(
  profile: PhotographerProfile,
  details: BookingEventDetails
): Promise<string> {
  const res = await callCalendarApi(profile, "/events", {
    method: "POST",
    body: JSON.stringify(buildEventBody(details)),
  });
  if (!res.ok) {
    console.error("[google-calendar] create event failed", res.status, await res.text());
    throw new GoogleCalendarEventError("Could not create the Google Calendar event.");
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateBookingEvent(
  profile: PhotographerProfile,
  eventId: string,
  details: BookingEventDetails
): Promise<void> {
  const res = await callCalendarApi(profile, `/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(buildEventBody(details)),
  });
  if (!res.ok) {
    console.error("[google-calendar] update event failed", res.status, await res.text());
    throw new GoogleCalendarEventError("Could not update the Google Calendar event.");
  }
}

export async function deleteBookingEvent(profile: PhotographerProfile, eventId: string): Promise<void> {
  try {
    const res = await callCalendarApi(profile, `/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
    // 404/410 means it's already gone (e.g. deleted directly in Google Calendar) — fine either way.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error("[google-calendar] delete event failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[google-calendar] delete event failed (non-fatal)", err);
  }
}

export type UpcomingCalendarEvent = {
  id: string;
  summary: string;
  isoDate: string;
  location: string | null;
};

// Best-effort by design (same discipline as the rest of this module): the
// Dashboard must never break just because a live Calendar read failed.
// Returns null when the calendar couldn't be checked at all (not connected,
// or the API call errored) so callers can fall back to another data source —
// distinct from a real [] meaning "connected and genuinely has no events".
export async function listUpcomingCalendarEvents(
  profile: PhotographerProfile,
  maxResults = 10
): Promise<UpcomingCalendarEvent[] | null> {
  if (!profile.googleCalendarConnected || !profile.googleRefreshToken) return null;
  try {
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults),
    });
    const res = await callCalendarApi(profile, `/events?${params.toString()}`, { method: "GET" });
    if (!res.ok) {
      console.error("[google-calendar] list events failed", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as {
      items?: { id: string; summary?: string; location?: string; start?: { date?: string; dateTime?: string } }[];
    };
    return (data.items ?? [])
      .map((ev) => ({
        id: ev.id,
        summary: ev.summary || "(untitled event)",
        isoDate: (ev.start?.date || ev.start?.dateTime || "").slice(0, 10),
        location: ev.location || null,
      }))
      .filter((ev) => ev.isoDate);
  } catch (err) {
    console.error("[google-calendar] list events failed (non-fatal)", err);
    return null;
  }
}
