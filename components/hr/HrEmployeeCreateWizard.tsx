"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrToast } from "@/components/hr/HrToast";
import { EMERGENCY_CONTACT_RELATIONSHIPS, MALAYSIAN_BANKS } from "@/lib/hr/schemas";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

const STEPS = ["Who", "Contact", "Payroll"] as const;

type Step = 0 | 1 | 2;

function FieldLabel({
  children,
  recommended,
  optional,
  htmlFor,
}: {
  children: ReactNode;
  recommended?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex min-h-[1.25rem] flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted dark:text-cream-400"
    >
      <span>{children}</span>
      {recommended ? (
        <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300">
          Recommended
        </span>
      ) : null}
      {optional ? (
        <span className="text-[10px] font-normal normal-case text-ink-subtle dark:text-cream-500">
          Optional
        </span>
      ) : null}
    </label>
  );
}

function Field({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

export function HrEmployeeCreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    employee_number: "",
    role_title: "",
    employment_type: "full_time",
    start_date: "",
    contract_end_date: "",
    phone_e164: "",
    email: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    bank_name: "",
    bank_account_no: "",
    bank_account_holder: "",
    base_salary_myr: "",
    annual_leave_entitlement_days: "8",
    leave_entitlements_mc: "",
    leave_entitlements_emergency: "",
    leave_entitlements_hospitalisation: "",
  });
  const [relationshipOther, setRelationshipOther] = useState("");
  const [bankOther, setBankOther] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function canNext(): boolean {
    if (step === 0) {
      return Boolean(form.full_name.trim() && form.role_title.trim() && form.start_date);
    }
    return true;
  }

  async function submit() {
    setBusy(true);
    try {
      const relationship =
        form.emergency_contact_relationship === "Other"
          ? relationshipOther.trim()
          : form.emergency_contact_relationship.trim();
      const bankName =
        form.bank_name === "Other" ? bankOther.trim() : form.bank_name.trim();

      const leave_entitlements: Record<string, number> = {};
      const mcRaw = form.leave_entitlements_mc.trim();
      const emergencyRaw = form.leave_entitlements_emergency.trim();
      const hospitalRaw = form.leave_entitlements_hospitalisation.trim();
      if (mcRaw !== "") leave_entitlements.mc = Number(mcRaw);
      if (emergencyRaw !== "") leave_entitlements.emergency = Number(emergencyRaw);
      if (hospitalRaw !== "") leave_entitlements.hospitalisation = Number(hospitalRaw);

      const {
        leave_entitlements_mc: _mc,
        leave_entitlements_emergency: _el,
        leave_entitlements_hospitalisation: _hosp,
        annual_leave_entitlement_days: alDays,
        ...restForm
      } = form;

      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...restForm,
          employee_number: form.employee_number.trim() || undefined,
          contract_end_date: form.contract_end_date.trim() || undefined,
          email: form.email.trim() || undefined,
          phone_e164: form.phone_e164.trim() || undefined,
          base_salary_myr: form.base_salary_myr.trim()
            ? Number(form.base_salary_myr)
            : undefined,
          annual_leave_entitlement_days: alDays.trim()
            ? Number(alDays)
            : 8,
          leave_entitlements:
            Object.keys(leave_entitlements).length > 0
              ? leave_entitlements
              : undefined,
          emergency_contact_relationship: relationship || undefined,
          bank_name: bankName || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({
          kind: "err",
          message: json?.message ?? json?.error ?? "Could not add employee.",
        });
        return;
      }
      const id = json?.employee?.id as string | undefined;
      if (id) {
        router.push(`/hr/employees/${id}?welcome=1`);
      } else {
        router.push("/hr/employees");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <HrMobileSubnav />

      <Link
        href="/hr/employees"
        className={cn("inline-flex items-center gap-1.5 text-sm", hrClasses.link)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>

      <div className="mt-4">
        <p className={cn("text-xs font-semibold uppercase tracking-widest", hrClasses.textMuted)}>
          HR · New employee
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">Add employee</h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Step {step + 1} of 3 — {STEPS[step]}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "h-1.5 flex-1 rounded-full transition",
              i <= step ? "bg-[#0D9488]" : "bg-cream-200 dark:bg-hairline-dark",
            )}
            aria-hidden
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-cream-200 bg-white p-6 sm:p-8 dark:border-hairline-dark dark:bg-panel-dark">
        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <h2 className={hrClasses.sectionTitle}>Who is joining?</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>Basic job details for your roster.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <Field>
                <FieldLabel htmlFor="full_name">Full name</FieldLabel>
                <input
                  id="full_name"
                  required
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  className={hrClasses.input}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="employee_number" optional>
                  Employee number
                </FieldLabel>
                <input
                  id="employee_number"
                  value={form.employee_number}
                  onChange={(e) => update("employee_number", e.target.value)}
                  placeholder="Auto-assigns EMP-001 if blank"
                  maxLength={40}
                  className={hrClasses.input}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="role_title">Job title</FieldLabel>
                <input
                  id="role_title"
                  required
                  value={form.role_title}
                  onChange={(e) => update("role_title", e.target.value)}
                  className={hrClasses.input}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="employment_type">Employment type</FieldLabel>
                <select
                  id="employment_type"
                  value={form.employment_type}
                  onChange={(e) => update("employment_type", e.target.value)}
                  className={hrClasses.input}
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="start_date">Start date</FieldLabel>
                <input
                  id="start_date"
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => update("start_date", e.target.value)}
                  className={hrClasses.input}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contract_end_date" optional>
                  Contract end date
                </FieldLabel>
                <input
                  id="contract_end_date"
                  type="date"
                  value={form.contract_end_date}
                  onChange={(e) => update("contract_end_date", e.target.value)}
                  className={hrClasses.input}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div>
              <h2 className={hrClasses.sectionTitle}>How do we reach them?</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Email is optional for the roster. Staff who clock in or apply leave
                themselves sign in with a team login linked on their profile — use
                the same email when you invite them.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <Field>
                <FieldLabel htmlFor="phone_e164" recommended>
                  Phone
                </FieldLabel>
                <input
                  id="phone_e164"
                  value={form.phone_e164}
                  onChange={(e) => update("phone_e164", e.target.value)}
                  placeholder="+60123456789"
                  className={hrClasses.input}
                />
                <p className="mt-1.5 text-[11px] text-ink-muted dark:text-cream-500">
                  Best for WhatsApp leave links.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="email" optional>
                  Email
                </FieldLabel>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="name@company.com"
                  className={hrClasses.input}
                />
                <p className="mt-1.5 text-[11px] text-ink-muted dark:text-cream-500">
                  Recommended if they will clock in at /hr/me.
                </p>
              </Field>
            </div>

            <div className="border-t border-cream-200 pt-5 dark:border-hairline-dark">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle dark:text-cream-500">
                Emergency contact
              </p>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="emergency_contact_name" optional>
                    Contact name
                  </FieldLabel>
                  <input
                    id="emergency_contact_name"
                    value={form.emergency_contact_name}
                    onChange={(e) => update("emergency_contact_name", e.target.value)}
                    className={hrClasses.input}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="emergency_contact_relationship" optional>
                    Relationship
                  </FieldLabel>
                  <select
                    id="emergency_contact_relationship"
                    value={form.emergency_contact_relationship}
                    onChange={(e) => {
                      update("emergency_contact_relationship", e.target.value);
                      if (e.target.value !== "Other") setRelationshipOther("");
                    }}
                    className={hrClasses.input}
                  >
                    <option value="">Not set</option>
                    {EMERGENCY_CONTACT_RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="emergency_contact_phone" optional>
                    Emergency phone
                  </FieldLabel>
                  <input
                    id="emergency_contact_phone"
                    value={form.emergency_contact_phone}
                    onChange={(e) => update("emergency_contact_phone", e.target.value)}
                    placeholder="+60123456789"
                    className={hrClasses.input}
                  />
                </Field>
                {form.emergency_contact_relationship === "Other" ? (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="relationship_other">
                      Specify relationship
                    </FieldLabel>
                    <input
                      id="relationship_other"
                      value={relationshipOther}
                      onChange={(e) => setRelationshipOther(e.target.value)}
                      placeholder="e.g. Aunt, Guardian"
                      maxLength={80}
                      className={hrClasses.input}
                    />
                  </Field>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div>
              <h2 className={hrClasses.sectionTitle}>Payroll basics</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Optional now — you can upload IC and contract on their profile after saving.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="bank_name" optional>
                  Bank name
                </FieldLabel>
                <select
                  id="bank_name"
                  value={form.bank_name}
                  onChange={(e) => {
                    update("bank_name", e.target.value);
                    if (e.target.value !== "Other") setBankOther("");
                  }}
                  className={hrClasses.input}
                >
                  <option value="">Not set</option>
                  {MALAYSIAN_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </Field>
              {form.bank_name === "Other" ? (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="bank_other">Specify bank name</FieldLabel>
                  <input
                    id="bank_other"
                    value={bankOther}
                    onChange={(e) => setBankOther(e.target.value)}
                    placeholder="e.g. Bank Muamalat"
                    maxLength={120}
                    className={hrClasses.input}
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="bank_account_no" optional>
                  Bank account number
                </FieldLabel>
                <input
                  id="bank_account_no"
                  value={form.bank_account_no}
                  onChange={(e) => update("bank_account_no", e.target.value)}
                  className={hrClasses.input}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank_account_holder" optional>
                  Account holder name
                </FieldLabel>
                <input
                  id="bank_account_holder"
                  value={form.bank_account_holder}
                  onChange={(e) => update("bank_account_holder", e.target.value)}
                  className={hrClasses.input}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="base_salary_myr" optional>
                  Base salary (MYR/month)
                </FieldLabel>
                <input
                  id="base_salary_myr"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.base_salary_myr}
                  onChange={(e) => update("base_salary_myr", e.target.value)}
                  placeholder="e.g. 3500"
                  className={hrClasses.input}
                />
              </Field>
            </div>
            <div className="border-t border-cream-200 pt-5 dark:border-hairline-dark">
              <h3 className={hrClasses.sectionTitle}>Leave entitlements</h3>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Blank MC / emergency / hospitalisation uses company leave policy defaults.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:items-start">
                <Field>
                  <FieldLabel htmlFor="annual_leave_entitlement_days">
                    Annual leave (days/year)
                  </FieldLabel>
                  <input
                    id="annual_leave_entitlement_days"
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    value={form.annual_leave_entitlement_days}
                    onChange={(e) =>
                      update("annual_leave_entitlement_days", e.target.value)
                    }
                    className={hrClasses.input}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="leave_entitlements_mc" optional>
                    MC days
                  </FieldLabel>
                  <input
                    id="leave_entitlements_mc"
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    value={form.leave_entitlements_mc}
                    onChange={(e) =>
                      update("leave_entitlements_mc", e.target.value)
                    }
                    placeholder="Company default"
                    className={hrClasses.input}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="leave_entitlements_emergency" optional>
                    Emergency leave days
                  </FieldLabel>
                  <input
                    id="leave_entitlements_emergency"
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    value={form.leave_entitlements_emergency}
                    onChange={(e) =>
                      update("leave_entitlements_emergency", e.target.value)
                    }
                    placeholder="Company default"
                    className={hrClasses.input}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="leave_entitlements_hospitalisation" optional>
                    Hospitalisation days
                  </FieldLabel>
                  <input
                    id="leave_entitlements_hospitalisation"
                    type="number"
                    min={0}
                    max={365}
                    step={0.5}
                    value={form.leave_entitlements_hospitalisation}
                    onChange={(e) =>
                      update("leave_entitlements_hospitalisation", e.target.value)
                    }
                    placeholder="Company default"
                    className={hrClasses.input}
                  />
                </Field>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex justify-between gap-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => (s - 1) as Step)}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40",
            hrClasses.btnSecondary,
          )}
        >
          Back
        </button>
        {step < 2 ? (
          <button
            type="button"
            disabled={!canNext()}
            onClick={() => setStep((s) => (s + 1) as Step)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40",
              hrClasses.btnPrimary,
            )}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60",
              hrClasses.btnPrimary,
            )}
          >
            {busy ? "Saving…" : "Add employee"}
          </button>
        )}
      </div>

      {toast ? (
        <HrToast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}

      <div className="pb-16 lg:pb-6" />
    </div>
  );
}
