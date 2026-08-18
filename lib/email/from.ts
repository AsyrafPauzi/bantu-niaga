export function formatPlatformFrom(fromEmail: string): string {
  const trimmed = fromEmail.trim();
  if (trimmed.includes("<")) return trimmed;
  return `NiagaX <${trimmed}>`;
}
