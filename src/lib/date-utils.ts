const DAY_IN_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + "T00:00:00Z")
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

export function parseDateOnly(
  value: string,
  endOfDay = false
): { date: Date; dayNumber: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    utcDate.getUTCFullYear() !== Number(year) ||
    utcDate.getUTCMonth() !== Number(month) - 1 ||
    utcDate.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return {
    date: new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`),
    dayNumber: utcDate.getTime(),
  }
}

/** Inclusive UTC range [start-of-day, end-of-day] */
export function parseDateRangeUTC(from: string, to: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(from + "T00:00:00.000Z"),
    lte: new Date(to + "T23:59:59.999Z"),
  }
}

/** Exclusive UTC range [start-of-day, start-of-next-day) */
export function parseDayRangeUTC(date: string): { gte: Date; lt: Date } {
  const gte = new Date(date + "T00:00:00.000Z")
  const lt = new Date(gte)
  lt.setUTCDate(lt.getUTCDate() + 1)
  return { gte, lt }
}

export { DAY_IN_MS }
