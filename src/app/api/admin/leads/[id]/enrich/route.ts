import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin"
import { enrichLeadFromGclid } from "@/lib/google-ads"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  const lead = await prisma.customer.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 })

  const canRetry =
    lead.enrichment_status === "FAILED" ||
    (lead.enrichment_status === null && Boolean(lead.gclid))

  if (!canRetry) {
    return NextResponse.json(
      { error: "Enriquecimento não disponível para este lead" },
      { status: 409 }
    )
  }

  if (!lead.gclid) {
    return NextResponse.json({ error: "Lead não possui GCLID" }, { status: 409 })
  }

  await enrichLeadFromGclid(lead.id, lead.gclid, lead.accountId)

  const updated = await prisma.customer.findUnique({ where: { id } })
  return NextResponse.json(updated)
}
