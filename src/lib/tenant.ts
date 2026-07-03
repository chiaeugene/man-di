import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PhotographerProfile } from "@prisma/client";

// Resolves the authenticated tenant. Every API handler and server page goes
// through this — all queries must be scoped by the returned profile.id.
export async function requireProfile(): Promise<PhotographerProfile> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new UnauthorizedError();

  const profile = await prisma.photographerProfile.findUnique({ where: { userId } });
  if (!profile) throw new UnauthorizedError();
  return profile;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
