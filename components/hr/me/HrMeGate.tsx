import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";

interface HrMeGateProps {
  kind: "addon_inactive" | "not_linked" | "unauthorized";
}

export function HrMeGate({ kind }: HrMeGateProps) {
  if (kind === "unauthorized") {
    return null;
  }

  const copy =
    kind === "addon_inactive"
      ? {
          title: "Staff portal not enabled",
          body: "Your company has not activated the Staff Self-Service Portal add-on. Ask your owner or HR to enable it in Marketplace.",
          cta: { href: "/marketplace", label: "Open Marketplace" },
        }
      : {
          title: "Profile not linked",
          body: "Your login is not linked to an employee record yet. Ask HR to connect your account to your staff profile.",
          cta: { href: "/home", label: "Back to Home" },
        };

  return (
    <Card>
      <CardBody className="space-y-4 py-10 text-center">
        <h1 className="text-lg font-semibold text-ink dark:text-cream-100">
          {copy.title}
        </h1>
        <p className="mx-auto max-w-md text-sm text-ink-muted dark:text-cream-400">
          {copy.body}
        </p>
        <Link
          href={copy.cta.href}
          className="inline-flex rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          {copy.cta.label}
        </Link>
      </CardBody>
    </Card>
  );
}
