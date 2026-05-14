import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { asTrimmedString } from "@/lib/validation";

export async function GET() {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const accounts = await prisma.account.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const name = asTrimmedString(body?.name, 120);
  if (!name) return new NextResponse("Invalid account name", { status: 400 });

  const account = await prisma.account.create({
    data: { 
      name,
      buttonConfig: { create: {} } // auto create default config
    }
  });
  return NextResponse.json(account);
}

export async function DELETE(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
