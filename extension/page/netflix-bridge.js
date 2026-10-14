/**
 * Runs in Netflix's *page* JS world (manifest: "world": "MAIN"), where the
 * site's player API is reachable. Receives commands from the isolated content
 * script as CustomEvents with JSON string payloads and replies the same way.
 *
 * Netflix's player API is undocumented and may change; every call is guarded
 * and failures are reported back so the content script can fall back.
 */
(() => {
  if (window.__reelroomNetflixBridge) return;
  window.__reelroomNetflixBridge = true;

  /** Current Cadmium player session for the title on screen, or null. */
  function getPlayer() {
    try {
      const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
      const ids = videoPlayer?.getAllPlayerSessionIds?.() ?? [];
      const id = ids.find((s) => String(s).startsWith("watch")) ?? ids[0];
      return id ? videoPlayer.getVideoPlayerBySessionId(id) : null;
    } catch {
      return null;
    }
  }

  const reply = (msg) =>
    document.dispatchEvent(new CustomEvent("reelroom:netflix-reply", { detail: JSON.stringify(msg) }));

  document.addEventListener("reelroom:netflix-command", (e) => {
    let cmd;
    try {
      cmd = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (cmd.op === "hello") return reply({ id: cmd.id, type: "ready", ok: Boolean(getPlayer()) });

    const player = getPlayer();
    if (!player) return reply({ id: cmd.id, ok: false });
    try {
      if (cmd.op === "seek" && Number.isFinite(cmd.ms)) player.seek(cmd.ms);
      else if (cmd.op === "play") player.play();
      else if (cmd.op === "pause") player.pause();
      else return reply({ id: cmd.id, ok: false });
      reply({ id: cmd.id, ok: true });
    } catch {
      reply({ id: cmd.id, ok: false });
    }
  });

  reply({ id: 0, type: "ready", ok: Boolean(getPlayer()) });
})();
