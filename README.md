This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Running locally

```bash
npm run dev
```

Starts the app on http://localhost:3107 **and** the realtime gateway on ws://localhost:3108 that the browser extension uses for watch parties (it's restarted automatically if it exits). `npm run dev:next` starts the app alone.

## Sign-in setup

Email + password works out of the box: accounts are stored (scrypt-hashed) in `.data/users.json`, which is git-ignored. Swap `lib/auth/users.ts` for a real database before deploying.

**Google sign-in** needs an OAuth client:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → _Create credentials_ → _OAuth client ID_ → _Web application_.
2. Add `http://localhost:3107/api/auth/google/callback` under _Authorised redirect URIs_ (plus your production origin later).
3. Create `.env.local`:

```
REELROOM_SESSION_SECRET=any-long-random-string   # required in production
# APP_URL=https://your-domain.com                 # only if behind a proxy
# NEXT_PUBLIC_EXTENSION_STORE_URL=https://chromewebstore.google.com/detail/…   # once published
```

Restart `npm run dev`. The user's Google name and profile photo appear in the nav and profile drawer.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
