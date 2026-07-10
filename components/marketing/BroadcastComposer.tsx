"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Tag,
  User,
  UserCircle,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { buildCtcUrl, renderTemplate } from "@/lib/marketing/broadcasts-shared";
import {
  BROADCAST_MESSAGE_TEMPLATES,
  type BroadcastMessageTemplate,
} from "@/lib/marketing/broadcast-templates";

/**
 * 4-step broadcast composer.
 *
 *   1. Channel (whatsapp_ctc | email)
 *   2. Segment dropdown with debounced "≈ N members" preview
 *   3. Template editor (subject + placeholders + optional coupon)
 *   4. Preview + Save draft / Send now
 *
 * The wizard talks to:
 *   GET  /api/marketing/segments            — segment list
 *   GET  /api/marketing/segments/[id]/members?limit=3 — for preview
 *   GET  /api/marketing/coupons             — optional coupon list
 *                                             (404 → gracefully skip)
 *   POST /api/marketing/broadcasts          — create draft
 *   POST /api/marketing/broadcasts/[id]/send — send now
 */

type Channel = "whatsapp_ctc" | "email";

interface SegmentRow {
  id: string;
  name: string;
  kind: "auto" | "custom";
  member_count: number;
}

interface CouponRow {
  id: string;
  code: string;
  status?: string;
}

interface MemberSample {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
}

const PLACEHOLDER_CHIPS: { token: string; label: string; icon: typeof User }[] = [
  { token: "{name}", label: "Full name", icon: User },
  { token: "{first_name}", label: "First name", icon: UserCircle },
  { token: "{coupon_code}", label: "Coupon code", icon: Tag },
];

