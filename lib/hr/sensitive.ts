import "server-only";

import {
  decryptSecret,
  encryptSecret,
  encryptionConfigured,
  type SealedSecret,
} from "@/lib/integrations/crypto";

export function hrEncryptionReady(): boolean {
  return encryptionConfigured();
}

function sealField(value: string | null | undefined): SealedSecret | null {
  if (!value || value.trim() === "") return null;
  if (!encryptionConfigured()) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not configured. Cannot store sensitive HR fields.",
    );
  }
  return encryptSecret(value.trim());
}

function openField(sealed: SealedSecret | null | undefined): string | null {
  if (!sealed) return null;
  if (!encryptionConfigured()) return null;
  try {
    return decryptSecret(sealed);
  } catch {
    return null;
  }
}

export function maskSensitiveValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `****${trimmed.slice(-4)}`;
}

export interface SensitiveEmployeeFields {
  identity_number?: string | null;
  bank_account_no?: string | null;
  identity_number_sealed?: SealedSecret | null;
  bank_account_no_sealed?: SealedSecret | null;
}

/** Prepare DB payload: seal values and clear plaintext columns. */
export function sealEmployeeSensitiveFields(
  input: SensitiveEmployeeFields,
): {
  identity_number: null;
  bank_account_no: null;
  identity_number_sealed: SealedSecret | null;
  bank_account_no_sealed: SealedSecret | null;
} {
  const identitySealed =
    input.identity_number !== undefined
      ? sealField(input.identity_number)
      : (input.identity_number_sealed ?? null);

  const bankSealed =
    input.bank_account_no !== undefined
      ? sealField(input.bank_account_no)
      : (input.bank_account_no_sealed ?? null);

  return {
    identity_number: null,
    bank_account_no: null,
    identity_number_sealed: identitySealed,
    bank_account_no_sealed: bankSealed,
  };
}

/** Decrypt for detail views; falls back to legacy plaintext if present. */
export function hydrateEmployeeSensitiveFields(row: {
  identity_number?: string | null;
  bank_account_no?: string | null;
  identity_number_sealed?: SealedSecret | null;
  bank_account_no_sealed?: SealedSecret | null;
}): {
  identity_number: string | null;
  bank_account_no: string | null;
  identity_number_masked: string | null;
  bank_account_no_masked: string | null;
} {
  const identity =
    openField(row.identity_number_sealed as SealedSecret | null) ??
    row.identity_number ??
    null;
  const bank =
    openField(row.bank_account_no_sealed as SealedSecret | null) ??
    row.bank_account_no ??
    null;

  return {
    identity_number: identity,
    bank_account_no: bank,
    identity_number_masked: maskSensitiveValue(identity),
    bank_account_no_masked: maskSensitiveValue(bank),
  };
}
