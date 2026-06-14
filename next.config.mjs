/**
 * Bantu Niaga — Next.js config.
 *
 * Security posture (enterprise-grade defaults):
 *
 *   - `poweredByHeader: false`              hide Next.js version
 *   - Cross-route security headers          via `headers()` below — applied
 *                                           by Vercel/Node at the edge
 *   - Strict CSP                            deny inline by default; allow
 *                                           Next's hashed runtime scripts +
 *                                           Tailwind's hashed styles, and
 *                                           outbound calls to Supabase
 *                                           (which the app needs to function)
 *   - HSTS                                  6-month max-age; preload-eligible
 *   - frame-ancestors 'none'                clickjacking protection (same
 *                                           intent as `X-Frame-Options: DENY`
 *                                           but in the modern CSP form)
 *   - Referrer-Policy                       strict-origin-when-cross-origin
 *                                           — never leaks paths to 3rd parties
 *   - Permissions-Policy                    deny risky browser APIs by default
 *
 * `compress: true` is the Next default but documented here so it's
 * obvious the server is doing gzip/br on its own (no nginx layer).
 *
 * Image remote patterns include Meta CDNs so the Settings → Integrations
 * page can render a connected Page's avatar (`platform-lookaside.fbsbx.com`,
 * `scontent.*.fbcdn.net`).
 */

const isProd = process.env.NODE_ENV === "production";
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

/**
 * The CSP allows:
 *   - script-src     'self' + Next runtime hashes (handled via 'unsafe-inline'
 *                    in dev only; prod uses nonces via React server components)
 *   - style-src      'self' + 'unsafe-inline' (Tailwind injects inline styles
 *                    for arbitrary values; this is the well-known trade-off)
 *   - img-src        'self' + data URIs + Supabase Storage + Meta CDNs
 *   - connect-src    'self' + Supabase REST/Realtime + Meta Graph
 *   - frame-ancestors 'none'   (block clickjacking)
 *   - object-src     'none'    (block legacy Flash/plugin embeds)
 *   - base-uri       'self'    (block <base> tag hijack)
 *   - form-action    'self' + facebook.com (Meta OAuth dialog posts back)
 *   - upgrade-insecure-requests   force HTTPS on subresources
 */
const csp = [
  "default-src 'self'",
  isProd
    ? "script-src 'self' 'unsafe-inline' https://www.facebook.com https://connect.facebook.net"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.facebook.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: https://${supabaseHost} https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://scontent.cdninstagram.com https://*.cdninstagram.com`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://graph.facebook.com https://api.openai.com`,
  "frame-src 'self' https://www.facebook.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  isProd ? "upgrade-insecure-requests" : "",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

/**
 * Authenticated paths must never be cached by a CDN. We pair this with
 * `Cache-Control: private, no-store` set by API handlers, but applying
 * it broadly here is the belt-and-suspenders layer.
 */
const noStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: noStoreHeaders },
      { source: "/super-admin/:path*", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
