import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_PERIOD_DAYS = 7;

function parseDateOnly(value: string, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    utcDate.getUTCFullYear() !== Number(year) ||
    utcDate.getUTCMonth() !== Number(month) - 1 ||
    utcDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return {
    date: new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00`),
    dayNumber: utcDate.getTime(),
  };
}

export async function GET(req: Request) {
  const unauthorized = await requireAdminSession();
  if (unauthorized) return unauthorized;
  
  const searchParams = new URL(req.url).searchParams;
  const accountId = searchParams.get("accountId");
  const startValue = searchParams.get("start");
  const endValue = searchParams.get("end");
  if (!accountId) return new NextResponse("ID da conta ausente", { status: 400 });

  let conversionTime: { gte: Date; lte: Date } | undefined;
  if (startValue || endValue) {
    if (!startValue || !endValue) {
      return NextResponse.json({ error: "Informe as datas inicial e final" }, { status: 400 });
    }

    const start = parseDateOnly(startValue);
    const end = parseDateOnly(endValue, true);
    if (!start || !end || end.dayNumber < start.dayNumber) {
      return NextResponse.json({ error: "Período inválido" }, { status: 400 });
    }

    const periodDays = Math.floor((end.dayNumber - start.dayNumber) / DAY_IN_MS) + 1;
    if (periodDays > MAX_PERIOD_DAYS) {
      return NextResponse.json(
        { error: "O período máximo permitido é de 7 dias" },
        { status: 400 }
      );
    }

    conversionTime = { gte: start.date, lte: end.date };
  }

  const leads = await prisma.customer.findMany({
    where: {
      accountId,
      ...(conversionTime ? { conversionTime } : {}),
    },
    orderBy: { conversionTime: "desc" }
  });

  const campaign = leads.filter((lead) => Boolean(lead.gclid)).length;
  return NextResponse.json({
    leads,
    summary: {
      total: leads.length,
      campaign,
      organic: leads.length - campaign,
    },
  });
}
