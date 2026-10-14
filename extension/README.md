# ReelRoom browser extension (Manifest V3)

Watch Netflix, Disney+ and Prime Video in sync: shared play / pause / seek / speed, live chat, emoji reactions and host-controlled rooms — injected right into the streaming page. Every participant streams with their own subscription; the extension only synchronises the players.

## Run it locally

```bash
npm run dev        # Next.js app + room server → http://localhost:3107, plus the WebSocket gateway → ws://localhost:3108
                   # (the gateway is restarted automatically if it exits; `npm run realtime` runs it alone)
```

**Chrome / Edge:** `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select this `extension/` folder.
**Firefox (128+):** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `extension/manifest.json`.

Then sign in on http://localhost:3107 once — the app hands a signed token to the extension automatically. Open a title on a supported site and use the toolbar popup (or the ▶ launcher on the page) to start a party or join one with a code / invite link.

## Architecture

```
streaming tab                      extension                          server
─────────────                      ─────────                          ──────
<video> ◄─► SyncEngine ─┐
VideoFinder ────────────┤ port     background.js ──WebSocket──► realtime/gateway.mjs ──HTTP/SSE──► Next.js room server
Overlay (shadow DOM) ◄──┘◄────────► (state, auth,                 (auth, fan-out)                  (rooms, permissions,
page/netflix-bridge.js (MAIN world)  clock sync)                                                    15-person cap, chat)
popup/ ◄───────── port ────────────►
app/app-bridge.js (on the ReelRoom web app) ── token hand-off ──► chrome.storage.local
```

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest; `background.service_worker` for Chromium, `background.scripts` for Firefox |
| `background.js` | WebSocket lifecycle (auth → subscribe → keepalive → backoff reconnect), clock sync, host secrets, session restore after the worker is suspended |
| `content/video-finder.js` | Finds the main `<video>` (MutationObserver + shadow-DOM scan + trailer filtering) |
| `content/sync-engine.js` | Remote→local reconcile (seek / ±5% rate nudge), local→remote broadcast, feedback-loop guards |
| `content/site-adapters.js` | Per-site URLs, titles, ad detection, and Netflix-safe seeking |
| `page/netflix-bridge.js` | Runs in Netflix's page world to seek via its player API (direct `currentTime` writes trigger error M7375) |
| `content/overlay*.js` | In-page chat, people, host approvals, toasts, floating reactions (closed shadow root) |
| `content/keyguard.js` | Stops site hotkeys (Space, F, M, arrows) from firing while you type in the overlay |
| `popup/` | Toolbar popup: sign-in state, start / join, invite link, participants, reactions |
| `app/app-bridge.js` | Receives the signed token from the web app (`components/ExtensionBridge.tsx`) |

### Sync state machine (content/sync-engine.js)

* **Remote → local:** the room's `{ playing, position, rate, updatedAt }` defines where everyone should be (`position + elapsed × rate`). Each tick: play/pause to match, then **hard-seek** if more than 1.25 s off (0.15 s when paused), otherwise **nudge `playbackRate` ±5%** if more than 0.35 s off.
* **Local → remote:** native `play` / `pause` / `seeked` / `ratechange` events are debounced (250 ms) into one snapshot and broadcast — unless they're echoes of our own changes.
* **Feedback-loop prevention:** every programmatic change registers an *expected-event token* (expires after 1.5 s) that the resulting DOM event consumes; trailing `seeked` echoes near our own target are ignored; snapshots that already match the room are dropped; and while a user action is pending — or a change is unexplained because its DOM event is still queued — drift correction stands down so it can't undo it.
* **Permissions:** without playback control, a local pause/seek is reverted and the overlay offers *Request control*. The server enforces the same rule.

## Tests

```bash
node extension/test/sync-engine.test.mjs   # 19 unit tests, FakeVideo (queued async events, keyframe snapping, autoplay blocking)
node extension/test/e2e.test.mjs           # 12-step host+guest run of the real background.js + engine via gateway & room server
```

The e2e drives two simulated browsers (in-memory `chrome.*`, Node's native WebSocket) through: token hand-off → create party → knock → admit → host play/pause → unauthorised guest seek (reverted) → control request/grant → guest fast-forward and speed change → chat + reactions → guest service-worker restart → end party.

Measured on a production build (`next build && next start`, same machine): room broadcast p50 18 ms / p95 29 ms through the gateway; a host pause reaches the guest's player in ~315 ms including the deliberate 250 ms debounce, and paused players land on the same frame. 30/30 consecutive e2e runs passed on the final build.

`dev/overlay-preview.html` and `dev/popup-preview.html` render the real UI code with mock state (serve the folder over HTTP).

## Known limits

* **Not yet verified on live streaming sites.** The DOM selectors, URL shapes and Netflix's (undocumented) player API in `site-adapters.js` / `netflix-bridge.js` reflect the sites at the time of writing and need checking with real accounts; failures degrade to plain `<video>` control and `document.title`.
* Prime Video ad breaks pause syncing via a best-effort selector; Disney+/Prime "next episode" handovers rely on the URL change heuristic.
* **Playback timestamps:** playback changes carry `at` (the sender's clock-synced server time), so request latency doesn't shift other viewers.
* The token is issued for the user in the web app's session cookie (`/api/extension/token`).
* For production: set `APP_ORIGIN` / `REALTIME_URL` in `shared/config.js`, add your app origin to `host_permissions` + the app-bridge `matches`, and share `REELROOM_TOKEN_SECRET` between the app and the gateway.
