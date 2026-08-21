"use client";

import { useEffect, useRef } from "react";

interface UseBarcodeScannterOptions {
  /**
   * Called when a barcode has been fully scanned.
   * @param code - The scanned barcode string.
   */
  onScan: (code: string) => void;
  /** Disable the scanner (e.g. when a modal/form is open). */
  disabled?: boolean;
  /**
   * Max milliseconds between keystrokes to be treated as scanner input.
   * Hardware scanners type very fast (< 30ms per char); humans are much slower.
   * Default: 50ms.
   */
  maxKeystrokeGapMs?: number;
  /**
   * Minimum barcode length to accept.
   * Default: 4.
   */
  minLength?: number;
}

/**
 * Detects USB/Bluetooth barcode scanner input.
 *
 * Barcode scanners act as keyboards — they type the barcode string very quickly
 * and then press Enter. This hook distinguishes scanner input from human typing
 * by measuring the gap between consecutive keystrokes.
 *
 * Safe to use alongside regular inputs: if the active element is an input,
 * textarea, or select, scanner detection is skipped to avoid double-processing.
 */
export function useBarcodeScanner({
  onScan,
  disabled = false,
  maxKeystrokeGapMs = 50,
  minLength = 4,
}: UseBarcodeScannterOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled) return;

    function flush() {
      const code = bufferRef.current.trim();
      bufferRef.current = "";
      if (code.length >= minLength) {
        onScan(code);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Skip when focus is inside an editable element — let the element handle it.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        flush();
        return;
      }

      // If gap since last keystroke is too large, this is not a scanner burst — reset.
      if (bufferRef.current.length > 0 && gap > maxKeystrokeGapMs) {
        bufferRef.current = "";
      }

      // Only accumulate printable single characters.
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Safety flush after 200ms idle (in case scanner doesn't send Enter).
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 200);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
      bufferRef.current = "";
    };
  }, [disabled, maxKeystrokeGapMs, minLength, onScan]);
}
