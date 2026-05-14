import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

export async function GET(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;
  
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) return new NextResponse("Missing accountId", { status: 400 });

  const leads = await prisma.customer.findMany({
    where: { accountId },
    orderBy: { conversionTime: "desc" }
  });
  return NextResponse.json(leads);
}
