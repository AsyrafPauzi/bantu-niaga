/** Map primary nav hrefs to message keys under `nav.*`. */
export function navMessageKey(href: string): string | null {
  switch (href) {
    case "/":
    case "/home":
      return "home";
    case "/admin":
      return "admin";
    case "/finance":
      return "finance";
    case "/operations":
      return "operations";
    case "/sales":
    case "/sales/pos":
      return href === "/sales/pos" ? "sales" : "sales";
    case "/marketing":
      return "marketing";
    case "/hr":
      return "hr";
    case "/marketplace":
      return "marketplace";
    case "/settings":
      return "settings";
    case "/boardroom":
      return "boardroom";
    default:
      return null;
  }
}
