import { NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin"

type SelectPayload = {
  configAccountId: string
  encryptedRefreshToken: string
  accounts: { id: string; name: string }[]
}

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const cookieHeader = request.headers.get("cookie") ?? ""
  const cookieMatch = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("gads_select="))
  const cookieValue = cookieMatch?.split("=").slice(1).join("=")

  if (!cookieValue) {
    return NextResponse.json({ error: "Sessão de seleção de conta ausente ou expirada" }, { status: 400 })
  }

  try {
    const payload = JSON.parse(Buffer.from(cookieValue, "base64").toString("utf8")) as SelectPayload
    if (!payload.configAccountId || !payload.encryptedRefreshToken) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }
    return NextResponse.json({
      configAccountId: payload.configAccountId,
      accounts: payload.accounts ?? [],
    })
  } catch {
    return NextResponse.json({ error: "Falha ao decodificar sessão de seleção" }, { status: 400 })
  }
}
