import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/admin", () => ({
  requireAdminSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    formTracking: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    buttonConfig: {
      findUnique: jest.fn(),
    },
  },
}));

const { requireAdminSession } = require("@/lib/admin") as typeof import("@/lib/admin");
const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
const { DELETE, GET, POST, PUT } = require("@/app/api/admin/forms/route") as typeof import("@/app/api/admin/forms/route");

describe("admin forms route", () => {
  const mockRequireAdminSession = requireAdminSession as jest.MockedFunction<typeof requireAdminSession>;
  const mockFindMany = prisma.formTracking.findMany as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;
  const mockCreate = prisma.formTracking.create as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;
  const mockUpdate = prisma.formTracking.update as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;
  const mockDelete = prisma.formTracking.delete as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;
  const mockFindConfig = prisma.buttonConfig.findUnique as unknown as jest.MockedFunction<(args: unknown) => Promise<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue(null);
  });

  it("lists forms and the shared allowed origins for an account", async () => {
    mockFindMany.mockResolvedValue([{ id: "form_1", name: "Main", selector: "#form-one", isActive: true }]);
    mockFindConfig.mockResolvedValue({ allowedOrigins: "https://example.com" });

    const response = await GET(new Request("https://tracker.test/api/admin/forms?accountId=acc_1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      forms: [{ id: "form_1", name: "Main", selector: "#form-one", isActive: true }],
      allowedOrigins: "https://example.com",
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { accountId: "acc_1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("creates, updates, and deletes form trackings", async () => {
    mockCreate.mockResolvedValue({ id: "form_1", name: "Main", selector: "#form-one", isActive: true });
    mockUpdate.mockResolvedValue({ id: "form_1", name: "Updated", selector: "form[data-lead]", isActive: false });
    mockDelete.mockResolvedValue({});

    const created = await POST(new Request("https://tracker.test/api/admin/forms", {
      method: "POST",
      body: JSON.stringify({ accountId: "acc_1", name: "Main", selector: "#form-one", isActive: true }),
    }));
    const updated = await PUT(new Request("https://tracker.test/api/admin/forms?id=form_1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated", selector: "form[data-lead]", isActive: false }),
    }));
    const deleted = await DELETE(new Request("https://tracker.test/api/admin/forms?id=form_1", {
      method: "DELETE",
    }));

    expect(created.status).toBe(200);
    expect(updated.status).toBe(200);
    expect(deleted.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { accountId: "acc_1", name: "Main", selector: "#form-one", isActive: true },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "form_1" },
      data: { name: "Updated", selector: "form[data-lead]", isActive: false },
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "form_1" } });
  });

  it("rejects invalid form tracking input", async () => {
    const response = await POST(new Request("https://tracker.test/api/admin/forms", {
      method: "POST",
      body: JSON.stringify({ accountId: "acc_1", name: "", selector: "" }),
    }));

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
