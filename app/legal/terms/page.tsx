export const metadata = {
  title: "Terms of Service — Bantu Niaga",
  description:
    "The agreement between Bantu Niaga Sdn. Bhd. and each business using the platform.",
};

export default function TermsPage() {
  return (
    <>
      <header className="mb-10 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          Terms of Service
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-4xl">
          Terms of Service
        </h1>
        <p className="text-sm text-ink-muted dark:text-cream-400">
          By creating a Bantu Niaga account you accept these terms together
          with the linked{" "}
          <a
            href="/legal/privacy"
            className="text-brand-700 underline dark:text-brand-200"
          >
            Privacy Notice
          </a>
          .
        </p>
      </header>

      <Section title="1. The service">
        <p>
          Bantu Niaga is a multi-tenant SaaS platform for Malaysian SMEs
          providing accounting, HR, marketing, point-of-sale, and AI
          assistants in a single workspace.
        </p>
      </Section>

      <Section title="2. Acceptable use">
        <ul>
          <li>
            Use the platform only for lawful business activities.
          </li>
          <li>
            Don&rsquo;t upload malware, conduct DDoS, or attempt to access data
            of other tenants.
          </li>
          <li>
            Don&rsquo;t reverse-engineer the platform or circumvent rate limits.
          </li>
          <li>
            You&rsquo;re responsible for the actions of every user you add to
            your business workspace.
          </li>
        </ul>
      </Section>

      <Section title="3. Subscription & billing">
        <p>
          Plans renew monthly until cancelled. You can change plans, add
          credits, or cancel anytime from <em>Settings → Subscription</em>.
          Refunds for unused time are pro-rated where required by law.
        </p>
      </Section>

      <Section title="4. Data ownership">
        <p>
          You own everything you upload. We&rsquo;re the data processor; you
          are the data controller for records of your customers and
          employees. You may export your data at any time via{" "}
          <em>Settings → Privacy &amp; data</em>.
        </p>
      </Section>

      <Section title="5. Service levels">
        <p>
          We target 99.9% monthly uptime measured at the application
          edge. Scheduled maintenance is announced at least 48 hours in
          advance.
        </p>
      </Section>

      <Section title="6. Limitation of liability">
        <p>
          To the maximum extent permitted under Malaysian law, our aggregate
          liability arising out of or relating to the service is capped at the
          fees you paid in the 12 months preceding the claim.
        </p>
      </Section>

      <Section title="7. Termination">
        <p>
          You can close your account anytime from{" "}
          <em>Settings → Privacy &amp; data</em>. We may suspend or terminate
          access for material breach of these terms, abuse, or non-payment,
          giving 14 days written notice except where immediate action is
          necessary to protect the platform.
        </p>
      </Section>

      <Section title="8. Governing law">
        <p>
          These terms are governed by the laws of Malaysia. The courts of
          Kuala Lumpur have exclusive jurisdiction.
        </p>
      </Section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 space-y-3">
      <h2 className="text-xl font-semibold text-ink dark:text-cream-100">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-ink-muted dark:text-cream-400 [&_a]:text-brand-700 [&_a]:underline [&_a]:dark:text-brand-200 [&_strong]:font-semibold [&_strong]:text-ink [&_strong]:dark:text-cream-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
