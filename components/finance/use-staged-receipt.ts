"use client";

import { useCallback, useState } from "react";
import type { FinanceTransactionRow } from "@/lib/finance/schemas";

export function useStagedReceipt() {
  const [adminFileId, setAdminFileId] = useState<string | null>(null);
  const [adminFileName, setAdminFileName] = useState<string | null>(null);

  const clearReceipt = useCallback(() => {
    setAdminFileId(null);
    setAdminFileName(null);
  }, []);

  const loadReceiptFromRow = useCallback((row: FinanceTransactionRow) => {
    setAdminFileId(row.admin_file_id ?? null);
    setAdminFileName(row.admin_file_name ?? null);
  }, []);

  const stageReceipt = useCallback(async (fileId: string | null) => {
    if (!fileId) {
      clearReceipt();
      return;
    }
    setAdminFileId(fileId);
    try {
      const res = await fetch(
        "/api/admin/storage/picker?category=receipt&limit=100",
      );
      const json = (await res.json()) as {
        ok: boolean;
        data?: { files: { id: string; file_name: string }[] };
      };
      const name =
        json.data?.files?.find((f) => f.id === fileId)?.file_name ?? "Document";
      setAdminFileName(name);
    } catch {
      setAdminFileName("Document");
    }
  }, [clearReceipt]);

  return {
    adminFileId,
    adminFileName,
    stageReceipt,
    clearReceipt,
    loadReceiptFromRow,
  };
}
