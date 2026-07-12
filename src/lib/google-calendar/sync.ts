import type { Lead, PhotographerProfile } from "@prisma/client";
import {
  createBookingEvent,
  deleteBookingEvent,
  parseEventDateToIso,
  updateBookingEvent,
  type BookingEventDetails,
} from "./events";

export function bookingDetailsFor(
  profile: PhotographerProfile,
  lead: Lead,
  data: Record<string, unknown>
): BookingEventDetails | null {
  const isoDate = parseEventDateToIso((data.eventDate as string | null | undefined) ?? lead.eventDate);
  if (!isoDate) return null;
  return {
    isoDate,
    startTime: (data.eventTime as string | null | undefined) ?? lead.eventTime,
    durationMinutes: profile.sessionDurationMinutes ?? null,
    customerName: (data.customerName as string | null | undefined) ?? lead.customerName,
    eventType: (data.eventType as string | null | undefined) ?? lead.eventType,
    location: (data.location as string | null | undefined) ?? lead.location,
    budgetRange: (data.budgetRange as string | null | undefined) ?? lead.budgetRange,
  };
}

// Called before the actual `prisma.lead.update` wherever a lead edit can
// affect the calendar. Mutates `data` in place to add
// calendarStatus/googleEventId when relevant. Best-effort by design:
// calendar sync must never block the lead's own update. Failures are logged
// and the booking still proceeds.
export async function syncGoogleCalendarOnLeadUpdate(
  profile: PhotographerProfile,
  lead: Lead,
  data: Record<string, unknown>
): Promise<void> {
  const willBeBooked = (data.status ?? lead.status) === "Booked";
  const willBeLost = data.status === "Lost";

  try {
    if (willBeBooked && !lead.googleEventId) {
      // Booked with no event yet — either freshly booked, or booked earlier
      // without a usable date (e.g. payment proof arrived before the date
      // was discussed) and the date is only landing now. Create the event
      // if the calendar is connected and a real date is available.
      if (!profile.googleCalendarConnected || !profile.googleRefreshToken) return;
      const details = bookingDetailsFor(profile, lead, data);
      if (!details) return;
      const eventId = await createBookingEvent(profile, details);
      data.googleEventId = eventId;
      data.calendarStatus = "CREATED";
    } else if (lead.calendarStatus === "CREATED" && lead.googleEventId) {
      if (willBeLost) {
        // Booking fell through — remove the stale event from the calendar.
        await deleteBookingEvent(profile, lead.googleEventId);
        data.calendarStatus = "NONE";
        data.googleEventId = null;
      } else if (willBeBooked) {
        // Still booked — keep the event's details in sync with any edits.
        const relevantFieldsChanged = [
          "eventDate",
          "eventTime",
          "location",
          "eventType",
          "customerName",
          "budgetRange",
        ].some((key) => key in data);
        if (relevantFieldsChanged) {
          const details = bookingDetailsFor(profile, lead, data);
          if (details) await updateBookingEvent(profile, lead.googleEventId, details);
        }
      }
    }
  } catch (err) {
    console.error("[google-calendar] sync failed (non-fatal)", err);
  }
}
