/**
 * Bantu Niaga — Next.js config.
 *
 * Security posture (enterprise-grade defaults):
 *
 *   - `poweredByHeader: false`              hide Next.js version
 *   - Cross-route security headers          via `headers()` below — applied
 *                                           by Vercel/Node at the edge
 *   - Strict CSP                            injected per-request by
 *                                           middleware.ts with a nonce
 *                                           (not a static header here —
 *                                           static CSP blanks public share pages)
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

// Content-Security-Policy is injected per-request by middleware.ts (nonce).
// Do NOT set a static CSP here — it applies to public share pages that skip
// auth middleware matchers and blocks Next.js inline scripts (blank page).
const securityHeaders = [
  {
    // 1-year HSTS — preload-eligible (https://hstspreload.org requires ≥1 year)
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Legacy XSS filter — modern browsers ignore it but scanners still check for it.
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Suppress the Server header where the platform allows header override.
  { key: "Server", value: "" },
];

/**
 * Authenticated paths must never be cached by a CDN. We pair this with
 * `Cache-Control: private, no-store` set by API handlers, but applying
 * it broadly here is the belt-and-suspenders layer.
 */
const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
];

/**
 * Next.js content-hashes every chunk name under /_next/static/ so these
 * assets are safe to cache for a full year (immutable). This dramatically
 * improves repeat-visit LCP / TTFB by letting the browser and CDN serve
 * JS/CSS without a round-trip.
 *
 * The `Vary: Accept-Encoding` header is required so Vercel's edge cache
 * stores separate gzip / br variants and serves the right one.
 */
const immutableStaticHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  },
  { key: "Vary", value: "Accept-Encoding" },
];

/**
 * Public images uploaded by users (avatars, product thumbnails) live in
 * Supabase Storage and are proxied through Next Image. A 24-hour TTL is
 * a reasonable balance between freshness and CDN offload.
 */
const publicImageHeaders = [
  { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" },
  { key: "Vary", value: "Accept" },
];

/**
 * Prevent search engines from indexing internal admin / super-admin pages
 * even if they somehow obtain the URL.
 */
const noIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
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
    // 24 h TTL. Next Image content-addresses its output so stale-on-update
    // is not a risk — old URLs simply stop being requested naturally.
    minimumCacheTTL: 86400,
    // Limit the set of sizes generated to avoid combinatorial cache bloat.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256],
  },
  // Reduce bundle size by tree-shaking server-only packages from the client
  // bundle. Next.js 15 does this automatically but this makes the intent explicit.
  serverExternalPackages: [],
  async redirects() {
    return [
      // Serve security.txt from its canonical /.well-known/ location.
      {
        source: "/security.txt",
        destination: "/.well-known/security.txt",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // Global security headers on every response.
      { source: "/:path*", headers: securityHeaders },
      // Authenticated app-shell HTML pages — never cache.
      {
        source:
          "/(sign-in|sign-up|home|finance|operations|sales|hr|marketing|marketplace|settings|boardroom|add-company|more|onboarding|legal|verify-email)/:path*",
        headers: noStoreHeaders,
      },
      // API routes — never cache.
      { source: "/api/:path*", headers: noStoreHeaders },
      { source: "/super-admin/:path*", headers: [...noStoreHeaders, ...noIndexHeaders] },
      { source: "/admin/:path*", headers: noIndexHeaders },
      // Static chunks are content-hashed — cache forever.
      { source: "/_next/static/:path*", headers: immutableStaticHeaders },
      // Next Image optimised output.
      { source: "/_next/image", headers: publicImageHeaders },
    ];
  },
};

export default nextConfig;
