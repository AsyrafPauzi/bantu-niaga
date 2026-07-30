import "server-only";

export function isFinanceEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.MARKETING_FROM_EMAIL?.trim(),
  );
}

export function financeEmailConfigHint(): string {
  if (isFinanceEmailConfigured()) return "";
  return "Platform email is not configured. Use WhatsApp or copy a mailto link until RESEND_API_KEY and MARKETING_FROM_EMAIL are set.";
}
