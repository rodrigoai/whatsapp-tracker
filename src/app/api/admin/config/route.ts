import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("Missing accountId", { status: 400 });

  const config = await prisma.buttonConfig.findUnique({ where: { accountId } });
  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("Missing accountId", { status: 400 });
  
  const body = await req.json();
  const config = await prisma.buttonConfig.update({
    where: { accountId },
    data: {
      position: body.position,
      size: body.size,
      primaryColor: body.primaryColor,
      buttonText: body.buttonText,
      gclidExpirationDays: parseInt(body.gclidExpirationDays),
      conversionName: body.conversionName,
    }
  });
  
  return NextResponse.json(config);
}
