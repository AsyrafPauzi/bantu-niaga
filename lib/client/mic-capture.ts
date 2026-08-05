/** Browser mic helpers for Nadia voice input. Client-only — import from client components. */

export type MicAccessError =
  | "insecure_context"
  | "unsupported"
  | "denied"
  | "unavailable"
  | "unknown";

export function micErrorMessage(code: MicAccessError): string {
  switch (code) {
    case "insecure_context":
      return "Microphone needs a secure page. Open http://localhost:3000 (not the LAN IP) or use HTTPS.";
    case "unsupported":
      return "This browser does not support voice recording. Use Chrome or Safari, or type your question.";
    case "denied":
      return "Microphone blocked. Allow mic for this site in browser settings, then try again.";
    case "unavailable":
      return "No microphone found. Connect a mic or use text input.";
    default:
      return "Could not access the microphone. Use text input instead.";
  }
}

export function classifyMicError(err: unknown): MicAccessError {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "insecure_context";
  }
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "denied";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "unavailable";
    }
    if (err.name === "NotSupportedError" || err.name === "SecurityError") {
      return "insecure_context";
    }
  }
  return "unknown";
}

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export function isMicCaptureSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Call on a user gesture (e.g. opening Nadia) to prime mic permission. */
export async function acquireMicStream(): Promise<MediaStream> {
  if (!isMicCaptureSupported()) {
    throw Object.assign(new Error("unsupported"), { code: "unsupported" as const });
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

export function createMicRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickRecorderMimeType();
  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
}

export function recorderBlobType(recorder: MediaRecorder): string {
  return recorder.mimeType || pickRecorderMimeType() || "audio/webm";
}

export function stopMicStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
