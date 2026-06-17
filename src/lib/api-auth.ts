import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

export function checkAuth(request: Request): Response | null {
  const secret = process.env.API_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const secretBuf = Buffer.from(secret, "utf8")
  const tokenBuf = Buffer.from(token, "utf8")
  if (secretBuf.length !== tokenBuf.length || !timingSafeEqual(secretBuf, tokenBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
