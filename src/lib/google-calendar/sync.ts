import type { Lead, PhotographerProfile } from "@prisma/client";
import {
  createBookingEvent,
  deleteBookingEvent,
  parseEventDateToIso,
  updateBookingEvent,
  type BookingEventDetails,
} from "./events";

export function bookingDetailsFor(lead: Lead, data: Record<string, unknown>): BookingEventDetails | null {
  const isoDate = parseEventDateToIso((data.eventDate as string | null | undefined) ?? lead.eventDate);
  if (!isoDate) return null;
  return {
    isoDate,
    customerName: (data.customerName as string | null | undefined) ?? lead.customerName,
    eventType: (data.eventType as string | null | undefined) ?? lead.eventType,
    location: (data.location as string | null | undefined) ?? lead.location,
    budgetRange: (data.budgetRange as string | null | undefined) ?? lead.budgetRange,
  };
}

// Called from the leads PATCH route before the actual `prisma.lead.update`.
// Mutates `data` in place to add calendarStatus/googleEventId when relevant.
// Best-effort by design: calendar sync must never block the lead's own
// status update. Failures are logged and the booking still proceeds.
export async function syncGoogleCalendarOnLeadUpdate(
  profile: PhotographerProfile,
  lead: Lead,
  data: Record<string, unknown>
): Promise<void> {
  const wasBooked = lead.status === "Booked";
  const willBeBooked = (data.status ?? lead.status) === "Booked";
  const willBeLost = data.status === "Lost";

  try {
    if (!wasBooked && willBeBooked) {
      // Newly booked — create the event if the photographer has Calendar
      // connected and we have a real date to put on it.
      if (!profile.googleCalendarConnected || !profile.googleRefreshToken) return;
      const details = bookingDetailsFor(lead, data);
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
      } else if (wasBooked && willBeBooked) {
        // Still booked — keep the event's details in sync with any edits.
        const relevantFieldsChanged = ["eventDate", "location", "eventType", "customerName", "budgetRange"].some(
          (key) => key in data
        );
        if (relevantFieldsChanged) {
          const details = bookingDetailsFor(lead, data);
          if (details) await updateBookingEvent(profile, lead.googleEventId, details);
        }
      }
    }
  } catch (err) {
    console.error("[google-calendar] sync failed (non-fatal)", err);
  }
}
