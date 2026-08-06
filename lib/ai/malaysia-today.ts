import "server-only";

/** Current calendar date in Malaysia (Asia/Kuala_Lumpur) as `yyyy-mm-dd`. */
export function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}
