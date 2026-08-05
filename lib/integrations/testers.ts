import "server-only";

import { decryptSecret, type SealedSecret } from "./crypto";

/**
 * Per-integration smoke-test runners.
 */

type Tester = (input: {
  config: Record<string, unknown>;
  secrets: Record<string, string>;
}) => Promise<{ ok: boolean; message?: string }>;

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: { error: e instanceof Error ? e.message : "network_error" },
    };
  }
}

const TESTERS: Record<string, Tester> = {
  ilmu: async ({ secrets, config }) => {
    const key = secrets.api_key;
    if (!key) return { ok: false, message: "api_key is missing" };
    const base =
      (typeof config.base_url === "string" && config.base_url) ||
      "https://api.ilmu.ai/v1";
    const r = await fetchJson(`${base.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) return { ok: true, message: "Authenticated; ILMU /v1/models returned 200." };
    return {
      ok: false,
      message: `ILMU rejected the key (HTTP ${r.status}).`,
    };
  },

  resend: async ({ secrets }) => {
    if (!secrets.api_key) return { ok: false, message: "api_key missing" };
    const r = await fetchJson("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${secrets.api_key}` },
    });
    if (r.ok) return { ok: true, message: "Resend accepted the API key." };
    return {
      ok: false,
      message: `Resend rejected the key (HTTP ${r.status}).`,
    };
  },

  billplz: async ({ secrets, config }) => {
    if (!secrets.api_key) return { ok: false, message: "api_key missing" };
    if (!config.collection_id)
      return { ok: false, message: "collection_id missing" };
    return {
      ok: true,
      message:
        "Credentials present (live ping deferred — Billplz auth happens on first /v3/bills POST).",
    };
  },
};

export async function runIntegrationTest(opts: {
  slug: string;
  config: Record<string, unknown>;
  encryptedFields: Record<string, SealedSecret> | null;
}): Promise<{ ok: boolean; message?: string }> {
  const fn = TESTERS[opts.slug];
  if (!fn) {
    return {
      ok: true,
      message: "No automated smoke-test defined for this integration.",
    };
  }

  const secrets: Record<string, string> = {};
  for (const [k, sealed] of Object.entries(opts.encryptedFields ?? {})) {
    try {
      secrets[k] = decryptSecret(sealed);
    } catch {
      return {
        ok: false,
        message: `Could not decrypt "${k}" — INTEGRATION_ENCRYPTION_KEY may have changed.`,
      };
    }
  }
  return fn({ config: opts.config, secrets });
}
