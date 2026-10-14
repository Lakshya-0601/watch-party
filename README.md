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

## Firebase setup (sign-in + database)

Accounts use **Firebase Authentication** (email/password and Google) and each user's profile and preferences live in **Firestore** at `users/{uid}`. The browser signs in with Firebase, then trades the ID token for ReelRoom's own session cookie (30 days with "Remember me").

1. [Firebase console](https://console.firebase.google.com/) → **Add project**.
2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**. (`localhost` is an authorised domain by default; add your production domain later.)
3. **Firestore Database → Create database** (production mode), then paste `firestore.rules` into the **Rules** tab and publish — only the server touches Firestore.
4. **Project settings → Your apps → Web app (`</>`)**: register an app and copy its config.
5. **Project settings → Service accounts → Generate new private key**: download the JSON (keep it private, never commit it).
6. Put both in `.env.local` and restart `npm run dev`:

```bash
# Web app config (step 4) — not secret
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_APP_ID=1:…:web:…

# Service account (step 5) — secret
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-…@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
…
-----END PRIVATE KEY-----
"

REELROOM_SESSION_SECRET=any-long-random-string   # required in production
# NEXT_PUBLIC_EXTENSION_STORE_URL=https://chromewebstore.google.com/detail/…   # once published
```

**Local testing without a project:** run the Auth emulator (`npx firebase-tools emulators:start --only auth`) and set `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and a `demo-…` project id. If Firestore is unreachable, sign-in still works and preferences stay on the device.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy (Render)

Watch parties need an always-on server: rooms live in memory and the browser extension keeps a WebSocket open. Serverless hosts like Vercel can run the website but **not** parties, so the whole app is deployed as one Node service on Render:

1. [Render](https://dashboard.render.com/) → **New → Blueprint** → connect this GitHub repo. It reads `render.yaml`.
2. Fill in the Firebase values it asks for (same as `.env.local`). `REELROOM_SESSION_SECRET` / `REELROOM_TOKEN_SECRET` are generated for you.
3. When it's live (e.g. `https://reelroom.onrender.com`), add that domain in Firebase → **Authentication → Settings → Authorized domains**.
4. Install the extension **from the deployed site** ("Download the extension"): that copy is configured for it — invite links point at the site and live sync uses `wss://…/realtime`.

`npm start` runs `server.mjs`: Next.js plus the realtime gateway on one port. Render's free plan sleeps after ~15 minutes idle (the first visit then takes about a minute) and rooms reset when the service restarts.
