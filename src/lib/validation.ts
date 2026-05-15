export type ButtonPosition = "LEFT" | "RIGHT";
export type ButtonSize = "SMALL" | "LARGE";
export type ImportStatus = "Proposta" | "Venda";
export type FormField = "name" | "email" | "phone";

import { normalizeAllowedOrigin } from "@/lib/security";

export type ConversionInput = {
  accountId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export type ButtonConfigInput = {
  position: ButtonPosition;
  size: ButtonSize;
  primaryColor: string;
  buttonText: string;
  balloonText: string;
  allowedOrigins: string;
  gclidExpirationDays: number;
  conversionName: string;
  gaEventName: string;
  formFields: string;
};

const FORM_FIELDS: FormField[] = ["name", "email", "phone"];
export const DEFAULT_FORM_FIELDS = "name,email,phone";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function asOptionalString(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  return asTrimmedString(value, maxLength);
}

export function normalizePhone(value: unknown) {
  const raw = asTrimmedString(value, 40);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function parseFormFieldsInput(value: unknown) {
  const raw = asTrimmedString(value ?? DEFAULT_FORM_FIELDS, 120);
  if (!raw) return null;

  const fields = raw
    .split(",")
    .map((field) => field.trim())
    .filter((field): field is FormField => FORM_FIELDS.includes(field as FormField));

  const uniqueFields = FORM_FIELDS.filter((field) => fields.includes(field));
  return uniqueFields.length > 0 ? uniqueFields.join(",") : null;
}

export function parseFormFields(value: unknown): FormField[] {
  return (parseFormFieldsInput(value) ?? DEFAULT_FORM_FIELDS).split(",") as FormField[];
}

export function parseConversionInput(value: unknown, requiredFields: FormField[] = FORM_FIELDS):
  | { ok: true; data: ConversionInput }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid JSON body" };

  const accountId = asTrimmedString(value.accountId, 128);
  const requiresName = requiredFields.includes("name");
  const requiresEmail = requiredFields.includes("email");
  const requiresPhone = requiredFields.includes("phone");
  const name = requiresName ? asTrimmedString(value.name, 120) : asOptionalString(value.name, 120);
  const email = requiresEmail ? asTrimmedString(value.email, 254) : asOptionalString(value.email, 254);
  const phone = requiresPhone ? normalizePhone(value.phone) : value.phone ? normalizePhone(value.phone) : null;

  if (!accountId || (requiresName && !name) || (requiresEmail && !email) || (requiresPhone && !phone)) {
    return { ok: false, error: "Missing or invalid required fields" };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email" };
  }

  return {
    ok: true,
    data: {
      accountId,
      name,
      email,
      phone,
      gclid: asOptionalString(value.gclid, 256),
      gbraid: asOptionalString(value.gbraid, 256),
      wbraid: asOptionalString(value.wbraid, 256),
      utm_source: asOptionalString(value.utm_source, 120),
      utm_medium: asOptionalString(value.utm_medium, 120),
      utm_campaign: asOptionalString(value.utm_campaign, 180),
    },
  };
}

export function parseButtonConfigInput(value: unknown):
  | { ok: true; data: ButtonConfigInput }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid JSON body" };

  const position = value.position === "LEFT" ? "LEFT" : value.position === "RIGHT" ? "RIGHT" : null;
  const size = value.size === "SMALL" ? "SMALL" : value.size === "LARGE" ? "LARGE" : null;
  const primaryColor = asTrimmedString(value.primaryColor, 16);
  const buttonText = asTrimmedString(value.buttonText, 80);
  const balloonText = asTrimmedString(value.balloonText, 240);
  const conversionName = asTrimmedString(value.conversionName, 120);
  const gaEventName = asTrimmedString(value.gaEventName, 80);
  const formFields = parseFormFieldsInput(value.formFields);
  const allowedOrigins = parseAllowedOriginsInput(value.allowedOrigins);
  const gclidExpirationDays = Number(value.gclidExpirationDays);

  if (!position || !size || !buttonText || !balloonText || !conversionName || !gaEventName || !formFields || !allowedOrigins) {
    return { ok: false, error: "Missing or invalid configuration fields" };
  }

  if (!primaryColor || !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    return { ok: false, error: "Invalid primary color" };
  }

  if (!Number.isInteger(gclidExpirationDays) || gclidExpirationDays < 1 || gclidExpirationDays > 365) {
    return { ok: false, error: "Invalid GCLID expiration" };
  }

  if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(gaEventName)) {
    return { ok: false, error: "Invalid Google Analytics event name" };
  }

  return {
    ok: true,
    data: {
      position,
      size,
      primaryColor,
      buttonText,
      balloonText,
      allowedOrigins,
      gclidExpirationDays,
      conversionName,
      gaEventName,
      formFields,
    },
  };
}

export function parseAllowedOriginsInput(value: unknown) {
  const raw = asTrimmedString(value ?? "*", 1000);
  if (!raw) return null;
  if (raw === "*") return raw;

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return null;

  for (const origin of origins) {
    const normalizedOrigin = normalizeAllowedOrigin(origin);
    if (!normalizedOrigin) {
      return null;
    }
  }

  return Array.from(new Set(
    origins
      .map((origin) => normalizeAllowedOrigin(origin))
      .filter((origin): origin is string => Boolean(origin))
  )).join(", ");
}

export function parseImportStatus(value: unknown): ImportStatus | null {
  return value === "Proposta" || value === "Venda" ? value : null;
}

export function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}
