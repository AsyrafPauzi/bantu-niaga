import { describe, expect, it } from "vitest";
import { isFinanceActionTool } from "@/lib/ai/finance-assistant-tools";

describe("finance-assistant-tools", () => {
  it("classifies write tools as actions", () => {
    expect(isFinanceActionTool("log_income")).toBe(true);
    expect(isFinanceActionTool("log_expense")).toBe(true);
    expect(isFinanceActionTool("create_invoice")).toBe(true);
    expect(isFinanceActionTool("update_invoice_status")).toBe(true);
    expect(isFinanceActionTool("send_invoice_email")).toBe(true);
  });

  it("does not classify read tools as actions", () => {
    expect(isFinanceActionTool("get_finance_overview")).toBe(false);
    expect(isFinanceActionTool("list_invoices")).toBe(false);
    expect(isFinanceActionTool("draft_chase_message")).toBe(false);
    expect(isFinanceActionTool("unknown")).toBe(false);
  });
});
