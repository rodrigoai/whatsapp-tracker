export function getRequestOrigin(request: Request) {
  return request.headers.get("origin");
}

export function getClientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function parseAllowedOrigins(value: string | null | undefined) {
  if (!value || value.trim() === "*") return ["*"];

  const origins = value
    .split(",")
    .map(normalizeAllowedOrigin)
    .filter((origin): origin is string => Boolean(origin));

  return Array.from(new Set(origins));
}

export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string | null | undefined
) {
  const allowed = parseAllowedOrigins(allowedOrigins);
  if (allowed.includes("*")) return true;
  if (!origin) return false;
  const normalizedOrigin = normalizeAllowedOrigin(origin);
  return Boolean(normalizedOrigin && allowed.includes(normalizedOrigin));
}

export function corsHeaders(
  origin: string | null,
  allowedOrigins: string | null | undefined
): Record<string, string> {
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return { Vary: "Origin" };
  }

  return {
    "Access-Control-Allow-Origin": parseAllowedOrigins(allowedOrigins).includes("*")
      ? "*"
      : normalizeAllowedOrigin(origin) ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function normalizeAllowedOrigin(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw === "*") return raw;

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
