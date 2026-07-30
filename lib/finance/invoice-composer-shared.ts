/** Client-safe helpers shared by invoice composer UI and server loaders. */

export interface OperationsProductPickerRow {
  id: string;
  name: string;
  price_myr: number;
  sku: string | null;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
