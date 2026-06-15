import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { NewSegmentForm } from "./new-segment-form";

export const metadata = { title: "New segment" };
export const dynamic = "force-dynamic";

export default async function NewSegmentPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "segments")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing segments.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/segments"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Segments
      </Link>

      <PageHeader
        eyebrow="Marketing · Segments"
        title="New custom segment"
        description="Stack as many or as few rules as you like. The matches counter updates as you type."
      />

      <Card>
        <CardBody>
          <NewSegmentForm />
        </CardBody>
      </Card>
    </div>
  );
}
