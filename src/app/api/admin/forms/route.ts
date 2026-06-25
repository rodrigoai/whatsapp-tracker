import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { asTrimmedString, parseFormTrackingInput } from "@/lib/validation";

export async function GET(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const accountId = asTrimmedString(new URL(req.url).searchParams.get("accountId"), 128);
  if (!accountId) return new NextResponse("ID da conta ausente", { status: 400 });

  const [forms, config] = await Promise.all([
    prisma.formTracking.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.buttonConfig.findUnique({
      where: { accountId },
      select: { allowedOrigins: true },
    }),
  ]);

  return NextResponse.json({ forms, allowedOrigins: config?.allowedOrigins ?? "*" });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = parseFormTrackingInput(body);
  if (!parsed.ok || !parsed.data.accountId) {
    return NextResponse.json({ error: parsed.ok ? "ID da conta ausente" : parsed.error }, { status: 400 });
  }

  const form = await prisma.formTracking.create({
    data: {
      accountId: parsed.data.accountId,
      name: parsed.data.name,
      selector: parsed.data.selector,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json(form);
}

export async function PUT(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const id = asTrimmedString(new URL(req.url).searchParams.get("id"), 128);
  if (!id) return new NextResponse("ID ausente", { status: 400 });

  const parsed = parseFormTrackingInput(await req.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const form = await prisma.formTracking.update({
    where: { id },
    data: {
      name: parsed.data.name,
      selector: parsed.data.selector,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json(form);
}

export async function DELETE(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const id = asTrimmedString(new URL(req.url).searchParams.get("id"), 128);
  if (!id) return new NextResponse("ID ausente", { status: 400 });

  await prisma.formTracking.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
