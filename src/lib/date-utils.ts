const DAY_IN_MS = 24 * 60 * 60 * 1000

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
    date: new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00`),
    dayNumber: utcDate.getTime(),
  }
}

export { DAY_IN_MS }
