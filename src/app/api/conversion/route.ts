import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatWhatsAppNumber, getNextAttendant } from "@/lib/utils"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      accountId,
      name,
      email,
      phone,
      gclid,
      utm_source,
      utm_medium,
      utm_campaign,
    } = body

    if (!accountId || !name || !email || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // 1. Verify account and get config & active attendants
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        buttonConfig: true,
        attendants: {
          where: { isActive: true },
          orderBy: { id: "asc" },
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const activeAttendants = account.attendants
    if (activeAttendants.length === 0) {
      return NextResponse.json(
        { error: "No active attendants available" },
        { status: 400 }
      )
    }

    // 2. Round-Robin Algorithm
    const customerCount = await prisma.customer.count({
      where: { accountId },
    })
    
    let nextAttendant = getNextAttendant(activeAttendants, customerCount);

    if (!nextAttendant) {
      return NextResponse.json({ error: "No active attendants" }, { status: 400 });
    }

    // 3. Format Phone
    let finalPhone = formatWhatsAppNumber(nextAttendant.phone);

    // 4. Save Customer (Lead)
    await prisma.customer.create({
      data: {
        accountId,
        name,
        email,
        phone,
        gclid: gclid || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        conversionName: account.buttonConfig?.conversionName || "WhatsApp Conversion",
      },
    })

    // 5. Generate URLs
    // Mobile: https://wa.me/<number>
    // Desktop: https://web.whatsapp.com/send/?phone=<number>
    return NextResponse.json(
      {
        success: true,
        attendantName: nextAttendant.name,
        number: finalPhone,
        mobileUrl: `https://wa.me/${finalPhone}`,
        desktopUrl: `https://web.whatsapp.com/send/?phone=${finalPhone}`,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
