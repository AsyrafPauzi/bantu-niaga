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
  | "unsupported"
  | "denied";

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

/**
 * Camera-based barcode scanner modal.
 * Uses the native BarcodeDetector Web API (Chrome/Edge/Android).
 * Falls back to a manual text-entry input on unsupported browsers (Safari/iOS).
 */
export function BarcodeScanModal({ onDetected, onClose }: BarcodeScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [manualCode, setManualCode] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
    // Check BarcodeDetector support
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setState("unsupported");
      return;
    }

    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "qr_code",
          "upc_a",
          "upc_e",
          "data_matrix",
          "itf",
        ],
      });

      setState("scanning");

      function tick() {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        detector
          .detect(video)
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
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setState("denied");
      } else {
        setState("unsupported");
      }
    }
  }, [onDetected, stopCamera]);

  // Do NOT auto-start the camera on mount.
  // Browsers only show the permission prompt when getUserMedia is called from a
  // direct user gesture (click). Calling it from useEffect is treated as a
  // background request and the browser silently denies it without showing the
  // allow/deny popup. We start in "idle" and let the user click to begin.
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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
          {/* Idle — prompt user to tap so getUserMedia runs from a real user gesture */}
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
                Your browser will ask for camera permission
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
                  {/* Targeting overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative h-40 w-48">
                      {/* Corner brackets */}
                      <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-blue-400" />
                      <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-blue-400" />
                      <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-blue-400" />
                      <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-blue-400" />
                      {/* Scan line animation */}
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
            <div className="rounded-xl bg-red-50 p-4 text-center dark:bg-red-950/20">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Camera access denied
              </p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Click the camera/lock icon in your browser address bar and allow
                camera access, then tap the button below.
              </p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* Unsupported state */}
          {state === "unsupported" && (
            <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Camera scanning not supported
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                Use Chrome or Edge for camera scanning.
              </p>
            </div>
          )}

          {/* Manual entry fallback — always shown below camera */}
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
