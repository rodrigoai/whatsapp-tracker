import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const status = formData.get("status") as string
    const accountId = formData.get("accountId") as string

    if (!file || !status || !accountId) {
      return NextResponse.json(
        { error: "Missing required fields (file, status, accountId)" },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet) as any[]

    let updatedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const row of data) {
      const email = row["e-mail"] || row["Email"] || row["email"] || row["E-mail"]
      const fone = row["Fone"] || row["phone"] || row["Phone"] || row["Telefone"]
      const celular = row["Celular"] || row["mobile"] || row["Mobile"]

      // Price and quantity for value calculation
      // Some files might have 'Valor unitário' and 'Quantidade'
      const unitValue = parseFloat(String(row["Valor unitário"] || row["Price"] || 0).replace(",", "."))
      const quantity = parseFloat(String(row["Quantidade"] || row["Quantity"] || 1).replace(",", "."))
      const rowValue = unitValue * quantity

      if (!email && !fone && !celular) {
        skippedCount++
        continue
      }

      // Try to find a match
      let customer = null

      // Matching strategy:
      // 1. Email (exact)
      // 2. Fone (normalized digits)
      // 3. Celular (normalized digits)

      const searchTerms = []
      // Note: SQLite doesn't support mode: "insensitive" in Prisma. 
      // We'll use exact matching for email.
      if (email) searchTerms.push({ email: String(email).trim() })

      const cleanPhone = (p: any) => String(p).replace(/\D/g, "")

      if (fone) {
        const cleaned = cleanPhone(fone)
        if (cleaned) searchTerms.push({ phone: { contains: cleaned } })
      }
      if (celular) {
        const cleaned = cleanPhone(celular)
        if (cleaned) searchTerms.push({ phone: { contains: cleaned } })
      }

      if (searchTerms.length > 0) {
        // Find the newest customer matching any of the criteria for this account
        const matches = await prisma.customer.findMany({
          where: {
            accountId,
            OR: searchTerms as any
          },
          orderBy: {
            conversionTime: "desc"
          },
          take: 1
        })

        customer = matches[0]
      }

      if (customer) {
        // Update customer
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            status,
            value: {
              increment: rowValue > 0 ? rowValue : 0
            }
          }
        })
        updatedCount++
      } else {
        skippedCount++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: data.length,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error("Import Error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
