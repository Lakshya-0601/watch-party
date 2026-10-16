<div align="center">

# 🎬 ReelRoom

**Movie night, together, even when you're apart.**

Watch Netflix, JioHotstar, Prime Video, Apple TV+ and Crunchyroll in perfect sync with your friends: shared play, pause, seek and speed, plus live chat and emoji reactions right on the streaming page.

### 👉 [reelroom-vz4n.onrender.com](https://reelroom-vz4n.onrender.com)

</div>

---

## Contents

- [What is ReelRoom?](#what-is-reelroom)
- [Quick start](#quick-start-5-minutes)
- [Features](#features)
- [How to use ReelRoom](#how-to-use-reelroom)
  - [1. Create your account](#1-create-your-account)
  - [2. Set up your profile](#2-set-up-your-profile)
  - [3. Install the browser extension](#3-install-the-browser-extension)
  - [4. Find something to watch](#4-find-something-to-watch)
  - [5. Start a watch party (host)](#5-start-a-watch-party-host)
  - [6. Join a watch party (guest)](#6-join-a-watch-party-guest)
  - [7. Inside the party](#7-inside-the-party)
- [Host controls](#host-controls)
- [Precautions & good to know](#precautions--good-to-know)
- [Privacy & permissions](#privacy--permissions)
- [Troubleshooting](#troubleshooting)
- [For developers](#for-developers)

---

## What is ReelRoom?

ReelRoom is a web app plus a Chrome extension that turns any movie or show on **Netflix, JioHotstar, Prime Video, Apple TV+ or Crunchyroll** into a watch party.

- **Everyone watches on their own account.** ReelRoom never streams, records or shares video. It only keeps everyone's players at the same moment.
- **The host is in charge.** The person who starts the party lets guests in and decides who may pause or skip.
- **It all happens on the streaming page.** A small ReelRoom panel slides in beside the video with the chat, the people in the room and the party controls.

The website at **[reelroom-vz4n.onrender.com](https://reelroom-vz4n.onrender.com)** is where you sign in, discover titles, download the extension and share invite links.

---

## Quick start (5 minutes)

1. Open **[reelroom-vz4n.onrender.com](https://reelroom-vz4n.onrender.com)** in **Google Chrome** (or Microsoft Edge) on a computer, and sign in.
2. Pick your streaming services and favourite genres.
3. Click **Download the extension**, unzip it and load it in `chrome://extensions` ([step-by-step below](#3-install-the-browser-extension)).
4. **Host:** open a title on Netflix, JioHotstar, Prime Video, Apple TV+ or Crunchyroll, click the ReelRoom button on the page, choose **Start a party** and send the invite link to your friends.
5. **Guests:** open the invite link (or type the room code into the ReelRoom panel). The host admits you, and your player jumps to the same moment.

> Every guest needs **their own** ReelRoom account, the extension, and **their own subscription** to the streaming service.

---

## Features

|                             |                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔄 **Synced playback**      | Play, pause, seek and playback speed stay in sync for everyone, usually within a fraction of a second. Small drifts are corrected smoothly without jarring jumps. |
| 📺 **5 streaming services** | Netflix, JioHotstar, Prime Video, Apple TV+ and Crunchyroll: browse titles from all of them and host watch parties on any of them. |
| 🎟️ **Host approval**        | Guests "knock" and the host admits or declines them. Up to **15 people** per party.                                                                               |
| 🎮 **Playback control**     | By default only the host controls playback. Guests can **request control**, and the host can grant or revoke it at any time.                                      |
| 💬 **Live chat**            | Messages up to 50 characters, with an emoji picker. Optional one-second popups at the bottom of the screen show new messages while you watch.                     |
| 😂 **Reactions**            | One-tap emoji reactions float across everyone's screen.                                                                                                           |
| ⏱️ **Message gap**          | The host chooses how long guests wait between messages: off, or anywhere from 1 to 30 seconds.                                                                    |
| 🔇 **Moderation**           | The host can mute the whole chat, mute one person, or remove someone.                                                                                             |
| 📢 **Ad-break handling**    | If one person's plan has ads, the ad plays only for them. The party keeps going, and when the ad ends they jump straight back to where everyone is.               |
| ⏭️ **Next episode**         | When the host moves to another title or episode on the same service, the party follows.                                                                           |
| 🔗 **Invite links & codes** | Share a link like `reelroom-vz4n.onrender.com/room/abc-234-xyz`, or just the code `abc-234-xyz`.                                                                  |
| 🍿 **Discover**             | Browse titles across your services, filter by genre or mood, and see an audience sentiment score for each title.                                                  |
| 👤 **Accounts**             | Sign in with Google or email and password, with "Remember me" and password reset.                                                                                 |

---

## How to use ReelRoom

### 1. Create your account

1. Go to **[reelroom-vz4n.onrender.com](https://reelroom-vz4n.onrender.com)**.
2. Choose **Continue with Google**, or enter an email and password. An account is created automatically the first time you sign in with an email.
3. Tick **Remember me** to stay signed in for 30 days on this device. Leave it unticked on a shared computer.
4. Forgot your password? Use **Forgot password** on the sign-in page to get a reset email.

> ⏳ The site is on a free hosting plan. If nobody has used it for a while, **the first visit can take up to a minute to load.** Just wait, and it will be quick after that.

### 2. Set up your profile

The first time you sign in, a short three-step setup asks for:

1. **Your streaming services.** These decide which titles appear first on the Discover page.
2. **Genres you enjoy.** These help sort recommendations.
3. **The browser extension**, which you need for watch parties (see the next step).

You can change your choices later from your profile (click your avatar in the top-right corner).

### 3. Install the browser extension

Watch parties run through the ReelRoom extension. It isn't on the Chrome Web Store yet, so you install it manually. This takes about a minute.

1. On the ReelRoom website, click **Download the extension**. You'll get `reelroom-extension.zip`.
2. **Unzip** it, for example by right-clicking and choosing **Extract All**. You'll get a folder called `reelroom-extension`.
3. Open **`chrome://extensions`** in a new tab (for Edge, `edge://extensions`).
4. Turn on **Developer mode** (the switch in the top-right corner).
5. Click **Load unpacked** and select the **`reelroom-extension`** folder, the one that contains `manifest.json`.
6. Optionally, click the 🧩 puzzle icon in Chrome's toolbar and **pin** ReelRoom so it's always visible.
7. Go back to the ReelRoom website and refresh. It should now say the extension is installed. The extension signs in with your ReelRoom account automatically.

> ⚠️ **Don't delete or move the unzipped folder.** Chrome loads the extension from it, and removing the folder removes the extension.

**Updating the extension:** when a new version comes out, the website shows an **"Update available"** notice. Download the zip again, replace the old folder's contents with the new ones, then click the **↻ reload** icon on the ReelRoom card in `chrome://extensions`. Refresh any open streaming tabs afterwards. Everyone in a party should use the latest version.

### 4. Find something to watch

The **Discover** page shows titles from your services. You can:

- **Search** and filter by type (movie or series), genre, or "my services only".
- Pick a **mood** (Cozy & Relaxed, Mind-Blowing Plot Twist, Laugh Out Loud…) for quick suggestions.
- Open a title to see its details and **audience sentiment score**.
- Click **Watch together** to start a party for that title.

### 5. Start a watch party (host)

**From the website:**

1. Click **Watch together** on a title, or **+ Create Watch Room** in the top bar.
2. Choose the service (Netflix, JioHotstar, Prime Video, Apple TV+ or Crunchyroll). ReelRoom opens the title there in a new tab.
3. Follow the steps in the window: press play on the streaming site, then start the party from the ReelRoom panel.

**Directly on the streaming site:**

1. Open the movie or episode on Netflix, JioHotstar, Prime Video, Apple TV+ or Crunchyroll and start playing it.
2. Click the **ReelRoom ▶ button** on the edge of the page, or the ReelRoom icon in Chrome's toolbar.
3. Click **Start a party**.
4. Click the **Room abc-234-xyz ⧉** chip in the chat to **copy the invite link**, and send it to your friends on WhatsApp, Discord or anywhere else.

When friends knock, you'll see **"Kai wants to join"**. Click **Admit** or **Deny**.

### 6. Join a watch party (guest)

Before you join, make sure you have a ReelRoom account, the extension installed, and your own subscription to the service the party is using.

**With an invite link:**

1. Open the link in Chrome.
2. Click **Join with the ReelRoom extension**.
3. Open the title on the streaming service. The page shows a button for this.
4. Wait for the host to admit you. Your player then jumps to the party's current moment automatically.

**With a room code:**

1. Open the title on the streaming site and click the **ReelRoom ▶ button**.
2. Under **"or join a party"**, type the code (like `abc-234-xyz`) or paste the invite link, then click **Join**.

> 💡 If the invite page shows "Just chat from this page instead", that option only lets you chat. **Your video won't sync** unless you join through the extension.

### 7. Inside the party

The ReelRoom panel has two tabs.

**💬 Chat**

- Send messages of up to 50 characters, and add emojis with the ☺ button.
- Tap the reaction bar (😂 😱 😭 🔥 ❤️ 👏 🍿) to float a reaction across everyone's screen.
- **🔔 Popups** turns the one-second message popups on or off. This is a personal setting.
- If the host has set a **message gap**, the send button counts down until you can send again.

**👥 People**

- See who's in the room, who's online and who has playback control.
- Guests can **Request control**. The host then sees Grant and Decline buttons.

**Playback**

- The host, and anyone they've given control, can play, pause, seek or change speed using the streaming site's normal controls. Everyone else follows automatically.
- If a guest without control pauses or skips, their player snaps back and they're offered **Request control**.
- If Chrome blocks autoplay, the panel shows **"Click to sync playback"**. One click fixes it.

**Ad breaks**

- If your plan shows ads, the ad plays for you only, and the panel says **"Ad break on your side"**. The rest of the party keeps watching.
- When the ad finishes, you're taken straight to where everyone else is. You'll skip the part they watched during your ad, so you stay together.

**Leaving and ending**

- Guests click **Leave** to exit. You can knock again with the same link.
- The host's button says **End party** (click it twice to confirm). Ending closes the party for everyone.

---

## Host controls

| Control                    | Where                           | What it does                                                                   |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| **Admit / Deny**           | People tab (and pop-up notices) | Let a guest in, or turn them away.                                             |
| **Grant / Revoke control** | People tab                      | Allow a guest to play, pause and seek for everyone.                            |
| **Mute (one person)**      | People tab                      | Stop one guest from chatting or reacting.                                      |
| **Remove**                 | People tab                      | Kick someone out of the party.                                                 |
| **Mute chat**              | Chat tab                        | Only the host can chat until unmuted.                                          |
| **Message gap**            | Chat tab slider                 | Guests wait 0 (off) to 30 seconds between messages. The host is never limited. |
| **Switch title**           | Just open another title         | The party moves to the new title or episode on the same service.               |
| **End party**              | Panel footer (click twice)      | Closes the room for everyone.                                                  |

---

## Precautions & good to know

**Accounts and subscriptions**

- 🔐 **Everyone needs their own streaming subscription.** ReelRoom does not share accounts or video. Each person watches on their own Netflix, JioHotstar, Prime Video, Apple TV+ or Crunchyroll plan, and ReelRoom only keeps the players in sync.
- 🌍 **The title must be available to every guest.** Catalogues differ by country and by plan. If a friend can't open the title on their account, ReelRoom can't sync it for them.
- 📺 **Ad-supported plans work**, but the person with ads misses the few seconds the others watched during the ad, because they jump back to the group's position. Ad breaks are detected from the player's on-screen ad labels. If a service changes its player and the panel stops saying "Ad break on your side" during an ad, please [open an issue](https://github.com/Lakshya-0601/watch-party/issues).

**Browser and device**

- 🍎 **Apple TV+ and Crunchyroll are the newest additions** (extension 0.4.0). Open the specific episode or movie page and press play there; on Apple TV+, starting from a show's page works but guests should open the same episode. If something doesn't sync, please [open an issue](https://github.com/Lakshya-0601/watch-party/issues) with a screenshot.
- 💻 **Desktop browsers only.** Parties need the extension, which runs in **Google Chrome** or **Microsoft Edge** on a computer. Phones, tablets, smart-TV apps and the streaming services' desktop apps are not supported. Use their websites in Chrome instead.
- 🧩 **Only install the extension from the official ReelRoom site.** "Developer mode" lets Chrome load extensions from a folder. Never load extension folders that someone sends you from elsewhere. Chrome may remind you that developer-mode extensions are on; that's expected for ReelRoom.
- 🔄 **Keep the extension up to date**, and make sure everyone in the party uses the same latest version.
- 🌐 **Keep the streaming tab open.** Closing it, or the browser going to sleep, drops you out of sync until you come back. You'll re-sync automatically.
- 📶 **A stable internet connection** gives the best sync. On slow connections the player may buffer and catch up a moment later.

**Rooms**

- 🔗 **Treat invite links like a party invitation.** Anyone with the link can knock, but **only people you admit can get in**, so only admit people you know.
- 👥 Up to **15 people** per party.
- 🕒 Rooms are temporary. They live in the server's memory and **reset if the server restarts** (for example after an update) or after 6 hours with nobody connected. If a room disappears, the host just starts a new one.
- 💤 The website runs on a free plan that can **sleep when unused**. The first visit after a quiet period may take up to a minute.

**General**

- 🙅 ReelRoom is an independent project and is **not affiliated with Netflix, JioHotstar, Amazon Prime Video, Apple TV+ or Crunchyroll**. It doesn't bypass DRM, download content, block ads or change what you can watch.
- 📝 Be kind in the chat. The host can mute or remove people.

---

## Privacy & permissions

**What ReelRoom stores**

- Your **name, email and profile photo** (from Google, or what you enter), stored with Firebase Authentication.
- Your **preferences**: chosen streaming services and genres, saved in Firebase Firestore.
- **Party data** (who's in the room, chat messages, the current title and position) is kept **in memory only while the room exists**. It isn't saved to a database.
- Your password is handled by Firebase and is **never** seen or stored by ReelRoom.

**What the extension can access**

| Permission                                     | Why                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `netflix.com`, `hotstar.com`, `primevideo.com`, `tv.apple.com`, `crunchyroll.com` | To find the video player, keep it in sync and show the ReelRoom panel. **Only on these sites.** (On Crunchyroll it also runs inside the player frame on `static.crunchyroll.com`, where the video actually plays.) |
| `storage`                                      | To remember your sign-in token and settings (such as chat popups).                              |
| `activeTab`, `scripting`                       | So the toolbar button can open the ReelRoom panel on the tab you're looking at.                 |
| `clipboardWrite`                               | To copy invite links when you click the room chip.                                              |

The extension doesn't read your browsing history, your streaming account details, or any other website.

---

## Troubleshooting

| Problem                                                  | What to try                                                                                                                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The website keeps loading**                            | The free server is waking up. Wait up to a minute and refresh.                                                                                                                                     |
| **"Couldn't reach the ReelRoom server"**                 | Same as above: open the website once to wake it up, then try again.                                                                                                                                |
| **The website says the extension isn't installed**       | Check it's enabled in `chrome://extensions`, then refresh the website. Make sure you loaded the folder that contains `manifest.json`.                                                              |
| **"Update available"**                                   | Download the extension again, replace the folder's contents, click ↻ reload in `chrome://extensions`, and refresh your tabs.                                                                       |
| **No ReelRoom button on the streaming site**             | Refresh the streaming tab after installing or updating the extension. Make sure you're on a title's _watch_ page (the player), not the home page.                                                  |
| **"This room doesn't exist or has expired"**             | The room was closed, timed out or reset after a server restart. Ask the host for a new link. Check the code for typos too.                                                                         |
| **My friend shows as "in" but their video doesn't sync** | They probably joined from the web page instead of the extension. Ask them to open the invite link again and click **Join with the ReelRoom extension**, then open the title on the streaming site. |
| **"Waiting for host to let you in…"**                    | The host needs to click **Admit**, in the People tab or on the notice.                                                                                                                             |
| **I paused but it started playing again**                | You don't have playback control. Click **Request control** and ask the host.                                                                                                                       |
| **"Click to sync playback"**                             | Chrome blocked autoplay. Click the button once.                                                                                                                                                    |
| **"The party is watching X on Netflix"**                 | You're on a different title or service. Click **Go there to sync**.                                                                                                                                |
| **My send button shows a countdown**                     | The host set a message gap. Wait for the countdown to finish.                                                                                                                                      |
| **"Your ReelRoom sign-in expired"**                      | Click **Sign in again** in the panel, or sign in on the website.                                                                                                                                   |
| **Still stuck?**                                         | Reload the extension in `chrome://extensions`, refresh the streaming tab, and [open an issue](https://github.com/Lakshya-0601/watch-party/issues) with a screenshot.                               |

---

## For developers

### Tech stack

- **Web app:** [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript, Tailwind CSS.
- **Accounts:** Firebase Authentication (Google and email/password) and Firestore, with a signed session cookie on the server.
- **Real-time:** an in-memory room server (Server-Sent Events) plus a WebSocket gateway for the extension, served together by `server.mjs`.
- **Extension:** Chrome Manifest V3 with a background service worker, content scripts with a closed shadow-DOM overlay, and a sync engine. See [`extension/README.md`](extension/README.md) for the architecture and sync algorithm.
- **Hosting:** [Render](https://render.com) (one always-on Node service, defined in `render.yaml`).

### How it works

```
 Streaming tab (Netflix, JioHotstar, Prime,         ReelRoom server (Render)
               Apple TV+, Crunchyroll)
 ┌───────────────────────────────────────┐          ┌───────────────────────────┐
 │ <video> ◄─► SyncEngine                │          │ /realtime  WebSocket      │
 │ ReelRoom panel (chat, people, host)   │◄────────►│   gateway                 │
 │          ▲  extension background      │   wss    │      │ HTTP + SSE         │
 └──────────┼────────────────────────────┘          │      ▼                    │
            │ sign-in token                         │ Room server (in memory)   │
 ReelRoom website ─────────────────────────────────►│ Next.js app + API routes  │
                                                    │ Firebase Auth / Firestore │
                                                    └───────────────────────────┘
```

The room holds one authoritative playback state, `{ playing, position, rate, updatedAt }`. Each player computes where it _should_ be (`position + elapsed × rate`), hard-seeks when it's far off, and nudges its speed by ±5% when it's slightly off. Changes made by people with control are broadcast, and changes the engine makes itself are recognised and never echoed back.

### Project structure

```
app/                  Next.js routes: /auth, /onboarding, /dashboard, /room/[code], and the API routes
components/           React UI (auth, onboarding, dashboard, room, extension install)
lib/rooms/            Room server, types and client (permissions, chat rules, playback)
lib/firebase, lib/auth  Firebase client/admin, session cookies, user preferences
realtime/gateway.mjs  WebSocket ⇄ room server bridge used by the extension
server.mjs            Production server: Next.js + /realtime on one port
extension/            The Chrome extension (manifest, background, content scripts, popup, tests)
render.yaml           Render Blueprint for deployment
firestore.rules       Firestore security rules (only the server touches Firestore)
```

### Running locally

```bash
npm install
npm run dev
```

This starts the app on http://localhost:3107 **and** the realtime gateway on ws://localhost:3108, which the extension uses for watch parties. The gateway restarts automatically if it exits. `npm run dev:next` starts the app alone.

For local development, load the repo's `extension/` folder directly with **Load unpacked**. It points at `localhost` by default. The copy downloaded from a deployed site is automatically configured for that site.

### Firebase setup (sign-in + database)

Accounts use **Firebase Authentication** (email/password and Google), and each user's profile and preferences live in **Firestore** at `users/{uid}`. The browser signs in with Firebase, then trades the ID token for ReelRoom's own session cookie (30 days with "Remember me").

1. [Firebase console](https://console.firebase.google.com/) → **Add project**.
2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**. `localhost` is an authorised domain by default; add your production domain later.
3. **Firestore Database → Create database** (production mode), then paste `firestore.rules` into the **Rules** tab and publish. Only the server touches Firestore.
4. **Project settings → Your apps → Web app (`</>`)**: register an app and copy its config.
5. **Project settings → Service accounts → Generate new private key**: download the JSON. Keep it private and never commit it.
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
REELROOM_TOKEN_SECRET=another-long-random-string # signs extension tokens; shared by the app and the gateway
# NEXT_PUBLIC_EXTENSION_STORE_URL=https://chromewebstore.google.com/detail/…   # once published
```

> 🔒 `.env.local` is git-ignored. Never commit secrets or the service-account JSON.

**Local testing without a project:** run the Auth emulator (`npx firebase-tools emulators:start --only auth`) and set `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and a `demo-…` project ID. If Firestore is unreachable, sign-in still works and preferences stay on the device.

### Deploying (Render)

Watch parties need an always-on server: rooms live in memory, and the extension keeps a WebSocket open. Serverless hosts like Vercel can run the website but **not** parties, so the whole app is deployed as one Node service on Render.

1. [Render](https://dashboard.render.com/) → **New → Blueprint** → connect this GitHub repo. It reads `render.yaml`.
2. Fill in the Firebase values it asks for (the same as in `.env.local`). `REELROOM_SESSION_SECRET` and `REELROOM_TOKEN_SECRET` are generated for you.
3. When it's live, add the domain (e.g. `reelroom-vz4n.onrender.com`) in Firebase → **Authentication → Settings → Authorized domains**.
4. Install the extension **from the deployed site** using "Download the extension". That copy is configured for the site: invite links point at it, and live sync uses `wss://…/realtime`.
5. Optional: Render's free plan sleeps after about 15 minutes idle. A free uptime monitor (such as [UptimeRobot](https://uptimerobot.com)) pinging `/auth` every few minutes keeps it awake.

`npm start` runs `server.mjs`, which serves Next.js and the realtime gateway on one port.

### Tests

```bash
npx tsc --noEmit                            # type check
npm run lint                                # ESLint
node extension/test/sync-engine.test.mjs    # sync engine unit tests (drift, echo guards, ad breaks…)
node --env-file=.env.local extension/test/e2e.test.mjs   # host + guest end-to-end run (needs `npm run dev`)
```

---

<div align="center">

Made with 🍿 for movie nights · **[reelroom-vz4n.onrender.com](https://reelroom-vz4n.onrender.com)**

</div>
