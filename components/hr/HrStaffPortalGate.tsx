import Link from "next/link";
import { UserCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

/** Shown only when HR is unlocked but entitlement unexpectedly fails — primarily a link-logins hint. */
export function HrStaffPortalGate() {
  return (
    <Card>
      <CardBody className="space-y-4 py-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
          <UserCircle className="h-6 w-6" strokeWidth={2} />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink dark:text-cream-100">
            Staff self-service is included
          </h2>
          <p className="mx-auto max-w-md text-sm text-ink-muted dark:text-cream-400">
            On Solo and above, each staff member can use their own login at{" "}
            <span className="font-medium text-ink dark:text-cream-200">/hr/me</span>{" "}
            once you link their account on the employee profile.
          </p>
        </div>
        <Link
          href="/hr/employees"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Link staff logins
        </Link>
      </CardBody>
    </Card>
  );
}
