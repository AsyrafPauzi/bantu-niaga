export interface TemplateFillContext {
  businessName: string;
  userName: string;
  todayIso?: string;
}

function malaysiaTodayDisplay(iso?: string): string {
  const date = iso ? new Date(`${iso}T12:00:00`) : new Date();
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

/** Replace common bracket placeholders when copying system templates. */
export function fillTemplatePlaceholders(
  body: string,
  ctx: TemplateFillContext,
): string {
  const today = malaysiaTodayDisplay(ctx.todayIso);
  const replacements: Record<string, string> = {
    "[DATE]": today,
    "[BUSINESS NAME]": ctx.businessName,
    "[YOUR NAME]": ctx.userName,
  };

  let out = body;
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value);
  }
  return out;
}
