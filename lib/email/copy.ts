import type { EmailLocale } from "@/lib/email/types";

export type AuthEmailCopy = {
  subject: string;
  heading: string;
  bodyText: string;
  ctaLabel: string;
  footerText: string;
};

type CopyVars = {
  businessName?: string;
  inviterName?: string;
};

const FOOTER_EN =
  "You received this because of an account action on NiagaX. Links expire in about 1 hour. Bantu Niaga Sdn. Bhd.";
const FOOTER_MS =
  "Anda menerima e-mel ini kerana tindakan akaun di NiagaX. Pautan tamat dalam kira-kira 1 jam. Bantu Niaga Sdn. Bhd.";

const GENERIC_EN: AuthEmailCopy = {
  subject: "Continue in NiagaX",
  heading: "Continue in NiagaX",
  bodyText: "Open NiagaX to continue.",
  ctaLabel: "Continue in NiagaX",
  footerText: FOOTER_EN,
};

type ActionKey =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "reauthentication";

const COPY: Record<ActionKey, Record<EmailLocale, Omit<AuthEmailCopy, "footerText">>> = {
  signup: {
    en: {
      subject: "Confirm your NiagaX email",
      heading: "Confirm your email",
      bodyText: "Confirm your email to finish setting up NiagaX.",
      ctaLabel: "Confirm email",
    },
    ms: {
      subject: "Sahkan e-mel NiagaX anda",
      heading: "Sahkan e-mel anda",
      bodyText: "Sahkan e-mel anda untuk selesai sediakan NiagaX.",
      ctaLabel: "Sahkan e-mel",
    },
  },
  recovery: {
    en: {
      subject: "Reset your NiagaX password",
      heading: "Set a new password",
      bodyText:
        "We got a request to reset your password. If this wasn’t you, ignore this email.",
      ctaLabel: "Set new password",
    },
    ms: {
      subject: "Tetapkan semula kata laluan NiagaX",
      heading: "Tetapkan kata laluan baharu",
      bodyText:
        "Kami menerima permintaan tetapkan semula kata laluan. Jika ini bukan anda, abaikan e-mel ini.",
      ctaLabel: "Tetapkan kata laluan",
    },
  },
  invite: {
    en: {
      subject: "You’re invited to {business} on NiagaX",
      heading: "Join the team",
      bodyText: "{inviter} invited you to {business} on NiagaX.",
      ctaLabel: "Join team",
    },
    ms: {
      subject: "Anda dijemput ke {business} di NiagaX",
      heading: "Sertai pasukan",
      bodyText: "{inviter} menjemput anda ke {business} di NiagaX.",
      ctaLabel: "Sertai pasukan",
    },
  },
  magiclink: {
    en: {
      subject: "Your NiagaX sign-in link",
      heading: "Sign in to NiagaX",
      bodyText: "Use this link to sign in. It works once.",
      ctaLabel: "Sign in",
    },
    ms: {
      subject: "Pautan log masuk NiagaX anda",
      heading: "Log masuk ke NiagaX",
      bodyText: "Gunakan pautan ini untuk log masuk. Ia sah sekali sahaja.",
      ctaLabel: "Log masuk",
    },
  },
  email_change: {
    en: {
      subject: "Confirm your new NiagaX email",
      heading: "Confirm your new email",
      bodyText: "Confirm this address to finish changing your email.",
      ctaLabel: "Confirm email",
    },
    ms: {
      subject: "Sahkan e-mel NiagaX baharu anda",
      heading: "Sahkan e-mel baharu",
      bodyText: "Sahkan alamat ini untuk selesai tukar e-mel.",
      ctaLabel: "Sahkan e-mel",
    },
  },
  reauthentication: {
    en: {
      subject: "Confirm it’s you",
      heading: "Confirm it’s you",
      bodyText: "Confirm this action on your NiagaX account.",
      ctaLabel: "Confirm",
    },
    ms: {
      subject: "Sahkan ini anda",
      heading: "Sahkan ini anda",
      bodyText: "Sahkan tindakan ini pada akaun NiagaX anda.",
      ctaLabel: "Sahkan",
    },
  },
};

function isActionKey(action: string): action is ActionKey {
  return action in COPY;
}

function applyVars(
  text: string,
  locale: EmailLocale,
  vars: CopyVars,
): string {
  const business =
    vars.businessName?.trim() ||
    (locale === "ms" ? "ruang kerja" : "a workspace");
  const inviter =
    vars.inviterName?.trim() ||
    (locale === "ms" ? "Rakan sepasukan" : "A teammate");
  return text.replaceAll("{business}", business).replaceAll("{inviter}", inviter);
}

export function authEmailCopy(
  action: string,
  locale: EmailLocale,
  vars: CopyVars,
): AuthEmailCopy {
  if (!isActionKey(action)) {
    return GENERIC_EN;
  }
  const row = COPY[action][locale];
  const footerText = locale === "ms" ? FOOTER_MS : FOOTER_EN;
  return {
    subject: applyVars(row.subject, locale, vars),
    heading: applyVars(row.heading, locale, vars),
    bodyText: applyVars(row.bodyText, locale, vars),
    ctaLabel: row.ctaLabel,
    footerText,
  };
}

export function digestEmailChrome(locale: EmailLocale): {
  ctaLabel: string;
  footerText: string;
} {
  if (locale === "ms") {
    return {
      ctaLabel: "Buka Boardroom",
      footerText:
        "Ringkasan Boardroom mingguan daripada NiagaX. Bantu Niaga Sdn. Bhd.",
    };
  }
  return {
    ctaLabel: "Open Boardroom",
    footerText: "Weekly Boardroom digest from NiagaX. Bantu Niaga Sdn. Bhd.",
  };
}
