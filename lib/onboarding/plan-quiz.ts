import type { TierKey } from "@/lib/settings/plans";

export type BusinessType =
  | "retail"
  | "fnb"
  | "services"
  | "online"
  | "freelancer"
  | "other";

export type TeamSizeBand = "solo" | "2-5" | "6-15" | "16+";

export type PriorityNeed =
  | "invoices"
  | "pos"
  | "stock"
  | "leave"
  | "marketing";

export interface PlanQuizAnswers {
  businessType: BusinessType;
  teamSize: TeamSizeBand;
  priorities: PriorityNeed[];
}

export interface PlanQuizResult {
  recommendedTier: TierKey;
  headline: string;
  summary: string;
  canStayFree: boolean;
  bundleHint?: string;
}

export function recommendPlanFromQuiz(answers: PlanQuizAnswers): PlanQuizResult {
  const { businessType, teamSize, priorities } = answers;

  if (teamSize === "solo" && businessType === "freelancer") {
    return {
      recommendedTier: "starter",
      headline: "Free is enough to start",
      summary:
        "Track invoices and payments first. Upgrade when you need expenses, stock, or staff records.",
      canStayFree: true,
    };
  }

  if (teamSize === "solo" && priorities.length === 1 && priorities[0] === "invoices") {
    return {
      recommendedTier: "starter",
      headline: "Free fits a solo invoicing workflow",
      summary:
        "Start on Free for invoices and payment tracking. Pick Starter when you need expenses or a customer list.",
      canStayFree: true,
    };
  }

  const wantsHr = priorities.includes("leave");
  const wantsPos = priorities.includes("pos");
  const wantsStock = priorities.includes("stock");
  const wantsMarketing = priorities.includes("marketing");
  const smallTeam = teamSize === "2-5";
  const growingTeam = teamSize === "6-15" || teamSize === "16+";

  if (wantsMarketing || businessType === "online") {
    return {
      recommendedTier: "enterprise",
      headline: "Pro for online + marketing",
      summary:
        "CRM, content, and multi-channel growth tools live in Pro. Try Starter or Growth first if budget is tight.",
      canStayFree: false,
      bundleHint: "Pakej Online — Shopee sync + Marketing AI (coming soon)",
    };
  }

  if (wantsHr || wantsPos || growingTeam) {
    const tier: TierKey = growingTeam ? "sme" : "sme";
    return {
      recommendedTier: tier,
      headline: growingTeam ? "Growth for a small team" : "Growth for staff & sales",
      summary:
        "Leave, employees, POS-lite, and core ops are included in Growth — no add-on spreadsheet needed.",
      canStayFree: false,
      bundleHint:
        businessType === "fnb"
          ? "Pakej Kafe — Azam HR + daily close-out"
          : businessType === "retail"
            ? "Pakej Kedai — Azam HR + Dynamic QR"
            : undefined,
    };
  }

  if (wantsStock || smallTeam || businessType === "retail" || businessType === "fnb") {
    return {
      recommendedTier: "micro",
      headline: "Starter for shop + admin",
      summary:
        "Finance, admin, and operations modules unlock on Starter. Good for kedai and small teams.",
      canStayFree: false,
      bundleHint:
        businessType === "fnb" ? "Pakej Kafe available on Growth" : undefined,
    };
  }

  return {
    recommendedTier: "starter",
    headline: "Try Free first",
    summary:
      "No card needed. Move to Starter when you outgrow invoices-only.",
    canStayFree: true,
  };
}
