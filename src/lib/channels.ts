import type { LeadSource } from "@/lib/constants";
import {
  IconFlask,
  IconChat as IconWhatsApp,
  IconCamera as IconInstagram,
  IconSend as IconMessenger,
} from "@/components/Icons";

// Where a conversation is actually happening — shown as a clear badge
// wherever a conversation appears, so nobody mistakes a website test
// session for a real WhatsApp/Instagram/Messenger chat with a customer.
export const CHANNEL_ICONS: Record<LeadSource, typeof IconFlask> = {
  PLAYGROUND: IconFlask,
  WHATSAPP: IconWhatsApp,
  INSTAGRAM: IconInstagram,
  MESSENGER: IconMessenger,
};

// i18n keys under `channels.*` (see dictionaries) — one per LeadSource.
export const CHANNEL_LABEL_KEYS: Record<LeadSource, string> = {
  PLAYGROUND: "channels.playground",
  WHATSAPP: "channels.whatsapp",
  INSTAGRAM: "channels.instagram",
  MESSENGER: "channels.messenger",
};
