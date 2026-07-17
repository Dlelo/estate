/** Returns a sortable numeric key for a period string ("YYYY-MM" or "YYYY"). */
export function periodSortKey(period: string): number {
  const monthly = /^(\d{4})-(\d{2})$/.exec(period);
  if (monthly) return Number(monthly[1]) * 100 + Number(monthly[2]);

  const annual = /^(\d{4})$/.exec(period);
  if (annual) return Number(annual[1]) * 100 + 13; // annual bucket sorts after that year's 12 months

  return 0; // unknown format, sorts first
}

export function sortPeriodsAsc(periods: string[]): string[] {
  return [...periods].sort((a, b) => periodSortKey(a) - periodSortKey(b));
}
