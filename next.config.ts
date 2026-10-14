import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
