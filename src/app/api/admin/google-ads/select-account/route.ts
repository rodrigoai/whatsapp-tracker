import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin"

type SelectPayload = {
  configAccountId: string
  encryptedRefreshToken: string
  accounts: { id: string; name: string }[]
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const cookieHeader = request.headers.get("cookie") ?? ""
  const cookieMatch = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("gads_select="))
  const cookieValue = cookieMatch?.split("=").slice(1).join("=")

  if (!cookieValue) {
    return NextResponse.json({ error: "Sessão de seleção de conta ausente ou expirada" }, { status: 400 })
  }

  let payload: SelectPayload
  try {
    payload = JSON.parse(Buffer.from(cookieValue, "base64").toString("utf8")) as SelectPayload
    if (!payload.configAccountId || !payload.encryptedRefreshToken) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Falha ao decodificar sessão de seleção" }, { status: 400 })
  }

  const body = (await request.json()) as { accountId?: string; adsCustomerId?: string }
  if (!body.adsCustomerId) {
    return NextResponse.json({ error: "adsCustomerId obrigatório" }, { status: 400 })
  }
  if (body.accountId && body.accountId !== payload.configAccountId) {
    return NextResponse.json({ error: "Conta incompatível" }, { status: 400 })
  }

  await prisma.buttonConfig.update({
    where: { accountId: payload.configAccountId },
    data: {
      googleAdsCustomerId: body.adsCustomerId,
      googleAdsRefreshToken: payload.encryptedRefreshToken,
    },
  })

  const clearCookie = "gads_select=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/"
  return NextResponse.json(
    { ok: true, configAccountId: payload.configAccountId },
    { headers: { "Set-Cookie": clearCookie } }
  )
}
