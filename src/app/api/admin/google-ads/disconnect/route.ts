import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin"

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const body = (await request.json()) as { accountId?: string }
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : null
  if (!accountId) return NextResponse.json({ error: "ID da conta ausente" }, { status: 400 })

  const config = await prisma.buttonConfig.update({
    where: { accountId },
    data: { googleAdsRefreshToken: null, googleAdsCustomerId: null },
  })

  const { googleAdsRefreshToken: _token, ...rest } = config
  return NextResponse.json({ ...rest, hasGoogleAdsRefreshToken: false })
}
