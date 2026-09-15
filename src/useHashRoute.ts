import { useEffect, useState } from "react";
import { notifyConfigChanged } from "./embed";

/** Read a query param from the hash, e.g. "size" from `#/tire?size=700x28C`. */
export function getHashQueryParam(name: string): string | null {
  return getHashQuery().get(name);
}

/** All query params from the current hash (empty when there's no `?…`). */
export function getHashQuery(): URLSearchParams {
  const hash = window.location.hash;
  const qi = hash.indexOf("?");
  return new URLSearchParams(qi < 0 ? "" : hash.slice(qi + 1));
}

/**
 * Build a `#/route?…` hash from a params object, dropping null/undefined/empty
 * values (so a shared link only carries what differs from the defaults the page
 * seeds itself with). Values are stringified; order follows insertion order.
 */
export function buildHash(routeId: string, params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    usp.set(k, String(v));
  }
  const q = usp.toString();
  return `#/${routeId}${q ? "?" + q : ""}`;
}

/**
 * Keep the address-bar hash in sync with a page's current config, so the URL is
 * always a shareable/bookmarkable link to what's on screen. Uses replaceState
 * (no history spam, and no hashchange event, so the router isn't disturbed).
 * Only writes while we're actually on `routeId`, to avoid clobbering an
 * in-flight navigation to another page.
 *
 * The write is debounced: dragging a slider changes the config every few ms, and
 * browsers cap replaceState (Safari throws after 100 calls / 10 s). Coalescing a
 * burst into one write after the value settles keeps the URL fresh without
 * tripping that limit.
 */
export function useUrlConfigSync(routeId: string, params: Record<string, unknown>): void {
  const hash = buildHash(routeId, params);
  useEffect(() => {
    // An empty hash means the app is showing its default route (which is the page
    // mounting this hook), so writing is safe. A non-empty, non-matching hash
    // means we're mid-navigation to another page — don't clobber it.
    const onRoute = () => {
      const current = window.location.hash.replace(/^#\/?/, "").split("?")[0];
      return current === "" || current === routeId;
    };
    if (!onRoute() || window.location.hash === hash) return;
    const id = window.setTimeout(() => {
      // Re-check at write time — a navigation may have started during the delay.
      if (!onRoute() || window.location.hash === hash) return;
      history.replaceState(null, "", hash);
      // replaceState doesn't fire hashchange; let the embed bridge (if any) mirror
      // the new config up to a host page.
      notifyConfigChanged();
    }, 200);
    return () => window.clearTimeout(id);
  }, [hash, routeId]);
}

/**
 * A value that changes whenever the hash changes via a real hashchange event —
 * back/forward, or pasting a shared link into the address bar on the route that's
 * already open. Config sync uses replaceState, which does NOT fire hashchange, so
 * editing a page never trips this. Use it in a component `key` so a shareable page
 * remounts and re-reads its config when a new link arrives without a full reload.
 */
export function useHashConfigKey(): string {
  const [key, setKey] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setKey(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return key;
}

/** Minimal hash router: returns the current route id and a setter. */
export function useHashRoute(defaultId: string): [string, (id: string) => void] {
  // The route is the path portion of the hash; a `?query` (see getHashQueryParam)
  // is ignored here so `#/tire?size=…` still resolves to the "tire" route.
  const read = () => window.location.hash.replace(/^#\/?/, "").split("?")[0] || defaultId;
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (id: string) => {
    window.location.hash = `/${id}`;
  };

  return [route, navigate];
}
