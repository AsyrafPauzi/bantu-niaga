"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Save,
  TestTube2,
  XCircle,
} from "lucide-react";

import type {
  FieldDescriptor,
  IntegrationDescriptor,
  IntegrationRow,
} from "@/lib/integrations/types";

interface Props {
  descriptor: IntegrationDescriptor;
  initialRow: IntegrationRow;
  encryptionConfigured: boolean;
}

interface SecretState {
  /** New plaintext typed by the user. Empty string keeps existing value. */
  value: string;
  /** True when user explicitly clicked "Clear stored secret". */
  cleared: boolean;
  /** Show / hide masking. */
  visible: boolean;
}

function buildInitialConfig(
  row: IntegrationRow,
  fields: readonly FieldDescriptor[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "secret") continue;
    out[f.key] = row.config[f.key] ?? (f.type === "bool" ? false : "");
  }
  return out;
}

export function IntegrationEditor({
  descriptor,
  initialRow,
  encryptionConfigured,
}: Props) {
  const router = useRouter();
  const [row, setRow] = useState<IntegrationRow>(initialRow);
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    buildInitialConfig(initialRow, descriptor.fields),
  );
  const [secrets, setSecrets] = useState<Record<string, SecretState>>(() => {
    const out: Record<string, SecretState> = {};
    for (const f of descriptor.fields) {
      if (f.type === "secret") {
        out[f.key] = { value: "", cleared: false, visible: false };
      }
    }
    return out;
  });
  const [enabled, setEnabled] = useState(initialRow.enabled);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    for (const f of descriptor.fields) {
      if (!f.required) continue;
      if (f.type === "secret") {
        const s = secrets[f.key];
        const willHaveValue =
          row.secretsConfigured[f.key] || (s && !s.cleared && s.value.length > 0);
        if (!willHaveValue) missing.push(f.label);
      } else {
        const v = config[f.key];
        if (
          v === undefined ||
          v === null ||
          (typeof v === "string" && v.trim().length === 0)
        )
          missing.push(f.label);
      }
    }
    return missing;
  }, [descriptor.fields, secrets, config, row.secretsConfigured]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const secretPayload: Record<string, string | null> = {};
      for (const [k, s] of Object.entries(secrets)) {
        if (s.cleared) secretPayload[k] = null;
        else if (s.value.length > 0) secretPayload[k] = s.value;
      }
      const res = await fetch(
        `/api/super-admin/integrations/${descriptor.slug}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            config,
            ...(Object.keys(secretPayload).length
              ? { secrets: secretPayload }
              : {}),
          }),
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { row: IntegrationRow };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data?.row) {
        setError(json.error?.message ?? "Could not save integration.");
        return;
      }
      setRow(json.data.row);
      setConfig(buildInitialConfig(json.data.row, descriptor.fields));
      setSecrets((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          next[k] = { value: "", cleared: false, visible: false };
        }
        return next;
      });
      setSavedAt(new Date());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/super-admin/integrations/${descriptor.slug}/test`,
        { method: "POST" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { ok: boolean; message?: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setTestResult({
          ok: false,
          message: json.error?.message ?? "Test request failed.",
        });
        return;
      }
      setTestResult(json.data);
      router.refresh();
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setTesting(false);
    }
  }

  const lastTestedHuman = row.lastTestedAt
    ? new Date(row.lastTestedAt).toLocaleString("en-MY")
    : null;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-cream-300 bg-white p-5 shadow-card">
        <div>
          <p className="text-sm font-bold text-ink">Enabled</p>
          <p className="text-xs text-ink-muted">
            Disabling pauses every consumer that reads this integration —
            credentials stay saved and can be re-enabled instantly.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          disabled={busy}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-status-success" : "bg-cream-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="rounded-xl border border-cream-300 bg-white p-5 shadow-card">
        <h3 className="text-sm font-bold text-ink">Configuration</h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          Secrets are AES-256-GCM encrypted with INTEGRATION_ENCRYPTION_KEY
          before persisting. Once saved, the actual value is never returned
          to this UI — only a placeholder.
        </p>

        <div className="mt-5 space-y-4">
          {descriptor.fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              config={config}
              setConfig={setConfig}
              secrets={secrets}
              setSecrets={setSecrets}
              row={row}
              encryptionConfigured={encryptionConfigured}
            />
          ))}
        </div>

        {requiredMissing.length > 0 ? (
          <p className="mt-4 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-[#8C5C0A]">
            Required fields still missing:{" "}
            <strong>{requiredMissing.join(", ")}</strong>
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Save className="h-4 w-4" strokeWidth={2} />
            )}
            Save changes
          </button>
          <button
            type="button"
            onClick={runTest}
            disabled={testing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <TestTube2 className="h-4 w-4" strokeWidth={2} />
            )}
            Run smoke-test
          </button>
          {savedAt ? (
            <span className="text-xs text-status-success">
              Saved at {savedAt.toLocaleTimeString("en-MY")}
            </span>
          ) : null}
        </div>

        {testResult ? (
          <div
            className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-sm ${
              testResult.ok
                ? "border-status-success/30 bg-status-success/10 text-status-success"
                : "border-status-danger/30 bg-status-danger/10 text-status-danger"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4" strokeWidth={2.5} />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4" strokeWidth={2.5} />
            )}
            <div>
              <p className="font-semibold">
                {testResult.ok ? "Test passed" : "Test failed"}
              </p>
              {testResult.message ? (
                <p className="mt-0.5 text-xs">{testResult.message}</p>
              ) : null}
            </div>
          </div>
        ) : lastTestedHuman ? (
          <p className="mt-4 text-[11px] text-ink-muted">
            Last test: <strong>{row.testStatus}</strong> at {lastTestedHuman}
            {row.lastTestError ? ` — ${row.lastTestError}` : ""}
          </p>
        ) : null}
      </div>

      {row.updatedByAdminEmail ? (
        <p className="text-[11px] text-ink-muted">
          Last edited by{" "}
          <strong className="text-ink">{row.updatedByAdminEmail}</strong> on{" "}
          {row.updatedAt ? new Date(row.updatedAt).toLocaleString("en-MY") : "—"}.
        </p>
      ) : null}
    </section>
  );
}

