export type EmailLocale = "en" | "ms";

export type NiagaXEmailInput = {
  locale: EmailLocale;
  brandName: string;
  subject: string;
  heading: string;
  bodyText: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerText: string;
  previewText?: string;
};
