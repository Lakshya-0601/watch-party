/**
 * Styles for the injected overlay, scoped inside its shadow root.
 * Same tokens as the web app (app/globals.css) so it feels like ReelRoom.
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});

  ReelRoom.OVERLAY_CSS = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.rr {
  --ink: #06060a; --surface: #0f0f16; --surface-2: #171722; --line: rgba(255,255,255,.09);
  --muted: #9a9aae; --text: #f4f4f8; --ember: #ff3b5c; --ember-2: #ff7a45; --violet: #7c5cff;
  --success: #3ddc97; --danger: #ff5a6e; --amber: #f5b942;
  font: 14px/1.45 Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
  color: var(--text); -webkit-font-smoothing: antialiased;
}
button, input { font: inherit; color: inherit; }
button { cursor: pointer; background: none; border: 0; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
[hidden] { display: none !important; }

/* ---------- launcher ---------- */
.launcher {
  position: fixed; right: 16px; top: 50%; transform: translateY(-50%); z-index: 2147483646;
  display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px;
  background: rgba(15,15,22,.82); border: 1px solid var(--line); backdrop-filter: blur(12px);
  box-shadow: 0 12px 30px -10px rgba(0,0,0,.8); transition: transform .2s, background .2s, opacity .3s;
}
.launcher:hover { transform: translateY(-50%) scale(1.06); background: rgba(23,23,34,.95); }
.rr[data-open="true"] .launcher { opacity: 0; pointer-events: none; }
.rr[data-idle="true"] .launcher { opacity: .35; }
.rr[data-idle="true"] .launcher:hover { opacity: 1; }
.launcher svg { width: 26px; height: 26px; color: var(--ember); }
.launcher-dot { position: absolute; right: 7px; bottom: 7px; width: 9px; height: 9px; border-radius: 50%;
  background: var(--muted); border: 2px solid var(--surface); }
.launcher-dot[data-tone="ok"] { background: var(--success); }
.launcher-dot[data-tone="wait"] { background: var(--amber); }
.launcher-dot[data-tone="bad"] { background: var(--danger); }
.launcher-badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 10px; background: var(--ember); color: #fff; font-size: 11px; font-weight: 700;
  display: grid; place-items: center; }

/* ---------- panel ---------- */
.panel {
  position: fixed; right: 16px; top: 72px; bottom: 88px; width: 340px; max-width: calc(100vw - 32px);
  z-index: 2147483647; display: flex; flex-direction: column; overflow: hidden;
  background: rgba(15,15,22,.94); border: 1px solid var(--line); border-radius: 18px;
  backdrop-filter: blur(18px); box-shadow: 0 30px 70px -20px rgba(0,0,0,.85);
  transform: translateX(calc(100% + 24px)); transition: transform .35s cubic-bezier(.2,.8,.2,1);
}
.rr[data-open="true"] .panel { transform: none; }
.head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 7px; font-weight: 800; letter-spacing: .02em; font-size: 15px; }
.brand svg { width: 20px; height: 20px; color: var(--ember); }
.brand b { color: var(--ember); font-weight: 800; }
.status { margin-left: auto; font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--muted); flex: none; }
.status[data-tone="ok"]::before { background: var(--success); box-shadow: 0 0 8px var(--success); }
.status[data-tone="wait"]::before { background: var(--amber); }
.status[data-tone="bad"]::before { background: var(--danger); }
.icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; color: var(--muted); flex: none; }
.icon:hover { background: rgba(255,255,255,.08); color: var(--text); }

.banner { margin: 10px 12px 0; padding: 10px 12px; border-radius: 12px; font-size: 13px;
  background: rgba(124,92,255,.14); border: 1px solid rgba(124,92,255,.35); }
