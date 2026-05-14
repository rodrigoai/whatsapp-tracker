import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatWhatsAppNumber, getNextAttendant } from "@/lib/utils"
import { corsHeaders, getClientKey, getRequestOrigin, isOriginAllowed } from "@/lib/security"
import { isRateLimited } from "@/lib/rate-limit"
import { parseConversionInput } from "@/lib/validation"

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 16 * 1024) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    }

    const clientKey = getClientKey(request)
    if (isRateLimited(`conversion:${clientKey}`, { limit: 30, windowMs: 60_000 })) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const parsed = parseConversionInput(await request.json())

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      )
    }

    const {
      accountId,
      name,
      email,
      phone,
      gclid,
      gbraid,
      wbraid,
      utm_source,
      utm_medium,
      utm_campaign,
    } = parsed.data

    // 1. Verify account and get config & active attendants
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
        include: {
          buttonConfig: true,
          attendants: {
            where: { isActive: true },
            orderBy: { id: "asc" },
          },
        },
      })

      if (!account) return { status: "ACCOUNT_NOT_FOUND" as const }

      const origin = getRequestOrigin(request)
      if (!isOriginAllowed(origin, account.buttonConfig?.allowedOrigins)) {
        return {
          status: "ORIGIN_NOT_ALLOWED" as const,
          allowedOrigins: account.buttonConfig?.allowedOrigins,
        }
      }

      const activeAttendants = account.attendants
      if (activeAttendants.length === 0) {
        return { status: "NO_ATTENDANTS" as const }
      }

      // 2. Round-Robin Algorithm
      const nextAttendant = getNextAttendant(activeAttendants, account.nextAttendantIndex)

      if (!nextAttendant) {
        return { status: "NO_ATTENDANTS" as const }
      }

      const nextAttendantIndex = (account.nextAttendantIndex + 1) % activeAttendants.length
      await tx.account.update({
        where: { id: accountId },
        data: { nextAttendantIndex },
      })

      // 4. Save Customer (Lead)
      await tx.customer.create({
        data: {
          accountId,
          name,
          email,
          phone,
          gclid,
          gbraid,
          wbraid,
          utm_source,
          utm_medium,
          utm_campaign,
          conversionName: account.buttonConfig?.conversionName || "WhatsApp Conversion",
        },
      })

      return {
        status: "OK" as const,
        attendantName: nextAttendant.name,
        allowedOrigins: account.buttonConfig?.allowedOrigins,
        finalPhone: formatWhatsAppNumber(nextAttendant.phone),
      }
    })

    if (result.status === "ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    if (result.status === "ORIGIN_NOT_ALLOWED") {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403, headers: corsHeaders(getRequestOrigin(request), result.allowedOrigins) }
      )
    }

    if (result.status === "NO_ATTENDANTS") {
      return NextResponse.json(
        { error: "No active attendants available" },
        { status: 400 }
      )
    }

    // 5. Generate URLs
    // Mobile: https://wa.me/<number>
    // Desktop: https://web.whatsapp.com/send/?phone=<number>
    return NextResponse.json(
      {
        success: true,
        attendantName: result.attendantName,
        number: result.finalPhone,
        mobileUrl: `https://wa.me/${result.finalPhone}`,
        desktopUrl: `https://web.whatsapp.com/send/?phone=${result.finalPhone}`,
      },
      {
        status: 200,
        headers: corsHeaders(getRequestOrigin(request), result.allowedOrigins),
      }
    )
  } catch (error) {
    console.error("Conversion Error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: Request) {
  const accountId = new URL(request.url).searchParams.get("accountId")
  const config = accountId
    ? await prisma.buttonConfig.findUnique({ where: { accountId } })
    : null
  const allowedOrigins = config?.allowedOrigins ?? "*"

  if (!isOriginAllowed(getRequestOrigin(request), allowedOrigins)) {
    return new NextResponse(null, {
      status: 403,
      headers: corsHeaders(getRequestOrigin(request), allowedOrigins),
    })
  }

  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(getRequestOrigin(request), allowedOrigins),
  })
}
