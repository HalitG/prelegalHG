import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
