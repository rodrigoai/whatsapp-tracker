import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders, getClientKey, getRequestOrigin, isOriginAllowed } from "@/lib/security";
import { isRateLimited } from "@/lib/rate-limit";
import { asTrimmedString, parseFormConversionInput } from "@/lib/validation";

function jsonWithPublicCors(body: unknown, status: number, request: Request, allowedOrigins = "*") {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(getRequestOrigin(request), allowedOrigins),
  });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16 * 1024) {
      return jsonWithPublicCors({ error: "Request body is too large" }, 413, request);
    }

    const clientKey = getClientKey(request);
    if (isRateLimited(`form-conversion:${clientKey}`, { limit: 60, windowMs: 60_000 })) {
      return jsonWithPublicCors({ error: "Too many requests" }, 429, request);
    }

    const body = await request.json();
    const accountId = asTrimmedString(body?.accountId, 128);
    if (!accountId) {
      return jsonWithPublicCors({ error: "Missing or invalid required fields" }, 400, request);
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        buttonConfig: true,
        formTrackings: {
          where: { isActive: true },
        },
      },
    });

    if (!account) {
      return jsonWithPublicCors({ error: "Account not found" }, 404, request);
    }

    const allowedOrigins = account.buttonConfig?.allowedOrigins ?? "*";
    if (!isOriginAllowed(getRequestOrigin(request), allowedOrigins)) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403, headers: corsHeaders(getRequestOrigin(request), allowedOrigins) }
      );
    }

    const parsed = parseFormConversionInput(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400, headers: corsHeaders(getRequestOrigin(request), allowedOrigins) }
      );
    }

    const formTracking = account.formTrackings.find((form) => form.id === parsed.data.formTrackingId);
    if (!formTracking) {
      return NextResponse.json(
        { error: "Form tracking not found" },
        { status: 404, headers: corsHeaders(getRequestOrigin(request), allowedOrigins) }
      );
    }

    const {
      name,
      email,
      phone,
      gclid,
      gbraid,
      wbraid,
      utm_source,
      utm_medium,
      utm_campaign,
    } = parsed.data;

    const customer = await prisma.customer.create({
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
        conversionName: `Form: ${formTracking.name}`,
      },
    });

    return NextResponse.json(
      { success: true, leadId: customer.id },
      { status: 200, headers: corsHeaders(getRequestOrigin(request), allowedOrigins) }
    );
  } catch (error) {
    console.error("Form Conversion Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders(getRequestOrigin(request), "*") }
    );
  }
}

export async function OPTIONS(request: Request) {
  const accountId = asTrimmedString(new URL(request.url).searchParams.get("accountId"), 128);
  const config = accountId
    ? await prisma.buttonConfig.findUnique({ where: { accountId } })
    : null;
  const allowedOrigins = config?.allowedOrigins ?? "*";

  if (!isOriginAllowed(getRequestOrigin(request), allowedOrigins)) {
    return new NextResponse(null, {
      status: 403,
      headers: corsHeaders(getRequestOrigin(request), allowedOrigins),
    });
  }

  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(getRequestOrigin(request), allowedOrigins),
  });
}
