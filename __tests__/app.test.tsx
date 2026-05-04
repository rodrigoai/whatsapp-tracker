import { formatWhatsAppNumber, getNextAttendant } from "../src/lib/utils";
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "../src/app/login/page";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

// Mock Next.js router and NextAuth
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

describe("WhatsApp Tracking System Tests", () => {
  describe("formatWhatsAppNumber", () => {
    it("should prepend 55 to a 11-digit Brazilian number", () => {
      expect(formatWhatsAppNumber("11999999999")).toBe("5511999999999");
    });

    it("should not prepend 55 if already present", () => {
      expect(formatWhatsAppNumber("5511999999999")).toBe("5511999999999");
    });

    it("should clean up non-digit characters", () => {
      expect(formatWhatsAppNumber("+55 (11) 99999-9999")).toBe("5511999999999");
    });
  });

  describe("getNextAttendant (Round-Robin)", () => {
    const attendants = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];

    it("should return the first attendant when count is 0", () => {
      expect(getNextAttendant(attendants, 0)).toEqual(attendants[0]);
    });

    it("should return the second attendant when count is 1", () => {
      expect(getNextAttendant(attendants, 1)).toEqual(attendants[1]);
    });

    it("should wrap around and return the first attendant when count is 3", () => {
      expect(getNextAttendant(attendants, 3)).toEqual(attendants[0]);
    });

    it("should handle empty attendants array gracefully", () => {
      expect(getNextAttendant([], 0)).toBeNull();
    });
  });

  describe("LoginPage UI", () => {
    it("should render the login form and handle submit", async () => {
      const pushMock = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
      (signIn as jest.Mock).mockResolvedValue({ error: null });

      render(<LoginPage />);
      
      const usernameInput = screen.getByPlaceholderText("admin");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitBtn = screen.getByText("Sign In");

      fireEvent.change(usernameInput, { target: { value: "admin" } });
      fireEvent.change(passwordInput, { target: { value: "password" } });
      fireEvent.click(submitBtn);

      expect(signIn).toHaveBeenCalledWith("credentials", {
        username: "admin",
        password: "password",
        redirect: false,
      });
    });
  });
});
