import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ADMIN_EMAILS, ALLOWED_DOMAIN } from "./lib/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // confia no host do deploy (Vercel) — exigido pelo NextAuth v5
  pages: { signIn: "/login" },
  providers: [Google],
  callbacks: {
    // Só e-mails do domínio da empresa entram.
    async signIn({ profile }) {
      const email = (profile?.email || "").toLowerCase();
      return email.endsWith("@" + ALLOWED_DOMAIN);
    },
    async session({ session }) {
      const email = (session.user?.email || "").toLowerCase();
      session.user.isAdmin = ADMIN_EMAILS.includes(email);
      return session;
    },
    // Usado pelo middleware: exige sessão.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
