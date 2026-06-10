import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock("@/components/Providers", () => ({
  useAccount: () => ({ selectedAccountId: "acc_1" }),
}));

const LeadsPage = require("@/app/admin/leads/page").default as typeof import("@/app/admin/leads/page").default;

describe("Leads page", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        leads: [],
        summary: {
          total: 4,
          campaign: 1,
          organic: 3,
        },
      }),
    });
    Object.defineProperty(window, "fetch", {
      value: fetchMock,
      configurable: true,
    });
  });

  it("requests at most seven days and renders the period summary", async () => {
    render(<LeadsPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]), "https://tracker.test");
    const start = requestUrl.searchParams.get("start");
    const end = requestUrl.searchParams.get("end");

    expect(requestUrl.searchParams.get("accountId")).toBe("acc_1");
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    expect(
      (new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) /
        (24 * 60 * 60 * 1000)
    ).toBe(6);

    expect(await screen.findByText("Total de leads")).toBeInTheDocument();
    expect(screen.getByText("Leads de campanha (GCLID)")).toBeInTheDocument();
    expect(screen.getByText("Leads orgânicos")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    const startInput = screen.getByLabelText("Data inicial");
    const endInput = screen.getByLabelText("Data final");
    expect(startInput).toHaveAttribute("min", start);
    expect(startInput).toHaveAttribute("max", end);
    expect(endInput).toHaveAttribute("min", start);
  });
});
