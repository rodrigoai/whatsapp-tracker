import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("Missing accountId", { status: 400 });

  const attendants = await prisma.attendant.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(attendants);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  
  const { accountId, name, phone } = await req.json();
  const attendant = await prisma.attendant.create({
    data: { accountId, name, phone, isActive: true }
  });
  return NextResponse.json(attendant);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });
  
  const { isActive } = await req.json();
  const attendant = await prisma.attendant.update({
    where: { id },
    data: { isActive }
  });
  return NextResponse.json(attendant);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });
  
  await prisma.attendant.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
