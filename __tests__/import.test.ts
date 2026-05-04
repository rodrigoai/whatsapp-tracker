import { POST } from "../src/app/api/admin/import-results/route"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: jest.fn(),
      update: jest.fn()
    }
  }
}))

// Mock XLSX
jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn()
  }
}))

// Mock NextResponse
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((data) => ({
      json: async () => data,
      status: 200
    }))
  }
}))

describe("Import Results API", () => {
  const mockAccountId = "acc_123"
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockRequest = (data: any[]) => {
    (XLSX.read as jest.Mock).mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} }
    });
    (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(data);
    
    // Mock the Request object
    return {
      formData: async () => ({
        get: (key: string) => {
          if (key === "file") return { arrayBuffer: async () => new ArrayBuffer(0) };
          if (key === "status") return "Venda";
          if (key === "accountId") return mockAccountId;
          return null;
        }
      })
    } as any;
  }

  it("should match by email (exact)", async () => {
    const csvData = [{ "E-mail": "test@example.com", "Valor unitário": "100", "Quantidade": "1" }]
    const request = createMockRequest(csvData)

    const mockCustomer = { id: "cust_1", email: "test@example.com", phone: "123" }
    ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomer])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(1)
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ email: "test@example.com" })
        ])
      })
    }))
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: "cust_1" },
      data: expect.objectContaining({ status: "Venda", value: { increment: 100 } })
    })
  })

  it("should match by phone using 'Telefone' column", async () => {
    const csvData = [{ "Telefone": "(11) 99999-9999", "Valor unitário": "50" }]
    const request = createMockRequest(csvData)

    const mockCustomer = { id: "cust_2", email: "other@example.com", phone: "11999999999" }
    ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomer])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(1)
    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ phone: { contains: "11999999999" } })
        ])
      })
    }))
  })

  it("should pick the newest lead if multiple match", async () => {
    const csvData = [{ "e-mail": "match@example.com" }]
    const request = createMockRequest(csvData)

    const mockCustomers = [{ id: "newest_id", conversionTime: new Date() }]
    ;(prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers)

    await POST(request)

    expect(prisma.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "newest_id" }
    }))
  })

  it("should accumulate values if multiple rows match same lead", async () => {
    const csvData = [
      { "e-mail": "same@example.com", "Valor unitário": "100" },
      { "e-mail": "same@example.com", "Valor unitário": "200" }
    ]
    const request = createMockRequest(csvData)

    const mockCustomer = { id: "cust_3" }
    ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomer])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(2)
    expect(prisma.customer.update).toHaveBeenCalledTimes(2)
    expect(prisma.customer.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ value: { increment: 100 } })
    }))
    expect(prisma.customer.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ value: { increment: 200 } })
    }))
  })

  it("should handle missing columns and invalid numbers gracefully", async () => {
    const csvData = [
      { "Something": "Else" },
      { "e-mail": "invalid", "Fone": "abc" }
    ]
    const request = createMockRequest(csvData)

    ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([])

    const response = await POST(request)
    const json = await response.json()

    expect(json.summary.updated).toBe(0)
    expect(json.summary.skipped).toBe(2)
  })
})
