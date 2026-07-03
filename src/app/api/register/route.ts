import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ApiError } from "@/lib/api";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = RegisterSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Please provide a name, valid email, and password (min 8 characters).");

    const email = body.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "An account with this email already exists.");

    const passwordHash = await bcrypt.hash(body.data.password, 10);
    await prisma.user.create({
      data: {
        email,
        name: body.data.name.trim(),
        passwordHash,
        profile: { create: {} }, // tenant row; brains filled by onboarding
      },
    });

    return { ok: true };
  });
}
