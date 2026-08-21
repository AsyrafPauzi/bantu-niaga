"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanBarcode, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface BarcodeScanModalProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

type ScanState =
  | "idle"
  | "requesting"
  | "scanning"
  | "denied";

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

/**
 * Camera-based barcode scanner modal.
 *
 * Detection strategy (most-capable first):
 *  1. Native BarcodeDetector API  — Chrome Android, Edge, Samsung Browser
 *  2. @zxing/browser              — iOS Chrome, Safari, Firefox, all others
 *
 * Both paths share the same <video> element and getUserMedia stream so the
 * camera permission prompt only fires once.
 */
export function BarcodeScanModal({ onDetected, onClose }: BarcodeScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const zxingStopRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<ScanState>("idle");
  const [manualCode, setManualCode] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingStopRef.current) {
      zxingStopRef.current();
      zxingStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  const startCamera = useCallback(async () => {
    setState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setState("denied");
      } else {
        // Camera hardware unavailable — fall back to manual entry only
        setState("idle");
      }
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play();
    }

    setState("scanning");

    /* ── Path 1: native BarcodeDetector (Chrome Android, Edge) ── */
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      nativeDetectorRef.current = new BarcodeDetector({
        formats: [
          "ean_13", "ean_8", "code_128", "code_39",
          "qr_code", "upc_a", "upc_e", "data_matrix", "itf",
        ],
      });

      function tick() {
        const vid = videoRef.current;
        const det = nativeDetectorRef.current;
        if (!vid || !det || vid.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        det.detect(vid)
          .then((results) => {
            if (results.length > 0) {
              const code = results[0].rawValue;
              setLastScanned(code);
              stopCamera();
              onDetected(code);
            } else {
              rafRef.current = requestAnimationFrame(tick);
            }
          })
          .catch(() => {
            rafRef.current = requestAnimationFrame(tick);
          });
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    /* ── Path 2: @zxing/browser (iOS Chrome, Safari, Firefox) ── */
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const vid = videoRef.current;
      if (!vid) return;

      // Attach stream we already opened — ZXing will read from it
      vid.srcObject = stream;

      const controls = await reader.decodeFromStream(stream, vid, (result, err) => {
        if (result) {
          const code = result.getText();
          setLastScanned(code);
          controls.stop();
          zxingStopRef.current = null;
          stopCamera();
          onDetected(code);
        }
        // err is normal when no barcode found in frame — ignore
        void err;
      });

      zxingStopRef.current = () => controls.stop();
    } catch {
      // ZXing failed to load or decode — camera still open for manual use
    }
  }, [onDetected, stopCamera]);

  // On mount: query Permissions API to decide initial state.
  //  - "granted" → auto-start (no popup needed)
  //  - "denied"  → show blocked instructions without calling getUserMedia
  //  - "prompt"  → stay idle so user tap triggers the popup via user gesture
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      return () => stopCamera();
    }
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((result) => {
        if (result.state === "granted") void startCamera();
        else if (result.state === "denied") setState("denied");
      })
      .catch(() => {
        // Permissions API unavailable for camera — stay idle
      });
    return () => stopCamera();
  }, []); // intentionally omit deps — runs once on mount

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    onDetected(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white shadow-xl dark:bg-panel-dark sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-bold text-ink dark:text-cream-100">
              Scan Barcode
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Idle — tap to trigger camera permission popup via user gesture */}
          {state === "idle" && (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-8 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
            >
              <ScanBarcode className="h-10 w-10 text-blue-500 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Tap to start camera
              </span>
              <span className="text-xs text-blue-500 dark:text-blue-400">
                Works on all browsers · iOS, Android, desktop
              </span>
            </button>
          )}

          {/* Camera viewfinder */}
          {(state === "requesting" || state === "scanning") && (
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
              />
              {state === "requesting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
              {state === "scanning" && (
                <>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative h-40 w-48">
                      <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-blue-400" />
                      <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-blue-400" />
                      <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-blue-400" />
                      <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-blue-400" />
                      <span className="animate-scan-line absolute left-1 right-1 h-px bg-blue-400/70" />
                    </div>
                  </div>
                  <p className="absolute bottom-2 left-0 right-0 text-center text-[11px] font-medium text-white/80">
                    Point camera at barcode
                  </p>
                </>
              )}
            </div>
          )}

          {/* Denied state */}
          {state === "denied" && (
            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/20">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Camera access blocked
              </p>
              <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-red-600 dark:text-red-400">
                <li>Tap the <strong>lock 🔒</strong> or <strong>camera 📷</strong> icon in the address bar</li>
                <li>Set <strong>Camera</strong> to <strong>Allow</strong></li>
                <li>Reload the page, then open the scanner again</li>
              </ol>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Reload page
                </button>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Manual entry fallback — always shown */}
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-500">
              Or enter barcode manually
            </p>
            <form onSubmit={submitManual} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Barcode number…"
                autoComplete="off"
                className="flex-1 rounded-xl border border-cream-200 px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className={cn(
                  "rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50",
                )}
              >
                Add
              </button>
            </form>
          </div>

          {lastScanned ? (
            <p className="mt-2 text-center text-xs text-emerald-600 dark:text-emerald-400">
              Scanned: {lastScanned}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
