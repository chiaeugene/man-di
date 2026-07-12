"use client";

import { useEffect, useRef, useState } from "react";
import { IconHeartFilled, IconSend, IconSparkles, IconFileText, IconPaperclip } from "@/components/Icons";

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileType: string; // PHOTO | PDF
  mimeType: string;
  url: string;
}

export interface ChatMsg {
  role: "mandy" | "me" | "system";
  content: string;
  badge?: string;
  attachments?: ChatAttachment[];
}

function AttachmentBubble({ a }: { a: ChatAttachment }) {
  if (a.fileType === "PHOTO") {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 block max-w-[220px] overflow-hidden rounded-2xl border border-rose-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.fileName} className="block w-full" />
      </a>
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex max-w-[220px] items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-medium text-wine transition-colors duration-150 hover:bg-rose-100"
    >
      <IconFileText size={16} className="shrink-0 text-rose-500" />
      <span className="truncate">{a.fileName}</span>
    </a>
  );
}

function MandyAvatar() {
  return (
    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-petal">
      <IconHeartFilled size={13} />
    </span>
  );
}

export function ChatWindow({
  messages,
  onSend,
  onSendImage,
  disabled,
  placeholder,
  busyLabel = "Mandy is typing",
  busy,
}: {
  messages: ChatMsg[];
  onSend: (text: string) => void | Promise<void>;
  onSendImage?: (file: File) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  busy?: boolean;
  busyLabel?: string;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || disabled || busy) return;
    setInput("");
    await onSend(text);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !onSendImage) return;
    await onSendImage(file);
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-petal-lg">
      <div className="chat-texture flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-rose-50/60 to-white p-6">
        {messages.map((m, i) =>
          m.role === "system" ? (
            <div
              key={i}
              className="mx-auto flex max-w-md items-start gap-2 rounded-2xl border border-amber-200/70 bg-champagne px-4 py-2.5 text-center text-xs leading-relaxed text-amber-900 animate-bloom"
            >
              <IconSparkles size={14} className="mt-0.5 shrink-0 text-gold" />
              <span className="text-left">{m.content}</span>
            </div>
          ) : (
            <div
              key={i}
              className={`flex items-start gap-2.5 animate-bloom ${m.role === "me" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "mandy" && <MandyAvatar />}
              <div
                className={`max-w-[72%] whitespace-pre-wrap rounded-3xl px-4.5 py-3 text-sm leading-relaxed ${
                  m.role === "me"
                    ? "rounded-br-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-petal"
                    : "rounded-tl-lg border border-rose-100/80 bg-white text-wine shadow-petal"
                }`}
              >
                {m.badge && (
                  <div
                    className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      m.role === "me" ? "text-rose-100" : "text-gold"
                    }`}
                  >
                    {m.badge}
                  </div>
                )}
                {m.content}
                {m.attachments?.map((a) => (
                  <AttachmentBubble key={a.id} a={a} />
                ))}
              </div>
            </div>
          )
        )}
        {busy && (
          <div className="flex items-start gap-2.5">
            <MandyAvatar />
            <div className="flex items-center gap-2 rounded-3xl rounded-tl-lg border border-rose-100/80 bg-white px-4 py-3 shadow-petal">
              <span className="flex gap-1" aria-label={busyLabel}>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rose-400 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2.5 border-t border-rose-100 bg-white p-4">
        {onSendImage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              disabled={disabled || busy}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || busy}
              aria-label="Attach a photo"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-rose-200 text-rose-500 transition-colors duration-150 hover:bg-rose-50 disabled:opacity-40"
            >
              <IconPaperclip size={17} />
            </button>
          </>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || busy}
          placeholder={placeholder ?? "Type a message…"}
          aria-label="Message"
          className="flex-1 rounded-full border border-rose-200 bg-rose-50/40 px-5 py-3 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100 disabled:bg-rose-50/60"
        />
        <button
          type="submit"
          disabled={disabled || busy || !input.trim()}
          aria-label="Send message"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-95 disabled:opacity-40"
        >
          <IconSend size={17} />
        </button>
      </form>
    </div>
  );
}
