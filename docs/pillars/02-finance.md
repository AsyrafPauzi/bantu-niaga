# Module 2 — Finance

> Know the money without forcing the owner to become an accountant.

## 1. Purpose

Finance helps owners record income, expenses, invoices, and payments in a simple way. It should give confidence about cash movement while keeping advanced compliance and accountant-grade work as premium add-ons.

## 2. Target Users

- Solo entrepreneurs who need invoice and expense discipline.
- Micro SMEs that need clearer payment tracking.
- Growing SMEs that later need LHDN, SST, reconciliation, and accountant handoff.

## 3. Core Features

Core Finance should cover everyday money visibility:

- Income tracker.
- Expense tracker.
- Receipt upload.
- Basic revenue and expense ledger.
- Invoice generator.
- Secure invoice public link.
- Per-business invoice number.
- Payment status: draft, sent, unpaid, paid, overdue, void.
- DuitNow payment information panel.
- Quote-to-invoice conversion.
- Monthly income vs expense summary.
- WhatsApp-ready payment reminder text.

## 4. Add-on Features

Finance add-ons should carry compliance, deeper analytics, and automation:

- LHDN E-Invoice Connector.
- SST Advanced Reporting.
- Full Ledger Analytics.
- Cashflow Forecast.
- Profit and Margin Analytics.
- Auto Bank Reconciliation.
- Accountant Export Pack.
- Recurring Invoices.
- Payment Gateway Connector.
- Finance AI Assistant.

## 5. Key User Flows

### 5.1 Send an invoice

1. Owner creates an invoice.
2. Owner adds customer, line items, due date, and amount.
3. System creates invoice number and secure public link.
4. Owner shares the invoice through WhatsApp.
5. Owner marks the invoice paid when payment is confirmed.

### 5.2 Record an expense

1. Owner taps New Expense.
2. Owner uploads or snaps a receipt.
3. Owner enters amount, date, vendor, and category.
4. Expense appears in the ledger and monthly summary.

### 5.3 Chase an overdue payment

1. Invoice becomes overdue.
2. Owner opens the invoice.
3. System shows a ready-to-copy reminder message.
4. Owner reviews and sends the message through WhatsApp.

## 6. Data Notes

Core tables should cover transactions, receipts, invoices, invoice statuses, payment references, and customer links. Core should avoid irreversible deletion for financial records; voiding or reversing is safer.

Premium add-ons can extend the model with LHDN export states, reconciliation matches, recurring schedules, gateway webhook references, accountant export batches, and AI-generated insight records.