function FieldRow({
  field,
  config,
  setConfig,
  secrets,
  setSecrets,
  row,
  encryptionConfigured,
}: {
  field: FieldDescriptor;
  config: Record<string, unknown>;
  setConfig: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  secrets: Record<string, SecretState>;
  setSecrets: (updater: (prev: Record<string, SecretState>) => Record<string, SecretState>) => void;
  row: IntegrationRow;
  encryptionConfigured: boolean;
}) {
  if (field.type === "bool") {
    const checked = Boolean(config[field.key]);
    return (
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) =>
            setConfig((p) => ({ ...p, [field.key]: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 rounded border-cream-300 text-brand-500 focus:ring-brand-400"
        />
        <span>
          <span className="block font-semibold text-ink">{field.label}</span>
          {field.helper ? (
            <span className="text-xs text-ink-muted">{field.helper}</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (field.type === "select") {
    const value = (config[field.key] as string) ?? "";
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-ink">
          {field.label}
          {field.required ? (
            <span className="ml-1 text-status-danger">*</span>
          ) : null}
        </span>
        <select
          value={value}
          onChange={(e) =>
            setConfig((p) => ({ ...p, [field.key]: e.target.value }))
          }
          className="block w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
        >
          <option value="">— Select —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.helper ? (
          <span className="mt-1 block text-xs text-ink-muted">
            {field.helper}
          </span>
        ) : null}
      </label>
    );
  }

  if (field.type === "secret") {
    const state = secrets[field.key];
    const isStored = row.secretsConfigured[field.key] && !state.cleared;
    return (
      <label className="block text-sm">
        <span className="mb-1 flex items-center justify-between font-semibold text-ink">
          <span>
            {field.label}
            {field.required ? (
              <span className="ml-1 text-status-danger">*</span>
            ) : null}
          </span>
          {isStored ? (
            <button
              type="button"
              onClick={() =>
                setSecrets((p) => ({
                  ...p,
                  [field.key]: { value: "", cleared: true, visible: false },
                }))
              }
              className="text-[11px] text-status-danger hover:underline"
            >
              Clear stored value
            </button>
          ) : null}
        </span>
        <div className="relative">
          <input
            type={state.visible ? "text" : "password"}
            value={state.value}
            placeholder={
              isStored
                ? "•••••••• (saved — type to overwrite)"
                : field.placeholder ?? "Paste secret"
            }
            disabled={!encryptionConfigured}
            onChange={(e) =>
              setSecrets((p) => ({
                ...p,
                [field.key]: {
                  value: e.target.value,
                  cleared: false,
                  visible: p[field.key]?.visible ?? false,
                },
              }))
            }
            autoComplete="off"
            className="block w-full rounded-lg border border-cream-300 bg-white px-3 py-2 pr-10 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:cursor-not-allowed disabled:bg-cream-100"
          />
          {state.value.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                setSecrets((p) => ({
                  ...p,
                  [field.key]: { ...p[field.key], visible: !p[field.key].visible },
                }))
              }
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-muted hover:text-ink"
              aria-label={state.visible ? "Hide secret" : "Show secret"}
            >
              {state.visible ? (
                <EyeOff className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          ) : null}
        </div>
        {!encryptionConfigured ? (
          <span className="mt-1 block text-xs text-status-warning">
            Disabled — INTEGRATION_ENCRYPTION_KEY must be set on the server first.
          </span>
        ) : field.helper ? (
          <span className="mt-1 block text-xs text-ink-muted">
            {field.helper}
          </span>
        ) : null}
      </label>
    );
  }

  // text / url
  const value = (config[field.key] as string) ?? "";
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-ink">
        {field.label}
        {field.required ? (
          <span className="ml-1 text-status-danger">*</span>
        ) : null}
      </span>
      <input
        type={field.type === "url" ? "url" : "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) =>
          setConfig((p) => ({ ...p, [field.key]: e.target.value }))
        }
        className="block w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
      />
      {field.helper ? (
        <span className="mt-1 block text-xs text-ink-muted">
          {field.helper}
        </span>
      ) : null}
    </label>
  );
}
