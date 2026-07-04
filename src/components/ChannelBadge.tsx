"use client";

import { CHANNEL_ICONS, CHANNEL_LABEL_KEYS } from "@/lib/channels";
import type { LeadSource } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// Clear, unmissable indicator of which channel a conversation is on.
// Right now only PLAYGROUND is ever real (WhatsApp/IG/Messenger aren't
// connected yet) — this exists so that's never ambiguous, and so the same
// badge just works once those channels go live.
export function ChannelBadge({ source, className = "" }: { source: string; className?: string }) {
  const { t } = useI18n();
  const key = (source in CHANNEL_ICONS ? source : "PLAYGROUND") as LeadSource;
  const Icon = CHANNEL_ICONS[key];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 ${className}`}
    >
      <Icon size={12} />
      {t(CHANNEL_LABEL_KEYS[key])}
    </span>
  );
}
