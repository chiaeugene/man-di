import { PDFParse } from "pdf-parse";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import type { OnboardingDocument } from "@prisma/client";

// Photography price lists/brochures are usually a handful of pages, often
// with embedded photos — those photos are exactly what makes PDF parsing
// memory-hungry (the parser still has to load the full page/image structure
// even though we only want text back out), and the server only has 512MB
// total. A generous byte cap alone isn't enough: a 6MB PDF with a couple of
// full-res photos can still exceed that. Page count is the real risk factor.
export const ONBOARDING_DOC_MAX_BYTES = 3 * 1024 * 1024; // 3MB
export const ONBOARDING_DOC_ALLOWED_MIME = new Set(["application/pdf", "text/plain"]);
const PDF_MAX_PAGES = 15;

export class PdfTooComplexError extends Error {}

const URL_FETCH_TIMEOUT_MS = 10_000;
const URL_FETCH_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const EXTRACTED_TEXT_MAX_CHARS = 20_000;

export class UrlFetchError extends Error {}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    // getInfo() reads only document metadata (no page rendering) — cheap way
    // to reject an overly long/complex PDF before the expensive full parse.
    const info = await parser.getInfo();
    if (info.total > PDF_MAX_PAGES) {
      throw new PdfTooComplexError(
        `That PDF has ${info.total} pages — please keep uploads under ${PDF_MAX_PAGES} pages (a price list or service menu is usually plenty).`
      );
    }
    // Belt-and-braces: even after the page-count check, only ever ask for
    // pages within the cap.
    const result = await parser.getText({ first: PDF_MAX_PAGES });
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

// Blocks loopback/private/link-local targets (including the cloud metadata
// address) before ever making the outbound request — this endpoint takes a
// URL from the photographer, so it must not become an SSRF pivot into the
// hosting network.
async function assertPublicHostname(hostname: string): Promise<void> {
  const literal = isIP(hostname) ? hostname : null;
  const addresses = literal ? [literal] : (await dns.lookup(hostname, { all: true })).map((a) => a.address);

  for (const addr of addresses) {
    if (isPrivateOrLoopback(addr)) {
      throw new UrlFetchError("That URL points to a private or internal address, which isn't allowed.");
    }
  }
}

function isPrivateOrLoopback(addr: string): boolean {
  if (addr === "127.0.0.1" || addr === "::1" || addr === "169.254.169.254") return true;
  if (addr.startsWith("127.") || addr.startsWith("10.") || addr.startsWith("192.168.")) return true;
  if (addr.startsWith("169.254.")) return true;
  const octets = addr.split(".").map(Number);
  if (octets.length === 4 && octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (addr.startsWith("fc") || addr.startsWith("fd") || addr.startsWith("fe80")) return true; // ULA/link-local IPv6
  return false;
}

export async function extractTextFromUrl(rawUrl: string): Promise<{ text: string; finalUrl: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlFetchError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlFetchError("Only http/https URLs are supported.");
  }
  await assertPublicHostname(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mandy-Setup-Assistant/1.0" },
    });
    if (!res.ok) throw new UrlFetchError(`Could not fetch that page (HTTP ${res.status}).`);

    // Re-check the final hostname in case redirects moved off-target.
    await assertPublicHostname(new URL(res.url).hostname);

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > URL_FETCH_MAX_BYTES) {
      throw new UrlFetchError("That page is too large to fetch.");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new UrlFetchError("Could not read that page.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > URL_FETCH_MAX_BYTES) {
        await reader.cancel();
        throw new UrlFetchError("That page is too large to fetch.");
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf-8");
    return { text: htmlToText(html), finalUrl: res.url };
  } catch (err) {
    if (err instanceof UrlFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new UrlFetchError("That page took too long to respond.");
    }
    throw new UrlFetchError("Could not fetch that URL.");
  } finally {
    clearTimeout(timeout);
  }
}

function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, EXTRACTED_TEXT_MAX_CHARS);
}

export function truncateExtractedText(text: string): string {
  return text.slice(0, EXTRACTED_TEXT_MAX_CHARS);
}

// Metadata + a short preview only — never raw bytes or the full extracted text.
export function serializeOnboardingDocument(doc: OnboardingDocument) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    sourceType: doc.sourceType,
    sourceUrl: doc.sourceUrl,
    sizeBytes: doc.sizeBytes,
    preview: doc.extractedText.slice(0, 200),
    createdAt: doc.createdAt,
  };
}
export type SerializedOnboardingDocument = ReturnType<typeof serializeOnboardingDocument>;
