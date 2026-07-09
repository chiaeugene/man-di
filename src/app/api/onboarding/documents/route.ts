import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import {
  ONBOARDING_DOC_MAX_BYTES,
  ONBOARDING_DOC_ALLOWED_MIME,
  extractTextFromUrl,
  truncateExtractedText,
  serializeOnboardingDocument,
  UrlFetchError,
  PdfTooComplexError,
} from "@/lib/onboarding/documents";
import { extractTextFromPdfIsolated, PdfWorkerError } from "@/lib/onboarding/pdf-isolated";

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const docs = await prisma.onboardingDocument.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "asc" },
    });
    return { documents: docs.map(serializeOnboardingDocument) };
  });
}

const JsonBodySchema = z.union([
  z.object({ url: z.string().min(1).max(2000) }),
  z.object({ text: z.string().min(1).max(50_000), fileName: z.string().max(200).optional() }),
]);

// Accepts multipart/form-data (PDF/text file upload), or a JSON body of
// either { url } (live page fetch) or { text } (pasted text, e.g. copied
// from a website or price list).
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = JsonBodySchema.safeParse(await req.json());
      if (!body.success) throw new ApiError(400, "A URL or some text is required.");

      if ("url" in body.data) {
        let result;
        try {
          result = await extractTextFromUrl(body.data.url);
        } catch (err) {
          if (err instanceof UrlFetchError) throw new ApiError(400, err.message);
          throw err;
        }
        if (!result.text) throw new ApiError(400, "Could not find any readable text on that page.");

        const doc = await prisma.onboardingDocument.create({
          data: {
            profileId: profile.id,
            fileName: result.finalUrl,
            sourceType: "URL",
            sourceUrl: result.finalUrl,
            mimeType: "text/html",
            extractedText: truncateExtractedText(result.text),
            sizeBytes: Buffer.byteLength(result.text, "utf-8"),
          },
        });
        return { document: serializeOnboardingDocument(doc) };
      }

      const text = body.data.text.trim();
      const doc = await prisma.onboardingDocument.create({
        data: {
          profileId: profile.id,
          fileName: body.data.fileName?.trim() || "Pasted text",
          sourceType: "FILE",
          mimeType: "text/plain",
          extractedText: truncateExtractedText(text),
          sizeBytes: Buffer.byteLength(text, "utf-8"),
        },
      });
      return { document: serializeOnboardingDocument(doc) };
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided.");
    if (!ONBOARDING_DOC_ALLOWED_MIME.has(file.type)) {
      throw new ApiError(400, "Only PDF or plain text files are allowed.");
    }
    if (file.size > ONBOARDING_DOC_MAX_BYTES) throw new ApiError(400, "File is too large (max 8MB).");

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText: string;
    try {
      extractedText =
        file.type === "application/pdf" ? await extractTextFromPdfIsolated(buffer) : buffer.toString("utf-8");
    } catch (err) {
      if (err instanceof PdfTooComplexError || err instanceof PdfWorkerError) throw new ApiError(400, err.message);
      throw err;
    }
    if (!extractedText.trim()) throw new ApiError(400, "Could not find any readable text in that file.");

    const doc = await prisma.onboardingDocument.create({
      data: {
        profileId: profile.id,
        fileName: file.name || "document",
        sourceType: "FILE",
        mimeType: file.type,
        data: buffer,
        extractedText: truncateExtractedText(extractedText),
        sizeBytes: file.size,
      },
    });
    return { document: serializeOnboardingDocument(doc) };
  });
}
