// Bridge for running inside a cross-origin host page (the Rückenwind WordPress
// embed). Two jobs beyond the height auto-resize in main.tsx:
//
//  1. The host introduces itself with its own URL, so the "Copy link" button can
//     hand out a link that opens the *embedded* page (not the bare iframe).
//  2. We mirror our config hash back to the host on every change, so the host can
//     keep it in its own address bar (bookmark / reload / share).
//
// Config is carried as our URL hash (e.g. `#/drivetrain?cr=53%2C39`). The host
// seeds us by loading the iframe with that hash in its src; from then on it just
// mirrors whatever we report — so there's no boot-time race over the source of
// truth.

// Fired by useUrlConfigSync after a replaceState (which, unlike navigation, does
// not emit a hashchange event). Kept as a string literal here and there to avoid
// coupling the router to this module.
const CONFIG_CHANGED = "bikecalc:configchanged";

let parentUrl: string | null = null; // host page URL, without its own hash
let parentOrigin = "*";

export function isEmbedded(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

/**
 * The URL the "Copy link" button should share: the host page plus our current
 * config hash when embedded and the host has introduced itself; otherwise our own
 * address (standalone, or a host that hasn't been updated to the new protocol).
 */
export function getShareUrl(): string {
  if (parentUrl) return parentUrl + window.location.hash;
  return window.location.href;
}

/** Notify the embed bridge that our config hash changed via replaceState. */
export function notifyConfigChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONFIG_CHANGED));
}

function postConfig() {
  if (!isEmbedded()) return;
  window.parent.postMessage(
    { type: "bikecalc:config", hash: window.location.hash },
    parentOrigin,
  );
}

/** Wire up the host handshake. Call once at startup, only when embedded. */
export function initEmbedBridge(): void {
  if (!isEmbedded()) return;
  window.addEventListener("message", (e) => {
    if (e.data?.type === "bikecalc:embed" && typeof e.data.parentUrl === "string") {
      parentUrl = e.data.parentUrl;
      parentOrigin = e.origin;
      postConfig(); // sync the host to our (possibly normalised) hash right away
    }
  });
  // Mirror config to the host on any hash change: route navigation and
  // back/forward fire "hashchange"; config edits go through replaceState, which
  // instead dispatches CONFIG_CHANGED (see useUrlConfigSync).
  window.addEventListener("hashchange", postConfig);
  window.addEventListener(CONFIG_CHANGED, postConfig);
}
