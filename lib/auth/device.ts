export const SESSION_COOKIE_NAME = "bn_session_id";

export function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown browser";
  if (/iPhone|iPad/i.test(ua)) return "iPhone · Safari";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Mac · Chrome";
    if (/Safari/i.test(ua)) return "Mac · Safari";
    if (/Firefox/i.test(ua)) return "Mac · Firefox";
    return "Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Edg/i.test(ua)) return "Windows · Edge";
    if (/Chrome/i.test(ua)) return "Windows · Chrome";
    if (/Firefox/i.test(ua)) return "Windows · Firefox";
    return "Windows";
  }
  if (/Linux/i.test(ua)) return "Linux";
  return "Web browser";
}

export function parseClientIp(
  forwardedFor: string | null,
  realIp: string | null,
): string | null {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return realIp?.trim() || null;
}

/** Rough region label — full geo lookup can replace this later. */
export function locationFromIp(_ip: string | null): string {
  return "Malaysia";
}
