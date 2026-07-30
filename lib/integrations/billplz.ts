import "server-only";

import { createHmac } from "node:crypto";

const BILLPLZ_SANDBOX = "https://www.billplz-sandbox.com/api/v3";
const BILLPLZ_LIVE = "https://www.billplz.com/api/v3";

export interface BillplzBillInput {
  collectionId: string;
  email: string;
  name: string;
  amountCents: number;
  description: string;
  callbackUrl: string;
  redirectUrl?: string;
  reference1?: string;
  reference2?: string;
}

export interface BillplzBill {
  id: string;
  url: string;
  state: string;
  paid: boolean;
  amount: number;
}

function apiBase(): string {
  return process.env.BILLPLZ_SANDBOX === "true" ? BILLPLZ_SANDBOX : BILLPLZ_LIVE;
}

function authHeader(): string {
  const key = process.env.BILLPLZ_API_KEY?.trim();
  if (!key) throw new Error("BILLPLZ_API_KEY is not set");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

/** Create a Billplz bill and return checkout URL. */
export async function createBillplzBill(
  input: BillplzBillInput,
): Promise<BillplzBill> {
  const body = new URLSearchParams({
    collection_id: input.collectionId,
    email: input.email,
    name: input.name,
    amount: String(input.amountCents),
    description: input.description,
    callback_url: input.callbackUrl,
  });
  if (input.redirectUrl) body.set("redirect_url", input.redirectUrl);
  if (input.reference1) body.set("reference_1", input.reference1);
  if (input.reference2) body.set("reference_2", input.reference2);

  const res = await fetch(`${apiBase()}/bills`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string"
        ? json.error
        : `Billplz bill create failed (${res.status})`,
    );
  }

  return {
    id: String(json.id),
    url: String(json.url),
    state: String(json.state ?? "due"),
    paid: json.paid === true || json.paid === "true",
    amount: Number(json.amount ?? input.amountCents),
  };
}

/**
 * Verify Billplz X-Signature callback payload.
 * @see https://www.billplz.com/api#x-signature
 */
export function verifyBillplzSignature(
  payload: Record<string, string>,
  signatureKey: string,
): boolean {
  const provided = payload.x_signature;
  if (!provided) return false;

  const entries = Object.entries(payload)
    .filter(([k]) => k !== "x_signature")
    .sort(([a], [b]) => a.localeCompare(b));

  const source = entries.map(([k, v]) => `${k}${v}`).join("|");
  const expected = createHmac("sha256", signatureKey).update(source).digest("hex");
  return expected === provided;
}

export function billplzCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is required for Billplz callbacks");
  return `${base}/api/webhooks/billplz`;
}
