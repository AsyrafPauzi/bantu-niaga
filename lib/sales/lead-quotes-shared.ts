export type LeadQuoteRow = {
  id: string;
  number: string;
  share_hash: string;
  customer_name: string;
  total_myr: number;
  status: string;
  created_at: string;
};

export function publicQuoteUrl(idcompany: string, shareHash: string): string {
  return `/${idcompany}/inv-${shareHash}`;
}
