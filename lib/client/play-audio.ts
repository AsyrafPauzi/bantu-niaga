/** Decode base64 audio and play via a blob URL (works with CSP media-src blob:). */

export async function playBase64Audio(
  base64: string,
  contentType: string,
): Promise<{ ok: true } | { ok: false; reason: "decode" | "blocked" | "error" }> {
  let bytes: Uint8Array;
  try {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch {
    return { ok: false, reason: "decode" };
  }

  const type = contentType?.trim() || "audio/mpeg";
  const blob = new Blob([bytes.slice()], { type });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  const cleanup = () => URL.revokeObjectURL(url);
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });

  try {
    await audio.play();
    return { ok: true };
  } catch (e) {
    cleanup();
    if (e instanceof DOMException && e.name === "NotAllowedError") {
      return { ok: false, reason: "blocked" };
    }
    return { ok: false, reason: "error" };
  }
}

/** Prime autoplay after a user gesture (mic open, send, etc.). */
export function unlockBrowserAudio(): void {
  try {
    const audio = new Audio();
    audio.volume = 0.001;
    void audio.play().then(() => audio.pause()).catch(() => undefined);
  } catch {
    // ignore
  }
}
