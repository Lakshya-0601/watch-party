/**
 * Unit tests for content/sync-engine.js against FakeVideo.
 * Run: node extension/test/sync-engine.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { FakeVideo } from "./fake-video.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
// Load the classic-script modules into a sandbox exactly as the browser would
const sandbox = { performance, setTimeout, clearTimeout, setInterval, clearInterval, Date, Promise, console, crypto, URL };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const file of ["shared/config.js", "shared/protocol.js", "content/sync-engine.js"]) {
  vm.runInContext(readFileSync(root + file, "utf8"), sandbox, { filename: file });
}
const { SyncEngine, CONFIG, protocol } = sandbox.ReelRoom;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adapter = {
  play: (v) => v.play(),
  pause: (v) => v.pause(),
  seek: (v, t) => {
    v.currentTime = t;
  },
};

function setup({ canControl = true, video: videoOpts, adapter: adapterOverride } = {}) {
  const sent = [];
  const rejected = [];
  const ads = [];
  const video = new FakeVideo(videoOpts);
  const engine = new SyncEngine({
    adapter: adapterOverride ?? adapter,
    config: CONFIG.SYNC,
    expectedPosition: protocol.expectedPosition,
    onLocalChange: (s) => sent.push(s),
    onRejected: (r) => rejected.push(r),
    onAdChange: (inAd) => ads.push(inAd),
  });
  engine.attach(video);
  // Room says: paused at 0
  let room = { playing: false, position: 0, rate: 1, updatedAt: Date.now(), byName: null };
  const push = (patch) => {
    room = { ...room, ...patch, updatedAt: Date.now() };
    engine.update({ playback: room, clockOffset: 0, canControl, enabled: true });
  };
  push({});
  return { engine, video, sent, rejected, ads, push, get room() { return room; } };
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (err) {
    results.push(["FAIL", name, err.message]);
  }
}

await test("remote play is applied and NOT rebroadcast (no feedback loop)", async () => {
  const t = setup();
  t.push({ playing: true, position: 0 });
  await sleep(600);
  assert.equal(t.video.paused, false, "video should be playing");
  assert.ok(t.video.log.includes("play"), "a native play event fired");
  assert.equal(t.sent.length, 0, `remote change was echoed back: ${JSON.stringify(t.sent)}`);
  t.engine.destroy();
});

await test("remote seek is applied and its seeked event is not rebroadcast", async () => {
  const t = setup();
  t.push({ playing: false, position: 600 });
  await sleep(600);
  assert.ok(Math.abs(t.video.currentTime - 600) < 0.05, `at ${t.video.currentTime}`);
  assert.ok(t.video.log.includes("seeked"));
  assert.equal(t.sent.length, 0, `seek echoed: ${JSON.stringify(t.sent)}`);
  t.engine.destroy();
});

await test("player snaps our seek to a keyframe ~1 s away: still not rebroadcast", async () => {
  // Remote seek to 601 lands on 602 (2 s keyframes). The seeked event now looks
  // like a *different* position, so only the expected-event token can tell it's ours.
  const t = setup({ video: { keyframeInterval: 2 } });
  t.push({ playing: false, position: 601 });
  await sleep(700);
  assert.equal(t.video.currentTime, 602, `landed at ${t.video.currentTime}`);
  assert.equal(t.sent.length, 0, `keyframe-snapped seek was echoed: ${JSON.stringify(t.sent)}`);
  t.engine.destroy();
});

await test("user pause is broadcast once with the exact currentTime", async () => {
  const t = setup();
  t.push({ playing: true, position: 100 });
  await sleep(1200);
  const at = t.video.currentTime;
  t.video.userPause();
  await sleep(600);
  assert.equal(t.sent.length, 1, `expected one broadcast, got ${t.sent.length}`);
  assert.equal(t.sent[0].playing, false);
  assert.ok(Math.abs(t.sent[0].position - at) < 0.1, `position ${t.sent[0].position} vs ${at}`);
  t.engine.destroy();
});

await test("scrubbing (many seeks) is debounced into a single broadcast", async () => {
  const t = setup();
  for (const pos of [200, 250, 300, 320, 333]) {
    t.video.userSeek(pos);
    await sleep(40);
  }
  await sleep(700);
  assert.equal(t.sent.length, 1, `expected 1 broadcast, got ${t.sent.length}`);
  assert.ok(Math.abs(t.sent[0].position - 333) < 0.1);
  t.engine.destroy();
});

await test("room echo of our own change doesn't snap the video back", async () => {
  const t = setup();
  t.push({ playing: true, position: 50 });
  await sleep(500);
  t.video.userSeek(900);
  await sleep(400); // broadcast happened; room hasn't echoed yet
  // A stale re-delivery of the OLD room state arrives (same updatedAt)
  t.engine.update({ playback: t.room, clockOffset: 0, canControl: true, enabled: true });
  await sleep(100);
  assert.ok(t.video.currentTime > 890, `snapped back to ${t.video.currentTime}`);
  // Now the echo lands
  t.push({ playing: true, position: t.sent.at(-1).position });
  await sleep(300);
  assert.ok(t.video.currentTime > 890);
  assert.equal(t.sent.length, 1);
  t.engine.destroy();
});

await test("regression: drift check inside the debounce window doesn't undo a user seek", async () => {
  // Found by the production e2e: the 1 s drift loop fired between the user's
  // seek and the debounced flush, "corrected" the seek, and nothing was sent.
  const t = setup();
  t.push({ playing: false, position: 100 });
  await sleep(300);
  t.video.userSeek(700);
  await sleep(60); // seeked has fired; flush is still pending
  t.engine.reconcile(); // the periodic drift check lands right here
  t.engine.update({ playback: t.room, clockOffset: 0, canControl: true, enabled: true }); // …or an unrelated view
  await sleep(500);
  assert.ok(Math.abs(t.video.currentTime - 700) < 0.05, `user seek undone: at ${t.video.currentTime}`);
  assert.equal(t.sent.length, 1);
  assert.ok(Math.abs(t.sent[0].position - 700) < 0.05);
  t.engine.destroy();
});

await test("regression: check between `seeking=false` and the queued `seeked` event doesn't revert", async () => {
  // Media elements flip `seeking` synchronously but dispatch `seeked` as a
  // later task. A timer landing in between sees an unexplained jump.
  const t = setup();
  t.push({ playing: false, position: 100 });
  await sleep(300);
  t.video.userSeek(700);
  while (t.video.seeking) await sleep(1); // seek finished, event not dispatched yet
  t.engine.reconcile(); // periodic check in the gap
  t.engine.update({ playback: t.room, clockOffset: 0, canControl: true, enabled: true }); // chat-triggered view in the gap
  await sleep(500);
  assert.ok(Math.abs(t.video.currentTime - 700) < 0.05, `user seek undone: at ${t.video.currentTime}`);
  assert.equal(t.sent.length, 1, `broadcasts: ${JSON.stringify(t.sent)}`);
  t.engine.destroy();
});

await test("same gap for pause: a check before the queued `pause` event doesn't resume playback", async () => {
  const t = setup();
  t.push({ playing: true, position: 50 });
  await sleep(400);
  t.video.userPause(); // paused=true now; 'pause' event is queued
  t.engine.reconcile();
  await sleep(500);
  assert.equal(t.video.paused, true, "user pause was undone");
  assert.equal(t.sent.at(-1)?.playing, false);
  t.engine.destroy();
});

await test("persistent divergence is still corrected on the next check (e.g. player stalled)", async () => {
  const t = setup();
  t.push({ playing: true, position: 0 });
  await sleep(300);
  // The page's player pauses itself without any event (some sites do on stalls)
  t.video.paused = true;
  t.video._base = t.video.currentTime;
  t.engine.reconcile(); // 1st check: unexplained mismatch → wait for an event
  assert.equal(t.video.paused, true);
  await sleep(CONFIG.SYNC.CONFIRM_MS + 20);
  t.engine.reconcile(); // still diverged and nothing explained it → fix
  await sleep(100);
  assert.equal(t.video.paused, false, "should resume after confirming divergence");
  assert.equal(t.sent.length, 0);
  t.engine.destroy();
});

await test("regression: unauthorized seek is reported even if a drift check lands mid-debounce", async () => {
  const t = setup({ canControl: false });
  t.push({ playing: false, position: 100 });
  await sleep(300);
  t.video.userSeek(700);
  await sleep(60);
  t.engine.reconcile();
  await sleep(500);
  assert.deepEqual(t.rejected, ["no-control"]);
  assert.ok(Math.abs(t.video.currentTime - 100) < 0.05, `not reverted: at ${t.video.currentTime}`);
  t.engine.destroy();
});

await test("paused followers land on the host's exact frame (no 250 ms gap)", async () => {
  const t = setup();
  t.push({ playing: false, position: 100.1 });
  await sleep(300);
  t.push({ playing: false, position: 100.37 }); // 0.27 s away — used to be tolerated
  await sleep(300);
  assert.ok(Math.abs(t.video.currentTime - 100.37) < 0.01, `at ${t.video.currentTime}`);
  assert.equal(t.sent.length, 0);
  t.engine.destroy();
});

await test("paused + keyframe snapping: one seek, then accept the landing (no seek loop)", async () => {
  const t = setup({ video: { keyframeInterval: 2 } });
  t.push({ playing: false, position: 301 }); // lands on 302
  await sleep(400);
  for (let i = 0; i < 3; i++) {
    t.engine.reconcile();
    await sleep(100);
  }
  const seeks = t.video.log.filter((e) => e === "seeked").length;
  assert.equal(seeks, 1, `seeked ${seeks}× — looping`);
  assert.equal(t.sent.length, 0);
  t.engine.destroy();
});

await test("guest without control: local pause is reverted, not broadcast", async () => {
  const t = setup({ canControl: false });
  t.push({ playing: true, position: 10 });
  await sleep(500);
  t.video.userPause();
  await sleep(700);
  assert.equal(t.sent.length, 0, "must not broadcast without control");
  assert.deepEqual(t.rejected, ["no-control"]);
  assert.equal(t.video.paused, false, "should be playing again (reverted)");
  t.engine.destroy();
});

await test("small drift is corrected with a rate nudge, not a seek", async () => {
  const t = setup();
  t.push({ playing: true, position: 0 });
  await sleep(400);
  const seeksBefore = t.video.log.filter((e) => e === "seeked").length;
  // Room says we're 0.8 s further along than we are → we're behind
  t.push({ playing: true, position: t.video.currentTime + 0.8 });
  await sleep(300);
  assert.ok(t.video.playbackRate > 1, `rate ${t.video.playbackRate}`);
  assert.equal(t.video.log.filter((e) => e === "seeked").length, seeksBefore, "should not seek for small drift");
  assert.equal(t.sent.length, 0, "nudges must not be broadcast");
  t.engine.destroy();
});

await test("large drift triggers a hard seek", async () => {
  const t = setup();
  t.push({ playing: true, position: 0 });
  await sleep(400);
  t.push({ playing: true, position: 300 });
  await sleep(400);
  assert.ok(Math.abs(t.video.currentTime - 300) < 1, `at ${t.video.currentTime}`);
  assert.equal(t.sent.length, 0);
  t.engine.destroy();
});

await test("user speed change is broadcast; room rate is applied remotely", async () => {
  const t = setup();
  t.push({ playing: true, position: 0 });
  await sleep(400);
  t.video.userRate(1.5);
  await sleep(500);
  assert.equal(t.sent.at(-1)?.rate, 1.5);
  const t2 = setup();
  t2.push({ playing: true, position: 0, rate: 2 });
  await sleep(400);
  assert.equal(t2.video.playbackRate, 2);
  assert.equal(t2.sent.length, 0);
  t.engine.destroy();
  t2.engine.destroy();
});

await test("autoplay block is reported and resumes on a user gesture", async () => {
  const t = setup();
  t.video.autoplayBlocked = true;
  t.push({ playing: true, position: 0 });
  await sleep(300);
  assert.deepEqual(t.rejected, ["autoplay-blocked"]);
  t.video.autoplayBlocked = false;
  t.engine.resume();
  await sleep(300);
  assert.equal(t.video.paused, false);
  assert.equal(t.sent.length, 0);
  t.engine.destroy();
});

await test("disabled engine (other title / not admitted) ignores events and room state", async () => {
  const t = setup();
  t.engine.update({ playback: { ...t.room, playing: true, position: 500 }, clockOffset: 0, canControl: true, enabled: false });
  t.video.userSeek(42);
  await sleep(600);
  assert.ok(Math.abs(t.video.currentTime - 42) < 0.05);
  assert.equal(t.sent.length, 0);
  t.engine.destroy();
});

await test("ad break: the ad's pauses/seeks aren't broadcast, and the viewer rejoins the party afterwards", async () => {
  let inAd = false;
  const t = setup({ adapter: { ...adapter, isAdPlaying: () => inAd } });
  t.push({ playing: true, position: 100 });
  await sleep(400);
  assert.ok(Math.abs(t.video.currentTime - 100) < 1.5, `synced at ${t.video.currentTime}`);

  // Ad starts: the player pauses the feature and plays the ad
  inAd = true;
  t.video.userPause();
  await sleep(1300);
  assert.deepEqual(t.ads, [true], "overlay told about the ad");
  assert.equal(t.sent.length, 0, `ad pause was broadcast: ${JSON.stringify(t.sent)}`);
  assert.equal(t.video.paused, true, "engine must not fight the ad");

  // Ad ends: after the grace period we jump to where the party is now
  inAd = false;
  t.video.userPlay();
  await sleep(CONFIG.SYNC.AD_GRACE_MS + 1300);
  assert.deepEqual(t.ads, [true, false]);
  const target = protocol.expectedPosition(t.room, Date.now());
  assert.ok(Math.abs(t.video.currentTime - target) < CONFIG.SYNC.HARD_SEEK_S, `at ${t.video.currentTime}, party at ${target}`);
  assert.equal(t.video.paused, false);
  assert.equal(t.sent.length, 0, `ad end was broadcast: ${JSON.stringify(t.sent)}`);
  t.engine.destroy();
});

await test("ad break: a short clip in a feature-length player counts as an ad", async () => {
  const t = setup({ video: { duration: 5400 } });
  t.push({ playing: false, position: 2000 });
  await sleep(300);
  t.video.duration = 30; // the player swapped in a 30 s ad
  t.video.userSeek(0);
  await sleep(1300);
  assert.deepEqual(t.ads, [true]);
  assert.equal(t.sent.length, 0);
  assert.ok(t.video.currentTime < 30, "the ad isn't seeked to the party position");
  t.engine.destroy();
});

await test("after an ad break, the user's own actions sync again", async () => {
  let inAd = true;
  const t = setup({ adapter: { ...adapter, isAdPlaying: () => inAd } });
  await sleep(1100);
  inAd = false;
  await sleep(CONFIG.SYNC.CHECK_MS + CONFIG.SYNC.AD_GRACE_MS + 300); // next check notices the ad ended, then the grace period
  t.video.userSeek(321);
  await sleep(700);
  assert.equal(t.sent.length, 1, `expected one broadcast, got ${JSON.stringify(t.sent)}`);
  assert.ok(Math.abs(t.sent[0].position - 321) < 0.5);
  t.engine.destroy();
});

for (const [status, name, err] of results) console.log(`${status}  ${name}${err ? `\n      ↳ ${err}` : ""}`);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
