import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { ContentEntryForm } from "@/components/marketing/ContentEntryForm";

export const metadata = { title: "New content entry" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewContentEntryPage({ searchParams }: PageProps) {
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
            You don't have access to the Marketing content calendar.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = await searchParams;
  const dateRaw = raw?.date;
  const prefillDate = typeof dateRaw === "string" ? dateRaw : undefined;
  // Sanity-check the YYYY-MM-DD shape so a bad query string doesn't slip
  // a free-form value into the form's date input.
  const safePrefill =
    prefillDate && /^\d{4}-\d{2}-\d{2}$/.test(prefillDate)
      ? prefillDate
      : undefined;

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/marketing/content"
          className="text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          ← Content calendar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-cream-100">
          New content entry
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-muted dark:text-cream-400">
          Capture a TikTok, Instagram, or Facebook idea. Mark it Drafted once
          the caption is written, Scheduled when it has a date, and Posted
          after you've published it.
        </p>
      </header>

      <ContentEntryForm mode="create" prefillDateIso={safePrefill} />
    </div>
  );
}
