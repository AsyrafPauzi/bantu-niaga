"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setSubmitting(false);
        return;
      }

      router.replace("/home");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-surface-light text-ink flex items-center justify-center px-4 py-10 dark:bg-surface-dark dark:text-cream-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/icon.png"
            alt="Bantu Niaga"
            width={80}
            height={80}
            priority
            className="h-20 w-20"
          />
          <div className="text-center">
            <p className="text-2xl font-bold tracking-tight">
              <span className="text-brand-700 dark:text-brand-200">Bantu</span>{" "}
              <span className="text-accent-500">Niaga</span>
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400 mt-1">
              SME-OS · All-in-One Business Platform
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Access your Bantu Niaga workspace.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-base text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-base text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
                />
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger dark:bg-status-danger/20"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="text-center text-xs text-ink-muted dark:text-cream-400">
          v0 scaffold · contact your admin if you don&apos;t have an account.
        </p>
      </div>
    </main>
  );
}
