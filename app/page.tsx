import { redirect } from "next/navigation";

/**
 * Root URL.
 *
 * v0 scaffold: redirects straight into the app shell. When auth ships,
 * this page becomes the marketing landing for unauthenticated visitors,
 * and authenticated users get redirected to the app shell home.
 */
export default function RootPage() {
  redirect("/home");
}
