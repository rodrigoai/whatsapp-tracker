import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { asTrimmedString, normalizePhone } from "@/lib/validation";

export async function GET(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;
  
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("Missing accountId", { status: 400 });

  const attendants = await prisma.attendant.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(attendants);
}

export async function POST(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;
  
  const body = await req.json();
  const accountId = asTrimmedString(body?.accountId, 128);
  const name = asTrimmedString(body?.name, 120);
  const phone = normalizePhone(body?.phone);
  if (!accountId || !name || !phone) {
    return NextResponse.json({ error: "Missing or invalid attendant fields" }, { status: 400 });
  }

  const attendant = await prisma.attendant.create({
    data: { accountId, name, phone, isActive: true }
  });
  return NextResponse.json(attendant);
}

export async function PUT(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;
  
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });
  
  const { isActive } = await req.json();
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "Invalid isActive value" }, { status: 400 });
  }

  const attendant = await prisma.attendant.update({
    where: { id },
    data: { isActive }
  });
  return NextResponse.json(attendant);
}

export async function DELETE(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;
  
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });
  
  await prisma.attendant.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
