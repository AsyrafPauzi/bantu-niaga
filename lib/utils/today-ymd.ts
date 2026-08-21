/**
 * Returns the current calendar date in Malaysia Standard Time (UTC+8)
 * as a `yyyy-mm-dd` string, safe for use in both client and server code.
 *
 * Prefer this over `new Date().toISOString().slice(0, 10)`, which returns
 * the UTC date and will be one day behind local time between midnight
 * and 08:00 MYT.
 */
export function todayMytYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}