.banner[data-tone="warn"] { background: rgba(245,185,66,.12); border-color: rgba(245,185,66,.35); }
.banner[data-tone="bad"] { background: rgba(255,90,110,.12); border-color: rgba(255,90,110,.35); }
.banner strong { font-weight: 700; }
.banner .row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: 10px; font-size: 12.5px; font-weight: 650; background: rgba(255,255,255,.08); border: 1px solid var(--line); }
.btn:hover { background: rgba(255,255,255,.14); }
.btn.primary { background: linear-gradient(90deg, var(--ember), var(--ember-2)); border-color: transparent; color: #fff; }
.btn.light { background: #fff; color: var(--ink); border-color: transparent; }
.btn.danger { color: var(--danger); border-color: rgba(255,90,110,.4); background: rgba(255,90,110,.1); }
.btn.danger:hover { background: var(--danger); color: #fff; }
.btn:disabled { opacity: .45; cursor: not-allowed; }

.tabs { display: flex; gap: 4px; padding: 10px 12px 0; }
.tab { flex: 1; height: 32px; border-radius: 10px; font-size: 12.5px; font-weight: 650; color: var(--muted); }
.tab[aria-selected="true"] { background: var(--surface-2); color: var(--text); }
.tab .count { color: var(--muted); font-weight: 500; }

.chat, .people { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.messages { flex: 1; overflow-y: auto; list-style: none; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.msg { display: flex; flex-direction: column; max-width: 85%; }
.msg .who { font-size: 11px; color: var(--muted); margin-bottom: 2px; }
.msg .bubble { padding: 7px 11px; border-radius: 14px 14px 14px 4px; background: rgba(255,255,255,.08);
  white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.mine { align-self: flex-end; align-items: flex-end; }
.msg.mine .bubble { background: var(--ember); color: #fff; border-radius: 14px 14px 4px 14px; }
.msg.system { align-self: center; max-width: 100%; font-size: 11px; color: var(--muted); text-align: center; }
.empty-chat { margin: auto; color: var(--muted); font-size: 13px; text-align: center; }

.chat-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.chat-bar .spacer { flex: 1; }
.chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px;
  border: 1px solid var(--line); background: rgba(255,255,255,.06); color: var(--text); font-size: 11.5px; white-space: nowrap; }
.chip:hover { background: rgba(255,255,255,.12); }
.chip.code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .05em; }
.chip[aria-pressed="false"]:not(.danger) { color: var(--muted); }
.chip.danger[aria-pressed="true"] { color: var(--danger); border-color: rgba(255,90,110,.4); background: rgba(255,90,110,.12); }

.react-bar { display: flex; justify-content: space-between; padding: 6px 12px; border-top: 1px solid var(--line); }
.react-bar button, .emoji-grid button { font-size: 20px; width: 36px; height: 36px; border-radius: 10px; transition: transform .15s; }
.react-bar button:hover, .emoji-grid button:hover { background: rgba(255,255,255,.08); transform: scale(1.15); }
.emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 6px 10px; border-top: 1px solid var(--line); background: rgba(0,0,0,.25); }
.composer { display: flex; align-items: center; gap: 6px; margin: 8px 10px 10px; padding: 4px; border-radius: 12px;
  background: var(--surface-2); border: 1px solid var(--line); }
.composer:focus-within { border-color: var(--ember); }
.composer input { flex: 1; min-width: 0; background: none; border: 0; outline: none; padding: 6px 4px; }
.composer input::placeholder { color: rgba(255,255,255,.3); }
.send { width: 32px; height: 32px; border-radius: 9px; background: var(--ember); color: #fff; display: grid; place-items: center; }
.send:disabled { opacity: .3; }
.send { width: auto; min-width: 32px; padding: 0 6px; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.count-chars { font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums; }
.count-chars[data-full="true"] { color: var(--danger); }
.composer[data-blocked="true"] { opacity: .5; }
.react-bar button:disabled { opacity: .3; transform: none; cursor: not-allowed; }
.composer-error { margin: -4px 12px 8px; font-size: 11.5px; color: var(--danger); }

.people-list { list-style: none; overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 2px; }
.person { display: flex; align-items: center; gap: 10px; padding: 7px 6px; border-radius: 12px; }
.person:hover { background: rgba(255,255,255,.04); }
.avatar { position: relative; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
  font-size: 11px; font-weight: 700; color: #fff; flex: none; }
.avatar .online { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,.3); border: 2px solid var(--surface); }
.avatar .online[data-on="true"] { background: var(--success); }
.person .meta { flex: 1; min-width: 0; }
.person .name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.person .sub { font-size: 11px; color: var(--muted); }
.person .actions { display: flex; gap: 4px; }
.person .actions .btn { height: 28px; padding: 0 9px; font-size: 11.5px; }
.section-title { padding: 10px 8px 4px; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

.foot { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); }
.control { flex: 1; min-width: 0; font-size: 12px; color: var(--muted); }
.control .btn { width: 100%; }

.idle-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 24px; text-align: center; }
.idle-state p { color: var(--muted); font-size: 13px; }
.idle-state h3 { font-size: 16px; font-weight: 700; }
.or { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 10px; color: var(--muted);
  font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; }
.or::before, .or::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.join-party { width: 100%; display: flex; flex-direction: column; gap: 7px; text-align: left; }
.join-party label { font-size: 12px; color: var(--muted); }
.join-party .row { display: flex; gap: 6px; }
.join-party input { flex: 1; min-width: 0; height: 36px; padding: 0 12px; border-radius: 10px; outline: none;
  background: var(--surface-2); border: 1px solid var(--line); color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; }
.join-party input::placeholder { color: rgba(255,255,255,.3); font-family: inherit; }
.join-party input:focus { border-color: var(--ember); }
.join-party .btn { height: 36px; }
.join-error { font-size: 11.5px; color: var(--danger); }

/* ---------- toasts ---------- */
.toasts { position: fixed; top: 72px; left: 50%; transform: translateX(-50%); z-index: 2147483647;
  display: flex; flex-direction: column; gap: 8px; width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.rr[data-open="true"] .toasts { left: auto; right: 372px; transform: none; }
.toast { pointer-events: auto; padding: 10px 12px; border-radius: 14px; background: rgba(23,23,34,.96);
  border: 1px solid var(--line); box-shadow: 0 18px 40px -12px rgba(0,0,0,.8); backdrop-filter: blur(14px);
  animation: toast-in .3s cubic-bezier(.2,.8,.2,1) both; }
.toast.leaving { animation: toast-out .25s ease both; }
.toast .t { font-weight: 650; font-size: 13px; }
.toast .b { font-size: 12.5px; color: rgba(255,255,255,.75); margin-top: 2px; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.toast .row { display: flex; gap: 6px; margin-top: 8px; }
.toast.compact { padding: 7px 12px; border-radius: 999px; text-align: center; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } }
@keyframes toast-out { to { opacity: 0; transform: translateY(-6px); } }

/* ---------- chat popups (1 s, bottom of the screen) ---------- */
.popups { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 2147483647;
  display: flex; flex-direction: column; align-items: center; gap: 6px; width: min(440px, calc(100vw - 32px)); pointer-events: none; }
.popup { max-width: 100%; padding: 6px 14px; border-radius: 999px; background: rgba(23,23,34,.96); border: 1px solid var(--line);
  box-shadow: 0 12px 30px -10px rgba(0,0,0,.8); font-size: 13px; color: rgba(255,255,255,.85);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: popup-in .18s ease both; }
.popup b { color: #fff; font-weight: 650; }
@keyframes popup-in { from { opacity: 0; transform: translateY(6px); } }

/* ---------- floating reactions ---------- */
.floaters { position: fixed; inset: 0; pointer-events: none; z-index: 2147483645; overflow: hidden; }
.floater { position: absolute; bottom: 90px; font-size: 34px; animation: float-up 3.2s cubic-bezier(.3,.7,.4,1) forwards;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,.5)); }
.floater .by { display: block; font-size: 10px; font-weight: 700; text-align: center; color: #fff;
  font-family: Inter, system-ui, sans-serif; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
@keyframes float-up {
  0% { opacity: 0; transform: translateY(0) scale(.6); }
  12% { opacity: 1; transform: translateY(-30px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-420px) scale(1) rotate(var(--tilt, 0deg)); }
}

@media (prefers-reduced-motion: reduce) {
  .panel, .launcher { transition: none; }
  .floater { animation-duration: 1.5s; }
}
`;
})();
