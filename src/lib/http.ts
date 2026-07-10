// Render (and most hosts) put the app behind a reverse proxy, so a raw
// `req.url` inside a Route Handler resolves to the proxy's internal address
// (e.g. http://localhost:10000) rather than the public domain. Anything that
// builds an absolute URL to send elsewhere — an OAuth redirect_uri, a
// redirect Location header — must use the forwarded headers instead.
export function getPublicOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  // Local dev has no reverse proxy in front of it, so req.url is already correct.
  return new URL(req.url).origin;
}
