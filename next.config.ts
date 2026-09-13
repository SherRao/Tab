import type { NextConfig } from "next";

// CSP deferred until CDN dependencies are self-hosted.
const securityHeaders = [
  // No `preload` — hard to reverse.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Stops URL tokens leaking via Referer cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera=() doesn't affect <input capture> file pickers.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: securityHeaders }]);
  },
};

export default nextConfig;
