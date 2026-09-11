import type { NextConfig } from "next";

// Baseline security headers applied to every response. A full
// Content-Security-Policy is intentionally left out for now: a strict
// nonce-based CSP needs middleware, and `script-src` cannot be locked to
// 'self' while receipt OCR still loads its worker/wasm from the jsdelivr CDN.
// CSP lands with the self-host-ocr-assets change (see openspec/changes).
const securityHeaders = [
  // Force HTTPS for two years. No `preload` — that is a hard-to-reverse commitment.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // No framing; blocks clickjacking. The app is never embedded.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Strip the path (and query) when navigating cross-origin, so tokens in a URL
  // are not leaked via Referer to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Opt out of powerful APIs the app does not use. Note: the receipt scanner's
  // <input capture> file picker does not use the camera permission, so
  // camera=() does not affect it.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: securityHeaders }]);
  },
};

export default nextConfig;
