import {
  HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  HR_PUBLIC_HOLIDAYS_ADDON_SLUG,
  HR_STAFF_APPRAISAL_ADDON_SLUG,
  HR_STAFF_PORTAL_ADDON_SLUG,
} from "@/lib/marketplace/agent-types";

/** HR routes gated by a marketplace add-on slug. */
export const HR_ADDON_ROUTES: ReadonlyArray<{ href: string; addonSlug: string }> = [
  { href: "/hr/staff-portal", addonSlug: HR_STAFF_PORTAL_ADDON_SLUG },
  { href: "/hr/leave/policy", addonSlug: HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG },
  { href: "/hr/appraisals", addonSlug: HR_STAFF_APPRAISAL_ADDON_SLUG },
  { href: "/hr/holidays", addonSlug: HR_PUBLIC_HOLIDAYS_ADDON_SLUG },
  { href: "/hr/assistant", addonSlug: HR_ASSISTANT_ADDON_SLUG },
];

export const HR_ADDON_SLUGS = [
  HR_ADVANCED_LEAVE_POLICY_ADDON_SLUG,
  HR_STAFF_PORTAL_ADDON_SLUG,
  HR_STAFF_APPRAISAL_ADDON_SLUG,
  HR_PUBLIC_HOLIDAYS_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
] as const;
