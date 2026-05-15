import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { parseButtonConfigInput } from "@/lib/validation";

export async function GET(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("ID da conta ausente", { status: 400 });

  const config = await prisma.buttonConfig.findUnique({ where: { accountId } });
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("ID da conta ausente", { status: 400 });
  
  const body = await req.json();
  const parsed = parseButtonConfigInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const config = await prisma.buttonConfig.update({
    where: { accountId },
    data: parsed.data
  });
  
  return NextResponse.json(config);
}
