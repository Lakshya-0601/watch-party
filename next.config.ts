import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /api/extension/download zips extension/ from disk at runtime; ship it with
  // the deployment (serverless bundles only include files that are imported)
  outputFileTracingIncludes: {
    "/api/extension/download": ["./extension/**/*"],
  },
  // The flow starts at sign-in
  redirects() {
    return [{ source: "/", destination: "/auth", permanent: false }];
  },
  // Poster CDNs used by the mock catalogue (see lib/data/titles.ts)
  images: {
    remotePatterns: [
      new URL("https://static.tvmaze.com/uploads/images/**"),
      new URL("https://m.media-amazon.com/images/M/**"),
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
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
