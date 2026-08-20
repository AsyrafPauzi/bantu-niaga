"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { FollowUpWhatsAppSheet } from "@/components/marketing/FollowUpWhatsAppSheet";
import type { FollowUpReason } from "@/lib/marketing/follow-up-messages";
import { cn } from "@/lib/utils/cn";

export function CustomerWhatsAppButton({
  customerId,
  customerName,
  phoneE164,
  businessName,
  reason = "check_in",
  className,
  label = "WhatsApp",
}: {
  customerId: string;
  customerName: string;
  phoneE164: string | null;
  businessName?: string;
  reason?: FollowUpReason;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!phoneE164) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90",
          className,
        )}
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2} />
        {label}
      </button>
      <FollowUpWhatsAppSheet
        open={open}
        onClose={() => setOpen(false)}
        reason={reason}
        customerId={customerId}
        customerName={customerName}
        phoneE164={phoneE164}
        businessName={businessName}
      />
    </>
  );
}
