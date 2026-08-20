/** Map primary / sub nav hrefs to message keys under `nav.*`. */
export function navMessageKey(href: string): string | null {
  if (href.includes("aiman=open")) return "aiman";
  const path = href.split("?")[0] ?? href;
  switch (path) {
    case "/":
    case "/home":
      return "dashboard";
    case "/admin":
      return "admin";
    case "/admin/storage":
      return "storage";
    case "/admin/tasks":
      return "tasks";
    case "/admin/compliance":
      return "compliance";
    case "/admin/documents":
      return "documents";
    case "/finance":
      return "finance";
    case "/finance/invoices":
      return "invoices";
    case "/finance/income":
      return "income";
    case "/finance/expenses":
      return "expenses";
    case "/finance/reports":
      return "reports";
    case "/finance/customers":
      return "customers";
    case "/operations":
      return "operations";
    case "/operations/orders":
      return "orders";
    case "/operations/products":
      return "products";
    case "/operations/services":
      return "services";
    case "/operations/bookings":
      return "bookings";
    case "/operations/suppliers":
      return "suppliers";
    case "/sales":
      return "sales";
    case "/sales/pos":
      return "pos";
    case "/sales/leads":
      return "leads";
    case "/marketing":
      return "marketing";
    case "/marketing/customers":
      return "customers";
    case "/marketing/segments":
      return "segments";
    case "/marketing/content":
      return "content";
    case "/marketing/broadcasts":
      return "broadcasts";
    case "/marketing/coupons":
      return "coupons";
    case "/hr":
      return "hr";
    case "/hr/employees":
      return "employees";
    case "/hr/leave":
      return "leave";
    case "/hr/holidays":
      return "holidays";
    case "/marketplace":
      return "marketplace";
    case "/settings":
      return "settings";
    case "/boardroom":
      return "boardroom";
    case "/more":
      return "more";
    default:
      return null;
  }
}

/** Prefer label-aware key for ambiguous hrefs (e.g. HR Overview → /hr). */
export function navLabelFor(
  href: string,
  fallbackLabel: string,
  tNav: (key: string) => string,
): string {
  if (href.split("?")[0] === "/hr" && fallbackLabel === "Overview") {
    return tNav("hrOverview");
  }
  const key = navMessageKey(href);
  return key ? tNav(key) : fallbackLabel;
}

/** Sidebar group labels from English source strings in `app-nav`. */
export function navGroupMessageKey(label: string): string | null {
  switch (label) {
    case "Overview":
      return "overviewGroup";
    case "Modules":
      return "modulesGroup";
    case "Platform":
      return "platformGroup";
    default:
      return null;
  }
}

/** Settings hub tiles — map href → settings.* title/desc keys. */
export function settingsNavMessageKeys(
  href: string,
): { title: string; desc: string } | null {
  switch (href) {
    case "/settings/subscription":
      return { title: "subscriptionTitle", desc: "subscriptionDesc" };
    case "/settings/billing":
      return { title: "billingTitle", desc: "billingDesc" };
    case "/settings/security":
      return { title: "securityTitle", desc: "securityDesc" };
    case "/settings/integrations":
      return { title: "integrationsTitle", desc: "integrationsDesc" };
    case "/settings/privacy":
      return { title: "privacyTitle", desc: "privacyDesc" };
    case "/settings/business":
      return { title: "businessTitle", desc: "businessDesc" };
    case "/settings/team":
      return { title: "teamTitle", desc: "teamDesc" };
    case "/settings/branding":
      return { title: "brandingTitle", desc: "brandingDesc" };
    case "/settings/appearance":
      return { title: "appearanceTitle", desc: "appearanceDesc" };
    case "/settings/ai-agents":
      return { title: "aiAgentsTitle", desc: "aiAgentsDesc" };
    default:
      return null;
  }
}

export function settingsGroupMessageKey(title: string): string | null {
  switch (title) {
    case "Plan & billing":
      return "planBilling";
    case "Security":
      return "securityGroup";
    case "Workspace":
      return "workspace";
    case "AI":
      return "aiGroup";
    default:
      return null;
  }
}
