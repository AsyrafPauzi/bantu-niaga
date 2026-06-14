import { RETENTION_SCHEDULE } from "@/lib/privacy/catalog";

export const metadata = {
  title: "Privacy Notice — Bantu Niaga",
  description:
    "How Bantu Niaga collects, uses, retains, and shares personal data under Malaysia's Personal Data Protection Act 2010.",
};

const POLICY_VERSION = process.env.PRIVACY_POLICY_VERSION || "2026-06-14";

export default function PrivacyNoticePage() {
  return (
    <>
      <header className="mb-10 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
          Privacy Notice (PDPA 2010)
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-4xl">
          Privacy Notice
        </h1>
        <p className="text-sm text-ink-muted dark:text-cream-400">
          Version <strong>{POLICY_VERSION}</strong> · Effective from the date
          shown above. We notify users at least 14 days before any material
          change.
        </p>
      </header>

      <Section title="1. Who we are">
        <p>
          <strong>Bantu Niaga Sdn. Bhd.</strong> (&ldquo;Bantu Niaga&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) is the data controller of personal
          data submitted to the Bantu Niaga platform. We&rsquo;re registered in
          Malaysia and we comply with the Personal Data Protection Act 2010
          (&ldquo;PDPA&rdquo;) and its 2024 amendments.
        </p>
        <p>
          Data Protection Officer: <a href="mailto:dpo@bantuniaga.com">dpo@bantuniaga.com</a>.
        </p>
      </Section>

      <Section title="2. What personal data we collect">
        <p>
          We collect only what we need to run the platform and provide the
          services you signed up for. Categories include:
        </p>
        <ul>
          <li>
            <strong>Account profile</strong> — name, email, phone, role.
          </li>
          <li>
            <strong>Business records</strong> — invoices, payroll, employee
            records, customer ledger, marketing assets. These belong to your
            business as data controller; we&rsquo;re the processor.
          </li>
          <li>
            <strong>Authentication artifacts</strong> — hashed password,
            two-factor secrets, session cookies, IP address, user-agent.
          </li>
          <li>
            <strong>AI conversation history</strong> — messages you send to
            Maya, Finance, Operations, Boardroom agents.
          </li>
          <li>
            <strong>Connected social accounts</strong> — when you connect Meta,
            Instagram, TikTok we store the OAuth access token and the public
            page metadata necessary to publish and read insights.
          </li>
          <li>
            <strong>Billing data</strong> — last 4 digits of your card,
            issuing bank, and the full record of charges (held by our payment
            processor; we never store full PAN).
          </li>
          <li>
            <strong>Audit log</strong> — every privileged action and its
            actor, retained for security and dispute resolution.
          </li>
        </ul>
      </Section>

      <Section title="3. Why we process your data (legal basis)">
        <ul>
          <li>
            <strong>Contract (PDPA s.6(1)(a))</strong> — to deliver the
            platform features you signed up for.
          </li>
          <li>
            <strong>Consent (PDPA s.6(1)(b))</strong> — marketing emails,
            product newsletters, and AI training. Manage from{" "}
            <em>Settings → Privacy &amp; data</em>.
          </li>
          <li>
            <strong>Legal obligation</strong> — tax records (7 years), AML/CFT
            (where applicable), regulatory disclosures.
          </li>
          <li>
            <strong>Legitimate interest</strong> — security monitoring, fraud
            detection, capacity planning.
          </li>
        </ul>
      </Section>

      <Section title="4. Who we share data with">
        <p>
          We share strictly-necessary data with sub-processors so the platform
          can function. Each is bound by a data processing agreement:
        </p>
        <ul>
          <li>
            <strong>Supabase (USA / Singapore region)</strong> — primary
            database, authentication, file storage.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting + edge network.
          </li>
          <li>
            <strong>Meta Platforms</strong> — when you connect your Facebook /
            Instagram Business account so we can publish on your behalf.
          </li>
          <li>
            <strong>Stripe / Billplz / iPay88</strong> — payment processing.
          </li>
          <li>
            <strong>AI model providers</strong> — OpenAI / Anthropic for the AI
            agents (unless you opt out of AI training).
          </li>
        </ul>
        <p>
          A current list is maintained at{" "}
          <a href="/legal/sub-processors">/legal/sub-processors</a> and is
          updated at least 14 days before any change.
        </p>
      </Section>

      <Section title="5. How long we keep your data">
        <div className="not-prose overflow-hidden rounded-lg border border-cream-200 dark:border-hairline-dark">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-50 text-[10px] font-bold uppercase tracking-wider text-ink-subtle dark:bg-panel-dark/40">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Retention</th>
                <th className="px-4 py-2">Legal basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {RETENTION_SCHEDULE.map((row) => (
                <tr key={row.category} className="bg-white dark:bg-panel-dark">
                  <td className="px-4 py-3 align-top text-ink dark:text-cream-100">
                    {row.category}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted dark:text-cream-400">
                    {row.retention}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted dark:text-cream-400">
                    {row.legalBasis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="6. Your rights under PDPA">
        <p>
          You can exercise any of the rights below at any time from{" "}
          <em>Settings → Privacy &amp; data</em> when signed in, or by emailing
          our DPO. We respond within 21 days as required by s.30.
        </p>
        <ul>
          <li>
            <strong>Right to access</strong> — download a machine-readable
            bundle of your personal data.
          </li>
          <li>
            <strong>Right to rectification</strong> — correct anything that&rsquo;s
            wrong.
          </li>
          <li>
            <strong>Right to erasure</strong> — close your account; we soft-
            delete immediately and hard-delete after a 30-day grace.
          </li>
          <li>
            <strong>Right to withdraw consent</strong> — toggle off marketing,
            AI training, analytics, etc.
          </li>
          <li>
            <strong>Right to object</strong> — to processing that uses
            legitimate-interest basis. Contact DPO.
          </li>
          <li>
            <strong>Right to data portability</strong> — same export endpoint
            returns JSON suitable for import elsewhere.
          </li>
        </ul>
      </Section>

      <Section title="7. Security">
        <p>
          We encrypt all data in transit (TLS 1.2+) and at rest. Access to
          production data is gated by hardware-keyed MFA and audited. We
          run automated dependency-vulnerability scans on every build and
          third-party security review at least annually.
        </p>
        <p>
          If we ever detect a personal-data breach, we&rsquo;ll notify the
          Personal Data Protection Department and affected users within 72
          hours, as required by the 2024 amendments to the PDPA.
        </p>
      </Section>

      <Section title="8. International transfers">
        <p>
          Personal data is processed in Singapore and Malaysia by default. Some
          sub-processors may process data in the United States or European
          Union. We rely on the &ldquo;adequate level of protection&rdquo;
          exception under s.129 of the PDPA combined with contractual
          standard data-protection clauses with each transferee.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          We use only strictly-necessary cookies — session, CSRF, and consent
          state. No tracking pixels, no third-party advertising cookies. You
          don&rsquo;t need a cookie banner because we don&rsquo;t set any
          consent-required cookies.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Data Protection Officer<br />
          Bantu Niaga Sdn. Bhd.<br />
          Email: <a href="mailto:dpo@bantuniaga.com">dpo@bantuniaga.com</a>
        </p>
        <p>
          If you&rsquo;re unhappy with our handling of a request, you may also
          complain to the{" "}
          <a
            href="https://www.pdp.gov.my"
            target="_blank"
            rel="noreferrer"
          >
            Department of Personal Data Protection (JPDP) Malaysia
          </a>
          .
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
