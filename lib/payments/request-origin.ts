import "server-only";

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || !configuredOrigin) return false;
  try {
    return new URL(origin).origin === new URL(configuredOrigin).origin;
  } catch {
    return false;
  }
}
