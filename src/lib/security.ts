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

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string | null | undefined
) {
  const allowed = parseAllowedOrigins(allowedOrigins);
  if (allowed.includes("*")) return true;
  if (!origin) return false;
  return allowed.includes(origin);
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
      : origin ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
