export type AppLocale = "en" | "ms";

export function parseAppLocale(value: unknown): AppLocale {
  return value === "ms" ? "ms" : "en";
}
