import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, UnauthorizedError } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

// Serves the raw bytes for a customer-sent image. Same discipline as
// src/app/api/attachments/[id]/route.ts — auth-gated, one row's bytes per
// request, never batched.
export async function GET(_req: Request, { params }: Params) {
  try {
    const profile = await requireProfile();
    const { id } = await params;

    const attachment = await prisma.inboundAttachment.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
