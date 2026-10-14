import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets server code find project files (extension/, .data/) even when
  // `next dev` is started from another folder — see lib/server/paths.ts
  env: { REELROOM_PROJECT_DIR: __dirname },
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
