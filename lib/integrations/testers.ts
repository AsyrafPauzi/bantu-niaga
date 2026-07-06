import "server-only";

import { decryptSecret, type SealedSecret } from "./crypto";

/**
 * Per-integration smoke-test runners.
 *
 * Each runner accepts the persisted `config` + decrypted `secrets` and
 * returns `{ ok, message? }`. Designed to be cheap and quotaless where
 * possible (e.g. OpenAI uses `/models`, not a chat completion).
 *
 * If an integration has no runner registered, `runIntegrationTest()`
 * returns `{ ok: true, message: "No smoke-test defined." }` so the admin
 * can still mark it as known-working manually.
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
  openai: async ({ secrets, config }) => {
    const key = secrets.api_key;
    if (!key) return { ok: false, message: "api_key is missing" };
    const r = await fetchJson("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
        ...(config.organization_id
          ? { "OpenAI-Organization": String(config.organization_id) }
          : {}),
      },
    });
    if (r.ok) return { ok: true, message: "Authenticated; /v1/models returned 200." };
    return {
      ok: false,
      message: `OpenAI rejected the key (HTTP ${r.status}).`,
    };
  },

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

  anthropic: async ({ secrets }) => {
    const key = secrets.api_key;
    if (!key) return { ok: false, message: "api_key is missing" };
    // Anthropic doesn't have a no-cost endpoint, so we just validate the
    // key shape (`sk-ant-…`). A live ping happens on first real call.
    if (/^sk-ant-/.test(key)) {
      return {
        ok: true,
        message: "Key shape looks valid (live ping deferred to first call).",
      };
    }
    return { ok: false, message: "Key doesn't match the expected sk-ant-… shape." };
  },

  "meta-graph": async ({ secrets, config }) => {
    if (!secrets.app_secret) return { ok: false, message: "app_secret missing" };
    if (!config.app_id) return { ok: false, message: "app_id missing" };
    const r = await fetchJson(
      `https://graph.facebook.com/v19.0/${config.app_id}?access_token=${config.app_id}|${secrets.app_secret}`,
      {},
    );
    if (r.ok) return { ok: true, message: "Meta accepted the app-token." };
    return {
      ok: false,
      message: `Meta rejected the credentials (HTTP ${r.status}).`,
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

  // Catch-all key-shape validators for integrations without a cheap
  // verification endpoint. These let the admin at least confirm the
  // string is present and non-empty.
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

  "whatsapp-cloud": async ({ secrets, config }) => {
    if (!secrets.access_token)
      return { ok: false, message: "access_token missing" };
    if (!config.phone_number_id)
      return { ok: false, message: "phone_number_id missing" };
    const r = await fetchJson(
      `https://graph.facebook.com/v19.0/${config.phone_number_id}`,
      {
        headers: { Authorization: `Bearer ${secrets.access_token}` },
      },
    );
    if (r.ok) return { ok: true, message: "WhatsApp Cloud API accepted the token." };
    return {
      ok: false,
      message: `Meta rejected the WABA credentials (HTTP ${r.status}).`,
    };
  },
};

export async function runIntegrationTest(opts: {
  slug: string;
  config: Record<string, unknown>;
  /** Sealed secrets as stored in the DB. We decrypt only when needed. */
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
