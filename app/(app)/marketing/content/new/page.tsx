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
import { NewContentFormPencil } from "@/components/marketing/NewContentFormPencil";

export const metadata = { title: "New post" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewContentPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "content")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Content calendar.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = await searchParams;
  const dateParam = typeof raw.date === "string" ? raw.date : undefined;
  let prefillIso: string | undefined;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    prefillIso = new Date(`${dateParam}T09:00:00+08:00`).toISOString();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/content"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to calendar
      </Link>

      <PageHeader
        eyebrow="Marketing · Content"
        title="New post"
      />

      <NewContentFormPencil prefillDateIso={prefillIso} />
    </div>
  );
}
