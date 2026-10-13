import { useEffect, useState, type MouseEvent } from "react";
import { isEmbedded, notifyConfigChanged } from "./embed";
import routes from "./routes.json";

const NAVIGATION = "bikecalc:navigate";
const legacyRoute = () => {
  const match = window.location.hash.match(/^#\/?([^?]+)(?:\?(.*))?$/);
  return match && routes.some(r => r.id === match[1]) ? match : null;
};

/** Infer the installation directory, including when opened on a nested page. */
export function getBasePath(): string {
  const path = window.location.pathname.replace(/index\.html$/, "");
  const page = routes.find(r => path.endsWith(`/${r.slug}/`) || path.endsWith(`/${r.slug}`));
  if (page) return path.slice(0, path.lastIndexOf(`/${page.slug}`) + 1);
  return path.endsWith("/") ? path : path + "/";
}

export function routeHref(id: string): string {
  if (isEmbedded()) return `#/${id}`;
  const page = routes.find(r => r.id === id) ?? routes[0];
  return `${getBasePath()}${page.slug}/`;
}

function currentRoute(): string {
  const legacy = legacyRoute();
  if (legacy) return legacy[1];
  const path = window.location.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "");
  return routes.find(r => path.endsWith(`/${r.slug}`))?.id ?? routes[0].id;
}

/** Retain the old function names for calculator consumers and legacy links. */
export function getHashQueryParam(name: string): string | null {
  return getHashQuery().get(name);
}
export function getHashQuery(): URLSearchParams {
  const legacy = legacyRoute();
  return new URLSearchParams(legacy ? legacy[2] ?? "" : window.location.search);
}
export function buildHash(routeId: string, params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") usp.set(k, String(v));
  }
  const q = usp.toString();
  return `#/${routeId}${q ? "?" + q : ""}`;
}

/** Migrate old bookmarks without losing their configuration or adding history. */
export function normalizeRoute(): void {
  if (isEmbedded()) return;
  const id = currentRoute();
  const query = getHashQuery().toString();
  const anchor = legacyRoute() ? "" : window.location.hash;
  history.replaceState(null, "", routeHref(id) + (query ? `?${query}` : "") + anchor);
}

export function navigateTo(id: string, params?: Record<string, unknown>): void {
  const hash = buildHash(id, params ?? {});
  if (isEmbedded()) {
    window.location.hash = hash;
    return;
  }
  const qi = hash.indexOf("?");
  history.pushState(null, "", routeHref(id) + (qi < 0 ? "" : hash.slice(qi)));
  window.dispatchEvent(new Event(NAVIGATION));
}

/** Enhance ordinary internal-link clicks without breaking native link behavior. */
export function handleRouteLinkClick(event: MouseEvent<HTMLAnchorElement>): void {
  const link = event.currentTarget;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || link.hasAttribute("download") ||
      (link.target && link.target !== "_self")) return;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  // Embedded links already use native hash navigation and need no interception.
  if (isEmbedded()) return;
  if (!routes.some(r => url.pathname === `${getBasePath()}${r.slug}/`)) return;
  event.preventDefault();
  if (url.href === window.location.href) return;
  history.pushState(null, "", url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(NAVIGATION));
}

function subscribe(onChange: () => void): () => void {
  const handle = () => { normalizeRoute(); onChange(); };
  window.addEventListener("hashchange", handle);
  window.addEventListener("popstate", handle);
  window.addEventListener(NAVIGATION, handle);
  return () => {
    window.removeEventListener("hashchange", handle);
    window.removeEventListener("popstate", handle);
    window.removeEventListener(NAVIGATION, handle);
  };
}

/** Debounced replaceState keeps shared settings current without history spam. */
export function useUrlConfigSync(routeId: string, params: Record<string, unknown>): void {
  const hash = buildHash(routeId, params);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (currentRoute() !== routeId) return;
      if (isEmbedded()) history.replaceState(null, "", hash);
      else {
        const qi = hash.indexOf("?");
        history.replaceState(null, "", routeHref(routeId) + (qi < 0 ? "" : hash.slice(qi)) + window.location.hash);
      }
      notifyConfigChanged();
    }, 200);
    return () => window.clearTimeout(id);
  }, [hash, routeId]);
}

/** Only navigation remounts a configured page; editing inputs does not. */
export function useHashConfigKey(): string {
  const [key, setKey] = useState(() => window.location.href);
  useEffect(() => subscribe(() => setKey(window.location.href)), []);
  return key;
}

export function useHashRoute(_defaultId: string): [string, (id: string) => void] {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    normalizeRoute();
    return subscribe(() => setRoute(currentRoute()));
  }, []);
  return [route, navigateTo];
}

export function updatePageMetadata(id: string): void {
  const page = routes.find(r => r.id === id) ?? routes[0];
  document.title = `${page.title} | Rückenwind`;
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!description) {
    description = document.createElement("meta");
    description.name = "description";
    document.head.append(description);
  }
  description.content = page.description;
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = `https://rueckenwind.berlin/bikeworkshopcalc/${page.slug}/`;
}
