-- Expand system document templates for Malaysian SME back-office workflows.

insert into public.admin_document_templates (
  business_id, slug, title, category, body_text, sort_order
)
values
  (
    null,
    'payment-reminder',
    'Payment reminder (invoice)',
    'finance',
    E'Subject: Payment reminder — Invoice [INVOICE NO]\n\nDear [NAME],\n\nThis is a friendly reminder that invoice [INVOICE NO] for RM [AMOUNT] was due on [DUE DATE].\n\nIf you have already paid, please ignore this message. Otherwise, kindly arrange payment at your earliest convenience.\n\nThank you.\n\n[YOUR NAME]\n[BUSINESS NAME]',
    15
  ),
  (
    null,
    'quotation-cover',
    'Quotation cover letter',
    'finance',
    E'Date: [DATE]\n\nDear [NAME],\n\nPlease find our quotation for [PRODUCT/SERVICE] attached / below.\n\nQuotation ref: [QUOTE NO]\nValid until: [VALID UNTIL]\nTotal: RM [AMOUNT]\n\nLet us know if you have any questions — we are happy to adjust scope or payment terms.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    18
  ),
  (
    null,
    'refund-acknowledgement',
    'Refund acknowledgement',
    'finance',
    E'Date: [DATE]\n\nDear [NAME],\n\nWe confirm a refund of RM [AMOUNT] for [REASON / INVOICE NO].\n\nRefund method: [BANK TRANSFER / ORIGINAL PAYMENT METHOD]\nExpected within: [X] working days\n\nIf you do not receive it, contact us with this reference: [REF NO].\n\nThank you for your patience.\n\n[BUSINESS NAME]',
    22
  ),
  (
    null,
    'purchase-order',
    'Purchase order letter',
    'operations',
    E'PURCHASE ORDER\n\nDate: [DATE]\nPO ref: [PO NO]\n\nTo: [SUPPLIER NAME]\n\nPlease supply the following for [BUSINESS NAME]:\n\n1. [ITEM] — Qty [QTY] — RM [UNIT PRICE]\n2. [ITEM] — Qty [QTY] — RM [UNIT PRICE]\n\nDelivery address: [ADDRESS]\nRequired by: [DATE]\nPayment terms: [TERMS]\n\nPlease confirm acceptance and expected delivery date.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    25
  ),
  (
    null,
    'delivery-confirmation',
    'Delivery confirmation to customer',
    'operations',
    E'Subject: Your order is on the way — [ORDER NO]\n\nDear [NAME],\n\nGood news — your order [ORDER NO] has been dispatched.\n\nCourier: [COURIER]\nTracking: [TRACKING NO]\nExpected delivery: [DATE]\n\nIf anything arrives damaged or incomplete, reply to this message within 24 hours.\n\nThank you for choosing [BUSINESS NAME].',
    28
  ),
  (
    null,
    'stock-reorder',
    'Stock reorder request',
    'operations',
    E'Date: [DATE]\n\nTo: [SUPPLIER NAME]\n\nWe need to reorder the following items for [BUSINESS NAME]:\n\n- [PRODUCT] — current stock: [QTY] — reorder qty: [QTY]\n- [PRODUCT] — current stock: [QTY] — reorder qty: [QTY]\n\nPlease confirm availability, lead time, and updated pricing.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    32
  ),
  (
    null,
    'halal-renewal-reminder',
    'Halal certificate renewal reminder',
    'compliance',
    E'Subject: Halal certificate renewal — [PREMISES / PRODUCT LINE]\n\nDear [AUTHORITY / CONSULTANT NAME],\n\nOur halal certification for [BUSINESS NAME] expires on [DATE].\n\nCertificate ref: [REF NO]\nPremises: [ADDRESS]\n\nPlease advise documents required and inspection schedule to renew without lapse.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    35
  ),
  (
    null,
    'insurance-renewal-reminder',
    'Insurance policy renewal reminder',
    'compliance',
    E'Subject: Policy renewal — [POLICY TYPE]\n\nDear [INSURER / AGENT NAME],\n\nOur [POLICY TYPE] policy for [BUSINESS NAME] expires on [DATE].\n\nPolicy no: [POLICY NO]\nCover: [SUM INSURED / SCOPE]\n\nPlease send renewal quotation and any updated terms.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    38
  ),
  (
    null,
    'bomba-fire-cert-checklist',
    'Bomba / fire certificate checklist',
    'compliance',
    E'Fire certificate (Bomba) renewal checklist:\n\n1. Check expiry on current certificate\n2. Confirm premises layout unchanged (or note changes)\n3. Test fire extinguishers and alarm — record dates\n4. Book Bomba inspection / submit online application\n5. Pay applicable fees\n6. Upload new certificate to Admin → Storage → Licences\n7. Update compliance tracker expiry date',
    42
  ),
  (
    null,
    'sst-filing-reminder',
    'SST filing reminder (internal)',
    'compliance',
    E'SST filing reminder — [MONTH / QUARTER]\n\nBusiness: [BUSINESS NAME]\nSST no: [SST NO]\nFiling due: [DATE]\n\nChecklist:\n1. Reconcile sales and tax invoices in Finance\n2. Confirm exempt / zero-rated items documented\n3. File via MyTax / SST portal\n4. Save acknowledgement PDF to Admin → Storage → Finance\n5. Record payment if applicable',
    45
  ),
  (
    null,
    'epf-socso-monthly-checklist',
    'EPF & SOCSO monthly checklist',
    'compliance',
    E'Monthly statutory contributions — [MONTH YEAR]\n\nBusiness: [BUSINESS NAME]\n\nEPF (KWSP):\n- Submit i-Akaun / portal contribution by [DATE]\n- Verify employee list matches HR records\n- Save payment receipt to Storage\n\nSOCSO (PERKESO):\n- Submit ASSIST / portal by [DATE]\n- Check new hires and leavers updated in HR\n- Save receipt to Storage',
    48
  ),
  (
    null,
    'dbkl-permit-reminder',
    'Local council permit reminder',
    'compliance',
    E'Subject: Permit / licence renewal — [PERMIT TYPE]\n\nDear [LOCAL COUNCIL / OFFICER],\n\n[BUSINESS NAME] operates at [ADDRESS]. Our [PERMIT TYPE] expires on [DATE].\n\nReference: [REF NO]\n\nPlease advise renewal steps, fees, and documents required.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    52
  ),
  (
    null,
    'offer-letter-simple',
    'Offer letter (simple)',
    'hr',
    E'Date: [DATE]\n\nDear [CANDIDATE NAME],\n\n[BUSINESS NAME] is pleased to offer you the position of [JOB TITLE], reporting to [MANAGER NAME].\n\nStart date: [DATE]\nEmployment type: [FULL-TIME / PART-TIME / CONTRACT]\nBasic salary: RM [AMOUNT] per month\nProbation: [X] months\n\nPlease confirm acceptance by [DATE].\n\nWelcome to the team.\n\n[YOUR NAME]\n[BUSINESS NAME]',
    55
  ),
  (
    null,
    'warning-letter-simple',
    'Warning letter (simple)',
    'hr',
    E'Date: [DATE]\n\nPrivate & confidential\n\nTo: [EMPLOYEE NAME]\nPosition: [JOB TITLE]\n\nRe: [SUBJECT — e.g. attendance / conduct]\n\nThis letter serves as a [FIRST / FINAL] written warning regarding [ISSUE].\n\nOn [DATE], [brief factual description].\n\nExpected improvement: [ACTION REQUIRED]\nReview date: [DATE]\n\nPlease acknowledge receipt.\n\n[YOUR NAME]\n[BUSINESS NAME]',
    58
  ),
  (
    null,
    'leave-approval-notice',
    'Leave approval notice',
    'hr',
    E'Date: [DATE]\n\nTo: [EMPLOYEE NAME]\n\nYour leave request has been approved:\n\nType: [ANNUAL / MEDICAL / UNPAID]\nDates: [START DATE] to [END DATE]\nDays: [X]\n\nPlease hand over urgent tasks to [COLLEAGUE] before you leave.\n\nEnjoy your break.\n\n[YOUR NAME]\n[BUSINESS NAME]',
    62
  ),
  (
    null,
    'customer-apology',
    'Customer apology / service recovery',
    'general',
    E'Date: [DATE]\n\nDear [NAME],\n\nWe sincerely apologise for [ISSUE — delay, mistake, poor experience] on [DATE].\n\nWhat happened: [brief explanation]\nWhat we did: [fix / compensation / follow-up]\n\nWe value your trust and hope to serve you better. Contact us directly at [CONTACT] if you need anything else.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    65
  ),
  (
    null,
    'thank-you-customer',
    'Thank-you letter to customer',
    'general',
    E'Date: [DATE]\n\nDear [NAME],\n\nThank you for choosing [BUSINESS NAME] for [PRODUCT/SERVICE].\n\nWe hope everything met your expectations. If you were happy with our service, a short review or referral means a lot to a small business like ours.\n\nWe look forward to helping you again.\n\nWarm regards,\n[YOUR NAME]\n[BUSINESS NAME]',
    68
  ),
  (
    null,
    'business-intro-customer',
    'Business introduction to new customer',
    'general',
    E'Date: [DATE]\n\nDear [NAME],\n\nI am [YOUR NAME] from [BUSINESS NAME]. We help [TARGET CUSTOMERS] with [PRODUCT/SERVICE].\n\nWhy businesses work with us:\n- [BENEFIT 1]\n- [BENEFIT 2]\n- [BENEFIT 3]\n\nHappy to share our catalogue or arrange a short call. What is the best time to reach you?\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]\n[CONTACT]',
    72
  ),
  (
    null,
    'vendor-payment-request',
    'Vendor payment request (internal)',
    'finance',
    E'Payment request — [SUPPLIER NAME]\n\nDate: [DATE]\nRequested by: [YOUR NAME]\n\nInvoice no: [INVOICE NO]\nAmount: RM [AMOUNT]\nDue date: [DATE]\nPurpose: [DESCRIPTION]\n\nBank details:\nBank: [BANK]\nAccount name: [NAME]\nAccount no: [ACCOUNT NO]\n\nSupporting documents attached in Admin → Storage.',
    75
  )
on conflict (slug) where business_id is null do update set
  title = excluded.title,
  category = excluded.category,
  body_text = excluded.body_text,
  sort_order = excluded.sort_order;
