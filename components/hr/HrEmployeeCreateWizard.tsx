"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrToast } from "@/components/hr/HrToast";
import { EMERGENCY_CONTACT_RELATIONSHIPS, MALAYSIAN_BANKS } from "@/lib/hr/schemas";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

const STEPS = ["Who", "Contact", "Payroll"] as const;

type Step = 0 | 1 | 2;

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
          <div className="space-y-4">
            <div>
              <h2 className={hrClasses.sectionTitle}>Who is joining?</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>Basic job details for your roster.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={hrClasses.label}>
                Full name
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
              <label className={hrClasses.label}>
                Employee number{" "}
                <span className="font-normal text-ink-subtle">(optional)</span>
                <input
                  value={form.employee_number}
                  onChange={(e) => update("employee_number", e.target.value)}
                  placeholder="Auto-assigns EMP-001 if blank"
                  maxLength={40}
                  className={hrClasses.input}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={hrClasses.label}>
                Job title
                <input
                  required
                  value={form.role_title}
                  onChange={(e) => update("role_title", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
              <label className={hrClasses.label}>
                Employment type
                <select
                  value={form.employment_type}
                  onChange={(e) => update("employment_type", e.target.value)}
                  className={hrClasses.input}
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={hrClasses.label}>
                Start date
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => update("start_date", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
              <label className={hrClasses.label}>
                Contract end date{" "}
                <span className="font-normal text-ink-subtle">(optional)</span>
                <input
                  type="date"
                  value={form.contract_end_date}
                  onChange={(e) => update("contract_end_date", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className={hrClasses.sectionTitle}>How do we reach them?</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Phone is recommended for WhatsApp leave links.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={hrClasses.label}>
                Phone
                <input
                  value={form.phone_e164}
                  onChange={(e) => update("phone_e164", e.target.value)}
                  placeholder="+60123456789"
                  className={hrClasses.input}
                />
              </label>
              <label className={hrClasses.label}>
                Email <span className="font-normal text-ink-subtle">(optional)</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
            </div>
            <label className={hrClasses.label}>
              Emergency contact <span className="font-normal text-ink-subtle">(optional)</span>
              <input
                value={form.emergency_contact_name}
                onChange={(e) => update("emergency_contact_name", e.target.value)}
                className={hrClasses.input}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={hrClasses.label}>
                Relationship
                <select
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
              </label>
              <label className={hrClasses.label}>
                Emergency phone
                <input
                  value={form.emergency_contact_phone}
                  onChange={(e) => update("emergency_contact_phone", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
            </div>
            {form.emergency_contact_relationship === "Other" ? (
              <label className={hrClasses.label}>
                Specify relationship
                <input
                  value={relationshipOther}
                  onChange={(e) => setRelationshipOther(e.target.value)}
                  placeholder="e.g. Aunt, Guardian"
                  maxLength={80}
                  className={hrClasses.input}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className={hrClasses.sectionTitle}>Payroll basics</h2>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Optional now — you can upload IC and contract on their profile after saving.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={cn(hrClasses.label, "sm:col-span-2")}>
                Bank name
                <select
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
              </label>
              {form.bank_name === "Other" ? (
                <label className={cn(hrClasses.label, "sm:col-span-2")}>
                  Specify bank name
                  <input
                    value={bankOther}
                    onChange={(e) => setBankOther(e.target.value)}
                    placeholder="e.g. Bank Muamalat"
                    maxLength={120}
                    className={hrClasses.input}
                  />
                </label>
              ) : null}
              <label className={hrClasses.label}>
                Bank account number
                <input
                  value={form.bank_account_no}
                  onChange={(e) => update("bank_account_no", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
              <label className={hrClasses.label}>
                Account holder name
                <input
                  value={form.bank_account_holder}
                  onChange={(e) => update("bank_account_holder", e.target.value)}
                  className={hrClasses.input}
                />
              </label>
              <label className={hrClasses.label}>
                Base salary (MYR/month){" "}
                <span className="font-normal text-ink-subtle">(optional)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.base_salary_myr}
                  onChange={(e) => update("base_salary_myr", e.target.value)}
                  placeholder="e.g. 3500"
                  className={hrClasses.input}
                />
              </label>
            </div>
            <div className="border-t border-cream-200 pt-4 dark:border-hairline-dark">
              <h3 className={hrClasses.sectionTitle}>Leave entitlements</h3>
              <p className={cn("mt-1", hrClasses.sectionHint)}>
                Blank MC / emergency / hospitalisation uses company leave policy defaults.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className={hrClasses.label}>
                  Annual leave (days/year)
                  <input
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
                </label>
                <label className={hrClasses.label}>
                  MC days{" "}
                  <span className="font-normal text-ink-subtle">(optional)</span>
                  <input
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
                </label>
                <label className={hrClasses.label}>
                  Emergency leave days{" "}
                  <span className="font-normal text-ink-subtle">(optional)</span>
                  <input
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
                </label>
                <label className={hrClasses.label}>
                  Hospitalisation days{" "}
                  <span className="font-normal text-ink-subtle">(optional)</span>
                  <input
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
                </label>
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
