import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Single-passcode login for the current one-photographer phase (see
// docs/DEPLOYMENT.md). APP_PASSCODE is a secret env var, not committed.
// Anyone entering the correct passcode logs into the sole owner account,
// auto-provisioning it on first successful entry. When this becomes a
// multi-photographer product, this provider should be replaced with real
// per-account credentials (email/password or OAuth) again.
const OWNER_EMAIL = "owner@mandy.local";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        passcode: { label: "Passcode", type: "password" },
      },
      async authorize(credentials) {
        const passcode = typeof credentials?.passcode === "string" ? credentials.passcode.trim() : "";
        const expected = process.env.APP_PASSCODE;
        if (!expected || !passcode || passcode !== expected) return null;

        let user = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: OWNER_EMAIL,
              name: "Photographer",
              passwordHash: await bcrypt.hash(passcode, 10),
              profile: { create: {} },
            },
          });
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId && session.user) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
});
