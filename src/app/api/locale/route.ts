import { z } from "zod";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/config";
import { handle, ApiError } from "@/lib/api";

const BodySchema = z.object({ locale: z.enum(LOCALES) });

export async function POST(req: Request) {
  return handle(async () => {
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid locale.");

    const store = await cookies();
    store.set(LOCALE_COOKIE, body.data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return { ok: true };
  });
}
