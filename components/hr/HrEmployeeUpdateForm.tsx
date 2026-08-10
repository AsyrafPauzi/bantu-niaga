"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HrToast } from "@/components/hr/HrToast";
import type { HrEmployeeRow } from "@/lib/hr/load";
import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  MALAYSIAN_BANKS,
} from "@/lib/hr/schemas";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function FieldLabel({
  children,
  recommended,
  optional,
  htmlFor,
}: {
  children: React.ReactNode;
  recommended?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={hrClasses.label}>
      <span className="flex flex-wrap items-center gap-2">
        {children}
        {recommended ? (
          <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300">
            Recommended
          </span>
        ) : null}
        {optional ? (
          <span className="text-[10px] font-normal normal-case text-ink-subtle">Optional</span>
        ) : null}
      </span>
    </label>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className={hrClasses.sectionTitle}>{title}</h3>
        {hint ? <p className={cn("mt-0.5", hrClasses.sectionHint)}>{hint}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function HrEmployeeUpdateForm({ employee }: { employee: HrEmployeeRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(null);

  const initialBank = employee.bank_name?.trim() ?? "";
  const initialRelationship = employee.emergency_contact_relationship?.trim() ?? "";

  const bankDefaults = useMemo(() => {
    if (!initialBank) return { select: "", other: "" };
    if ((MALAYSIAN_BANKS as readonly string[]).includes(initialBank)) {
      return { select: initialBank, other: "" };
    }
    return { select: "Other", other: initialBank };
  }, [initialBank]);

  const relationshipDefaults = useMemo(() => {
    if (!initialRelationship) return { select: "", other: "" };
    if ((EMERGENCY_CONTACT_RELATIONSHIPS as readonly string[]).includes(initialRelationship)) {
      return { select: initialRelationship, other: "" };
    }
    return { select: "Other", other: initialRelationship };
  }, [initialRelationship]);

  const [bankName, setBankName] = useState(bankDefaults.select);
  const [bankOther, setBankOther] = useState(bankDefaults.other);
  const [relationship, setRelationship] = useState(relationshipDefaults.select);
  const [relationshipOther, setRelationshipOther] = useState(relationshipDefaults.other);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const formEntries = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;

    const resolvedBank =
      bankName === "Other" ? bankOther.trim() : bankName.trim();
    const resolvedRelationship =
      relationship === "Other" ? relationshipOther.trim() : relationship.trim();

    const ent: Record<string, number> = { ...employee.leave_entitlements };
    const mcRaw = String(formEntries.leave_entitlements_mc ?? "").trim();
    const emergencyRaw = String(formEntries.leave_entitlements_emergency ?? "").trim();
    const hospitalRaw = String(formEntries.leave_entitlements_hospitalisation ?? "").trim();
    if (mcRaw === "") delete ent.mc;
    else ent.mc = Number(mcRaw);
    if (emergencyRaw === "") delete ent.emergency;
    else ent.emergency = Number(emergencyRaw);
    if (hospitalRaw === "") delete ent.hospitalisation;
    else ent.hospitalisation = Number(hospitalRaw);

    const body: Record<string, unknown> = {
      ...formEntries,
      bank_name: resolvedBank,
      emergency_contact_relationship: resolvedRelationship,
      leave_entitlements: ent,
    };
    delete body.leave_entitlements_mc;
    delete body.leave_entitlements_emergency;
    delete body.leave_entitlements_hospitalisation;

    try {
      const res = await fetch(`/api/hr/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({
          kind: "err",
          message: json?.message ?? json?.error ?? "Could not save changes.",
        });
        return;
      }
      setToast({ kind: "ok", message: "Saved" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const emp = employee as HrEmployeeRow & {
    identity_type?: string;
    identity_number?: string;
    identity_number_masked?: string;
    bank_account_no?: string;
    bank_account_no_masked?: string;
  };

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-8">
        <Section title="Job details" hint="Role and employment status on your roster.">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="full_name">Full name</FieldLabel>
            <input
              id="full_name"
              name="full_name"
              required
              maxLength={160}
              defaultValue={employee.full_name}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="employee_number" optional>
              Employee number
            </FieldLabel>
            <input
              id="employee_number"
              name="employee_number"
              maxLength={40}
              defaultValue={employee.employee_number ?? ""}
              placeholder="e.g. EMP-001"
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="role_title">Job title</FieldLabel>
            <input
              id="role_title"
              name="role_title"
              required
              maxLength={120}
              defaultValue={employee.role_title}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="employment_type">Employment type</FieldLabel>
            <select
              id="employment_type"
              name="employment_type"
              required
              defaultValue={employee.employment_type}
              className={hrClasses.input}
            >
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <select
              id="status"
              name="status"
              required
              defaultValue={employee.status}
              className={hrClasses.input}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="contract_end_date" optional>
              Contract end date
            </FieldLabel>
            <input
              id="contract_end_date"
              name="contract_end_date"
              type="date"
              defaultValue={employee.contract_end_date ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div id="hr-field-al-entitlement">
            <FieldLabel htmlFor="annual_leave_entitlement_days">
              Annual leave (days per year)
            </FieldLabel>
            <input
              id="annual_leave_entitlement_days"
              name="annual_leave_entitlement_days"
              type="number"
              min={0}
              max={365}
              step={0.5}
              defaultValue={employee.annual_leave_entitlement_days ?? 8}
              className={hrClasses.input}
            />
            <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-500">
              Updates the leave balance shown at the top of this page. Save profile to apply.
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="leave_entitlements_mc" optional>
              MC days (per year)
            </FieldLabel>
            <input
              id="leave_entitlements_mc"
              name="leave_entitlements_mc"
              type="number"
              min={0}
              max={365}
              step={0.5}
              placeholder="Use company default"
              defaultValue={employee.leave_entitlements?.mc ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="leave_entitlements_emergency" optional>
              Emergency leave days
            </FieldLabel>
            <input
              id="leave_entitlements_emergency"
              name="leave_entitlements_emergency"
              type="number"
              min={0}
              max={365}
              step={0.5}
              placeholder="Use company default"
              defaultValue={employee.leave_entitlements?.emergency ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="leave_entitlements_hospitalisation" optional>
              Hospitalisation days
            </FieldLabel>
            <input
              id="leave_entitlements_hospitalisation"
              name="leave_entitlements_hospitalisation"
              type="number"
              min={0}
              max={365}
              step={0.5}
              placeholder="Use company default"
              defaultValue={employee.leave_entitlements?.hospitalisation ?? ""}
              className={hrClasses.input}
            />
            <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-500">
              Leave blank to use the global quota from Leave policy.
            </p>
          </div>
        </Section>

        <Section
          title="Contact"
          hint="Phone is recommended for WhatsApp leave links and emergencies."
        >
          <div id="hr-field-phone">
            <FieldLabel htmlFor="phone_e164" recommended>
              Phone
            </FieldLabel>
            <input
              id="phone_e164"
              name="phone_e164"
              maxLength={24}
              placeholder="+60123456789"
              defaultValue={employee.phone_e164 ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="email" optional>
              Email
            </FieldLabel>
            <input
              id="email"
              name="email"
              type="email"
              maxLength={160}
              defaultValue={employee.email ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="emergency_contact_name" optional>
              Emergency contact name
            </FieldLabel>
            <input
              id="emergency_contact_name"
              name="emergency_contact_name"
              maxLength={160}
              defaultValue={employee.emergency_contact_name ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="emergency_contact_relationship" optional>
              Relationship
            </FieldLabel>
            <select
              id="emergency_contact_relationship"
              value={relationship}
              onChange={(e) => {
                setRelationship(e.target.value);
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
          </div>
          {relationship === "Other" ? (
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="emergency_contact_relationship_other" optional>
                Specify relationship
              </FieldLabel>
              <input
                id="emergency_contact_relationship_other"
                value={relationshipOther}
                onChange={(e) => setRelationshipOther(e.target.value)}
                placeholder="e.g. Aunt, Guardian"
                maxLength={80}
                className={hrClasses.input}
              />
            </div>
          ) : null}
          <div>
            <FieldLabel htmlFor="emergency_contact_phone" optional>
              Emergency contact phone
            </FieldLabel>
            <input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              maxLength={24}
              defaultValue={employee.emergency_contact_phone ?? ""}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="identity_type" optional>
              ID type
            </FieldLabel>
            <select
              id="identity_type"
              name="identity_type"
              defaultValue={emp.identity_type ?? ""}
              className={hrClasses.input}
            >
              <option value="">Not set</option>
              <option value="ic">IC</option>
              <option value="passport">Passport</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="identity_number" optional>
              IC / passport number
            </FieldLabel>
            <input
              id="identity_number"
              name="identity_number"
              maxLength={80}
              defaultValue={emp.identity_number ?? ""}
              placeholder={emp.identity_number_masked ?? "Leave blank to keep current"}
              className={hrClasses.input}
            />
          </div>
        </Section>

        <Section title="Bank & payroll" hint="Recommended before running payroll.">
          <div id="hr-field-bank-name" className="sm:col-span-2">
            <FieldLabel htmlFor="bank_name" recommended>
              Bank name
            </FieldLabel>
            <select
              id="bank_name"
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
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
          </div>
          {bankName === "Other" ? (
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="bank_name_other" recommended>
                Specify bank name
              </FieldLabel>
              <input
                id="bank_name_other"
                value={bankOther}
                onChange={(e) => setBankOther(e.target.value)}
                placeholder="e.g. Bank Muamalat"
                maxLength={120}
                className={hrClasses.input}
              />
            </div>
          ) : null}
          <div id="hr-field-bank-account">
            <FieldLabel htmlFor="bank_account_no" recommended>
              Bank account number
            </FieldLabel>
            <input
              id="bank_account_no"
              name="bank_account_no"
              maxLength={80}
              defaultValue={emp.bank_account_no ?? ""}
              placeholder={emp.bank_account_no_masked ?? "Account number"}
              className={hrClasses.input}
            />
          </div>
          <div>
            <FieldLabel htmlFor="base_salary_myr" optional>
              Base salary (MYR/month)
            </FieldLabel>
            <input
              id="base_salary_myr"
              name="base_salary_myr"
              type="number"
              min={0}
              step={0.01}
              defaultValue={
                employee.base_salary_myr != null ? employee.base_salary_myr : ""
              }
              placeholder="e.g. 3500"
              className={hrClasses.input}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="notes" optional>
              Notes
            </FieldLabel>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={500}
              defaultValue={employee.notes ?? ""}
              className={hrClasses.input}
            />
          </div>
        </Section>

        <button
          type="submit"
          disabled={busy}
          className={cn(
            "rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60",
            hrClasses.btnPrimary,
          )}
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
      {toast ? (
        <HrToast
          message={toast.message}
          kind={toast.kind}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