export function BroadcastComposer() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<Channel>("whatsapp_ctc");
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [template, setTemplate] = useState("");
  const [couponId, setCouponId] = useState<string>("");

  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [couponsAvailable, setCouponsAvailable] = useState(true);

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [memberCountLoading, setMemberCountLoading] = useState(false);
  const [sampleMembers, setSampleMembers] = useState<MemberSample[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Fetch segments + coupons up-front ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSegmentsLoading(true);
      try {
        const res = await fetch("/api/marketing/segments");
        if (!res.ok) throw new Error(`segments returned ${res.status}`);
        const body = (await res.json()) as { data: SegmentRow[] };
        if (!cancelled) setSegments(body.data ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "failed to load segments");
        }
      } finally {
        if (!cancelled) setSegmentsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/marketing/coupons");
        if (res.status === 404) {
          if (!cancelled) setCouponsAvailable(false);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setCouponsAvailable(false);
          return;
        }
        const body = (await res.json()) as { data?: CouponRow[] };
        if (!cancelled) setCoupons(body.data ?? []);
      } catch {
        if (!cancelled) setCouponsAvailable(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Debounced member-count + sample fetch for the chosen segment ────
  useEffect(() => {
    if (!segmentId) {
      setMemberCount(null);
      setSampleMembers([]);
      return;
    }
    let cancelled = false;
    setMemberCountLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/marketing/segments/${segmentId}/members?limit=3`,
        );
        if (!res.ok) throw new Error(`members returned ${res.status}`);
        const body = (await res.json()) as {
          data: MemberSample[];
        };
        if (!cancelled) {
          setSampleMembers(body.data ?? []);
        }
        // Pull the cached count from the segment list too.
        const seg = segments.find((s) => s.id === segmentId);
        if (seg && !cancelled) setMemberCount(seg.member_count);
        // Sharpen the count via the detail endpoint (it recomputes
        // on read).
        try {
          const detailRes = await fetch(
            `/api/marketing/segments/${segmentId}`,
          );
          if (detailRes.ok) {
            const detail = (await detailRes.json()) as {
              data: { member_count: number };
            };
            if (!cancelled) setMemberCount(detail.data.member_count);
          }
        } catch {
          // fall back to cached count
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "preview failed");
        }
      } finally {
        if (!cancelled) setMemberCountLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [segmentId, segments]);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === segmentId) ?? null,
    [segments, segmentId],
  );
  const selectedCoupon = useMemo(
    () => coupons.find((c) => c.id === couponId) ?? null,
    [coupons, couponId],
  );

  function insertPlaceholder(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setTemplate((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    // restore caret right after the inserted token
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function nextStep() {
    setError(null);
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!segmentId) {
        setError("Pick a segment first.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!template.trim()) {
        setError("Write a message first.");
        return;
      }
      if (channel === "email" && !subject.trim()) {
        setError("Email subject is required.");
        return;
      }
      setStep(4);
      return;
    }
  }
  function prevStep() {
    setError(null);
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  }

  async function createDraft(): Promise<string> {
    if (!name.trim()) {
      throw new Error("Give this broadcast a name first.");
    }
    if (!segmentId) throw new Error("Pick a segment.");
    if (!template.trim()) throw new Error("Write a message.");

    const res = await fetch("/api/marketing/broadcasts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        channel,
        segment_id: segmentId,
        subject: channel === "email" ? subject.trim() : undefined,
        message_template: template,
        coupon_id: couponId || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        body.message ?? body.error ?? `create failed (${res.status})`,
      );
    }
    return body.data.id as string;
  }

  const onSaveDraft = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createDraft();
      router.push(`/marketing/broadcasts/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
    // we use a refs-free closure deliberately so the latest form values flow in
  }, [busy, channel, couponId, name, router, segmentId, subject, template]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSendNow = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createDraft();
      const res = await fetch(`/api/marketing/broadcasts/${id}/send`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.message ?? body.error ?? `send failed (${res.status})`,
        );
      }
      router.push(`/marketing/broadcasts/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "send failed");
    } finally {
      setBusy(false);
    }
  }, [busy, channel, couponId, name, router, segmentId, subject, template]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewRendered = useMemo(() => {
    if (sampleMembers.length === 0) return [] as { name: string; text: string }[];
    return sampleMembers.slice(0, 3).map((m) => ({
      name: m.name,
      text: renderTemplate(
        template,
        { name: m.name },
        selectedCoupon ? { code: selectedCoupon.code } : null,
      ),
    }));
  }, [sampleMembers, template, selectedCoupon]);

  return (
    <Card>
      <CardBody className="space-y-6">
        <StepHeader step={step} />

        {step === 1 ? (
          <Step1Channel
            channel={channel}
            onChannelChange={setChannel}
            name={name}
            onNameChange={setName}
          />
        ) : null}

        {step === 2 ? (
          <Step2Segment
            segments={segments}
            segmentsLoading={segmentsLoading}
            segmentId={segmentId}
            onSegmentChange={setSegmentId}
            memberCount={memberCount}
            memberCountLoading={memberCountLoading}
          />
        ) : null}

        {step === 3 ? (
          <Step3Template
            channel={channel}
            subject={subject}
            onSubjectChange={setSubject}
            template={template}
            onTemplateChange={setTemplate}
            insertPlaceholder={insertPlaceholder}
            applyPreset={(preset) => {
              setTemplate(preset.body);
              if (preset.subject) setSubject(preset.subject);
            }}
            textareaRef={textareaRef}
            coupons={coupons}
            couponsAvailable={couponsAvailable}
            couponId={couponId}
            onCouponChange={setCouponId}
          />
        ) : null}

        {step === 4 ? (
          <Step4Preview
            channel={channel}
            name={name}
            segmentName={selectedSegment?.name ?? ""}
            subject={subject}
            previewRendered={previewRendered}
            memberCount={memberCount}
            sampleMembers={sampleMembers}
            selectedCoupon={selectedCoupon}
          />
        ) : null}

        {error ? (
          <p className="rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
          <button
            type="button"
            disabled={step === 1 || busy}
            onClick={prevStep}
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={busy}
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700 disabled:opacity-60"
            >
              Next
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onSaveDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2.25} />
                )}
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSendNow}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={2.25} />
                )}
                Send now
              </button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step rendering helpers
// ─────────────────────────────────────────────────────────────────────────

function StepHeader({ step }: { step: 1 | 2 | 3 | 4 }) {
  const titles = ["Channel", "Segment", "Message", "Preview"] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {titles.map((t, idx) => {
        const n = (idx + 1) as 1 | 2 | 3 | 4;
        const active = n === step;
        const done = n < step;
        return (
          <div key={t} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                done
                  ? "bg-brand-500 text-white"
                  : active
                    ? "bg-accent-500 text-white"
                    : "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                active
                  ? "text-ink dark:text-cream-100"
                  : "text-ink-muted dark:text-cream-400",
              )}
            >
              {t}
            </span>
            {idx < titles.length - 1 ? (
              <span className="mx-2 text-ink-muted dark:text-cream-400">·</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Step1Channel({
  channel,
  onChannelChange,
  name,
  onNameChange,
}: {
  channel: Channel;
  onChannelChange: (c: Channel) => void;
  name: string;
  onNameChange: (s: string) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-ink dark:text-cream-100">
          Internal name <span className="text-status-danger">*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Raya VIP push"
          maxLength={120}
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <span className="block text-xs text-ink-muted dark:text-cream-400">
          Only you see this. Recipients see the rendered message body.
        </span>
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChannelTile
          active={channel === "whatsapp_ctc"}
          onClick={() => onChannelChange("whatsapp_ctc")}
          icon={MessageCircle}
          title="WhatsApp (click-to-chat)"
          body="Open prefilled wa.me links one-by-one from your phone. No Meta API required."
        />
        <ChannelTile
          active={channel === "email"}
          onClick={() => onChannelChange("email")}
          icon={Mail}
          title="Email (Resend)"
          body="Server-sent via Resend. Needs RESEND_API_KEY + MARKETING_FROM_EMAIL set."
        />
      </div>
    </div>
  );
}

function ChannelTile({
  active,
  onClick,
  icon: Icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageCircle;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left shadow-card transition-colors",
        active
          ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/30"
          : "border-cream-300 bg-white hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:hover:bg-hairline-dark/40",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-brand-500 text-white"
            : "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-300",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          {title}
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">{body}</p>
      </div>
    </button>
  );
}

function Step2Segment({
  segments,
  segmentsLoading,
  segmentId,
  onSegmentChange,
  memberCount,
  memberCountLoading,
}: {
  segments: SegmentRow[];
  segmentsLoading: boolean;
  segmentId: string;
  onSegmentChange: (id: string) => void;
  memberCount: number | null;
  memberCountLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-ink dark:text-cream-100">
          Segment <span className="text-status-danger">*</span>
        </span>
        <select
          value={segmentId}
          onChange={(e) => onSegmentChange(e.target.value)}
          disabled={segmentsLoading}
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        >
          <option value="">— pick a saved segment —</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kind === "auto" ? "Auto · " : "Custom · "}
              {s.name} ({s.member_count})
            </option>
          ))}
        </select>
      </label>
      {segmentId ? (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-200">
          {memberCountLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
              Counting members…
            </span>
          ) : memberCount === null ? (
            "Computing matches…"
          ) : (
            `≈ ${memberCount.toLocaleString()} customer${memberCount === 1 ? "" : "s"} match this segment`
          )}
        </div>
      ) : null}
    </div>
  );
}

function Step3Template({
  channel,
  subject,
  onSubjectChange,
  template,
  onTemplateChange,
  insertPlaceholder,
  applyPreset,
  textareaRef,
  coupons,
  couponsAvailable,
  couponId,
  onCouponChange,
}: {
  channel: Channel;
  subject: string;
  onSubjectChange: (s: string) => void;
  template: string;
  onTemplateChange: (s: string) => void;
  insertPlaceholder: (token: string) => void;
  applyPreset: (preset: BroadcastMessageTemplate) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  coupons: CouponRow[];
  couponsAvailable: boolean;
  couponId: string;
  onCouponChange: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-ink dark:text-cream-100">
          Ready templates (BM / EN)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {BROADCAST_MESSAGE_TEMPLATES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-cream-300 bg-cream-50 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              {preset.chip}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Tap a template to fill the message. Edit freely after.
        </p>
      </div>

      {channel === "email" ? (
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold text-ink dark:text-cream-100">
            Subject <span className="text-status-danger">*</span>
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="e.g. {first_name}, here's 10% off this week"
            maxLength={200}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </label>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="block text-sm font-semibold text-ink dark:text-cream-100">
            Message <span className="text-status-danger">*</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDER_CHIPS.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insertPlaceholder(p.token)}
                className="inline-flex items-center gap-1 rounded-md border border-cream-300 bg-white px-2 py-1 text-xs font-medium text-ink-muted shadow-sm hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300"
              >
                <p.icon className="h-3 w-3" strokeWidth={2.25} />
                {p.token}
              </button>
            ))}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={template}
          onChange={(e) => onTemplateChange(e.target.value)}
          rows={10}
          maxLength={4000}
          placeholder={
            channel === "whatsapp_ctc"
              ? "Hi {first_name}, this weekend only — show this WhatsApp to claim {coupon_code}."
              : "Hi {first_name},\n\nWe're rolling out a fresh batch this week — use {coupon_code} at checkout."
          }
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <span className="block text-xs text-ink-muted dark:text-cream-400">
          Click a chip above to insert a placeholder. Missing fields render as
          empty strings.
        </span>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-ink dark:text-cream-100">
          Attach coupon (optional)
        </span>
        {couponsAvailable ? (
          coupons.length === 0 ? (
            <p className="rounded-md bg-cream-100 px-3 py-2 text-xs text-ink-muted dark:bg-hairline-dark/40 dark:text-cream-400">
              No active coupons yet. Create one in{" "}
              <code className="font-mono">/marketing/coupons</code> and refresh.
            </p>
          ) : (
            <select
              value={couponId}
              onChange={(e) => onCouponChange(e.target.value)}
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <option value="">— none —</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          )
        ) : (
          <p className="rounded-md bg-cream-100 px-3 py-2 text-xs text-ink-muted dark:bg-hairline-dark/40 dark:text-cream-400">
            Coupons surface not available yet — wire {`{coupon_code}`} once the
            coupons API is live.
          </p>
        )}
      </label>
    </div>
  );
}

function Step4Preview({
  channel,
  name,
  segmentName,
  subject,
  previewRendered,
  memberCount,
  sampleMembers,
  selectedCoupon,
}: {
  channel: Channel;
  name: string;
  segmentName: string;
  subject: string;
  previewRendered: { name: string; text: string }[];
  memberCount: number | null;
  sampleMembers: MemberSample[];
  selectedCoupon: CouponRow | null;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Channel" value={channel === "whatsapp_ctc" ? "WhatsApp" : "Email"} />
        <Tile label="Segment" value={segmentName || "—"} />
        <Tile
          label="Recipients"
          value={memberCount === null ? "—" : memberCount.toLocaleString()}
        />
      </div>
      {name ? (
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Internal name: <span className="font-mono">{name}</span>
          {selectedCoupon ? (
            <>
              {" · coupon "}
              <span className="font-mono">{selectedCoupon.code}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink dark:text-cream-100">
          Sample renders (first 3 members)
        </p>
        {previewRendered.length === 0 ? (
          <p className="rounded-md bg-cream-100 px-3 py-2 text-xs text-ink-muted dark:bg-hairline-dark/40 dark:text-cream-400">
            No members to preview yet. Pick a segment with at least one
            customer.
          </p>
        ) : (
          <ul className="space-y-2">
            {previewRendered.map((row, i) => (
              <li
                key={`${row.name}-${i}`}
                className="rounded-lg border border-cream-200 bg-cream-50/40 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                  To: {row.name}
                </p>
                {channel === "email" && subject ? (
                  <p className="mt-1 text-sm font-semibold text-ink dark:text-cream-100">
                    Subject: {subject}
                  </p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink dark:text-cream-100">
                  {row.text || "(empty)"}
                </p>
                {channel === "whatsapp_ctc" && sampleMembers[i]?.phone_e164 ? (
                  <p className="mt-2 break-all text-[11px] font-mono text-ink-muted dark:text-cream-400">
                    wa_url:{" "}
                    {buildCtcUrl(
                      sampleMembers[i].phone_e164 ?? "",
                      row.text,
                    )}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cream-200 bg-cream-50/40 p-3 dark:border-hairline-dark dark:bg-hairline-dark/20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink dark:text-cream-100">
        {value}
      </p>
    </div>
  );
}
