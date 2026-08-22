import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /auth/callback — plain HTML + public script.
 *
 * Invite/magiclink redirects put tokens in the URL hash (invisible to the
 * server). A React page here was blank because this path is outside the
 * nonce middleware matcher and the static CSP blocked Next hydration.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signing you in · NiagaX</title>
  <style>
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px;
      font-family: system-ui, sans-serif;
      background: #faf8f5;
      color: #1c1917;
    }
    .spin {
      width: 28px;
      height: 28px;
      border: 3px solid #d6d3d1;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: bn-spin 0.8s linear infinite;
    }
    @keyframes bn-spin { to { transform: rotate(360deg); } }
    #auth-callback-status { margin: 0; font-size: 14px; color: #78716c; }
    #auth-callback-error {
      margin: 0;
      max-width: 420px;
      text-align: center;
      font-size: 15px;
      font-weight: 600;
    }
    #auth-callback-signin {
      color: #0f766e;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="spin" aria-hidden="true"></div>
  <p id="auth-callback-status">Signing you in…</p>
  <p id="auth-callback-error" hidden></p>
  <a id="auth-callback-signin" href="/sign-in" hidden>Back to sign in</a>
  <script src="/auth-callback.js"></script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Allow this page's own public script under the static CSP fallback.
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    },
  });
}
