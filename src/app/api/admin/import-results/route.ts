import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { requireAdminSession } from "@/lib/admin"
import { parseImportStatus } from "@/lib/validation"
import type { Prisma } from "@prisma/client"

type SheetRow = Record<string, unknown>

function cleanPhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function parseSpreadsheetNumber(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback
  const parsed = Number(String(value).replace(/\./g, "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const status = parseImportStatus(formData.get("status"))
    const accountId = formData.get("accountId") as string

    if (!file || !status || !accountId) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes (arquivo, status, ID da conta)" },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande" }, { status: 413 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: "A planilha não tem abas" }, { status: 400 })
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<SheetRow>(worksheet)

    let updatedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const row of data) {
      const email = row["e-mail"] || row["Email"] || row["email"] || row["E-mail"]
      const fone = row["Fone"] || row["phone"] || row["Phone"] || row["Telefone"]
      const celular = row["Celular"] || row["mobile"] || row["Mobile"]

      // Preço e quantidade para cálculo do valor.
      // Alguns arquivos podem usar 'Valor unitário' e 'Quantidade'.
      const unitValue = parseSpreadsheetNumber(row["Valor unitário"] || row["Price"], 0)
      const quantity = parseSpreadsheetNumber(row["Quantidade"] || row["Quantity"], 1)
      const rowValue = unitValue * quantity

      if (!email && !fone && !celular) {
        skippedCount++
        continue
      }

      // Tenta encontrar uma correspondência.
      let customer = null

      // Estratégia de correspondência:
      // 1. Email exato
      // 2. Fone com dígitos normalizados
      // 3. Celular com dígitos normalizados

      const searchTerms: Prisma.CustomerWhereInput[] = []
      // SQLite não suporta mode: "insensitive" no Prisma.
      // Por isso, usamos correspondência exata para email.
      if (email) searchTerms.push({ email: String(email).trim() })

      if (fone) {
        const cleaned = cleanPhone(fone)
        if (cleaned) searchTerms.push({ phone: { contains: cleaned } })
      }
      if (celular) {
        const cleaned = cleanPhone(celular)
        if (cleaned) searchTerms.push({ phone: { contains: cleaned } })
      }

      if (searchTerms.length > 0) {
        // Busca o cliente mais recente que corresponda a algum critério nesta conta.
        const matches = await prisma.customer.findMany({
          where: {
            accountId,
            OR: searchTerms
          },
          orderBy: {
            conversionTime: "desc"
          },
          take: 1
        })

        customer = matches[0]
      }

      if (customer) {
        // Atualiza o cliente.
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
    console.error("Erro de importação:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
