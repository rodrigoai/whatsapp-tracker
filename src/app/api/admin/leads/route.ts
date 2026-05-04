import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("Missing accountId", { status: 400 });

  const leads = await prisma.customer.findMany({
    where: { accountId },
    orderBy: { conversionTime: "desc" }
  });
  return NextResponse.json(leads);
}
