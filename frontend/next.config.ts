import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/** Where `npm run dev` sends /api requests: the backend, started with uvicorn in backend/. */
export const DEV_API_ORIGIN = "http://localhost:8000";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Build to static files in out/, which the FastAPI backend serves. Export mode can't be combined with
    // cacheComponents or partialPrefetching: both need a running Next.js server.
    output: "export",
    // Emit login/index.html rather than login.html: the backend serves directory indexes, not extensionless files.
    trailingSlash: true,
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
    // The built app is served by the backend, so /api is on the same origin. The dev server has no API of its own,
    // so it forwards /api to the backend. A static export can't have rewrites, so only the dev server gets them (it
    // still warns that they won't work with "output: export"; they do in dev). Because of trailingSlash, the dev
    // server first redirects /api/chat to /api/chat/ with a 308, which fetch follows, keeping the method and body.
    ...(phase === PHASE_DEVELOPMENT_SERVER && {
      rewrites: async () => [{ source: "/api/:path*", destination: `${DEV_API_ORIGIN}/api/:path*` }],
    }),
  };
}
