/**
 * Keyboard firewall for the injected overlay (runs at document_start).
 *
 * Streaming sites bind global hotkeys — Space/K pause, F fullscreen, arrows
 * seek, M mute — often with capture-phase listeners on window/document. Typing
 * "fun movie" into our chat would otherwise pause, fullscreen and mute the
 * show. Key events from inside the overlay are composed, so they still travel
 * window → document → …; we register first (document_start) on window in the
 * capture phase and stop them there.
 *
 * Stopping propagation doesn't cancel default actions, so text input and
 * Enter-to-submit inside the overlay keep working. Escape is forwarded to the
 * overlay via ReelRoom.onOverlayKey (same isolated world).
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});
  if (ReelRoom.keyguardInstalled) return;
  ReelRoom.keyguardInstalled = true;

  const fromOverlay = (e) =>
    e.composedPath().some((n) => n instanceof Element && n.hasAttribute("data-reelroom-overlay"));

  for (const type of ["keydown", "keyup", "keypress"]) {
    window.addEventListener(
      type,
      (e) => {
        if (!fromOverlay(e)) return;
        if (type === "keydown") ReelRoom.onOverlayKey?.(e);
        e.stopImmediatePropagation();
      },
      true,
    );
  }
})();
