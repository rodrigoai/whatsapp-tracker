import { beforeEach, describe, expect, it, jest } from "@jest/globals"

type ImportRow = Record<string, unknown>

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
      update: jest.fn()
    }
  }
}))

jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn()
  }
}))

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}))

const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma")
const XLSX = require("xlsx") as typeof import("xlsx")
const { getServerSession } = require("next-auth/next") as typeof import("next-auth/next")
const { POST } = require("../src/app/api/admin/import-results/route") as typeof import("../src/app/api/admin/import-results/route")

describe("Import Results API", () => {
  const mockAccountId = "acc_123"
  const mockGetServerSession = getServerSession as unknown as jest.MockedFunction<() => Promise<unknown>>
  const mockFindMany = prisma.customer.findMany as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown[]>>
  const mockUpdate = prisma.customer.update as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>
  const mockXlsxRead = XLSX.read as jest.MockedFunction<typeof XLSX.read>
  const mockSheetToJson = XLSX.utils.sheet_to_json as unknown as jest.MockedFunction<(sheet: unknown) => ImportRow[]>

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue({ user: { name: "Admin" } })
  })

  const createMockRequest = (data: ImportRow[], overrides: Partial<Record<string, FormDataEntryValue>> = {}) => {
    mockXlsxRead.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} }
    } as ReturnType<typeof XLSX.read>)
    mockSheetToJson.mockReturnValue(data)

    const values: Record<string, FormDataEntryValue> = {
      file: { size: 12, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as FormDataEntryValue,
      status: "Venda",
      accountId: mockAccountId,
      ...overrides,
    }

    const formData = {
      get: (key: string) => values[key] ?? null,
    } as FormData

    return { formData: async () => formData } as unknown as Request
  }

  it("requires an admin session before parsing uploaded data", async () => {
    mockGetServerSession.mockResolvedValue(null)
    const response = await POST(createMockRequest([]))

    expect(response.status).toBe(401)
    expect(XLSX.read).not.toHaveBeenCalled()
  })

  it("rejects unsupported statuses", async () => {
    const response = await POST(createMockRequest([], { status: "Refunded" }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain("Missing required")
  })

  it("should match by email (exact)", async () => {
    const request = createMockRequest([{ "E-mail": "test@example.com", "Valor unitário": "100", "Quantidade": "1" }])
    mockFindMany.mockResolvedValue([{ id: "cust_1", email: "test@example.com", phone: "123" }])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(1)
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ email: "test@example.com" })
        ])
      })
    }))
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "cust_1" },
      data: expect.objectContaining({ status: "Venda", value: { increment: 100 } })
    })
  })

  it("should match by phone using 'Telefone' column", async () => {
    const request = createMockRequest([{ "Telefone": "(11) 99999-9999", "Valor unitário": "50" }])
    mockFindMany.mockResolvedValue([{ id: "cust_2", email: "other@example.com", phone: "11999999999" }])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(1)
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ phone: { contains: "11999999999" } })
        ])
      })
    }))
  })

  it("should pick the newest lead if multiple match", async () => {
    const request = createMockRequest([{ "e-mail": "match@example.com" }])
    mockFindMany.mockResolvedValue([{ id: "newest_id", conversionTime: new Date() }])

    await POST(request)

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "newest_id" }
    }))
  })

  it("should accumulate values if multiple rows match same lead", async () => {
    const request = createMockRequest([
      { "e-mail": "same@example.com", "Valor unitário": "100" },
      { "e-mail": "same@example.com", "Valor unitário": "200" }
    ])
    mockFindMany.mockResolvedValue([{ id: "cust_3" }])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(2)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ value: { increment: 100 } })
    }))
    expect(mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ value: { increment: 200 } })
    }))
  })

  it("should handle missing columns and invalid numbers gracefully", async () => {
    const request = createMockRequest([
      { "Something": "Else" },
      { "e-mail": "invalid", "Fone": "abc" }
    ])
    mockFindMany.mockResolvedValue([])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(0)
    expect(json.summary.skipped).toBe(2)
  })

  it("rejects oversized spreadsheets before reading them", async () => {
    const bigFile = {
      size: 5 * 1024 * 1024 + 1,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as FormDataEntryValue
    const response = await POST(createMockRequest([], { file: bigFile }))

    expect(response.status).toBe(413)
    expect(XLSX.read).not.toHaveBeenCalled()
  })

  it("handles Brazilian decimal and thousands separators", async () => {
    const request = createMockRequest([
      { "e-mail": "money@example.com", "Valor unitário": "1.234,56", "Quantidade": "2" }
    ])
    mockFindMany.mockResolvedValue([{ id: "cust_money" }])

    await POST(request)

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ value: { increment: 2469.12 } })
    }))
  })
})
