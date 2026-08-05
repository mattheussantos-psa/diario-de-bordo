export { auth as middleware } from "./auth";

// Protege a página principal e a API de negócios; deixa livre /login e /api/auth.
export const config = {
  matcher: ["/", "/api/deals/:path*"],
};
