import { useEffect, useState } from "react";

// True while the viewport is below the "compact" breakpoint — the width at which
// the desktop sidebar rail + two-column workbench (settings beside visualization)
// no longer fit, so the app switches to the compact layout: the nav and the
// workbench settings become left-edge drawers opened from tabs, with the
// visualization as the primary view. Kept in one place so every piece agrees on
// the threshold (mirrors the 1199px media queries in styles.css).
//
// (Named "isMobile" historically; it now means "compact layout", which also
// covers tablets and narrow desktop windows.)
const COMPACT_QUERY = "(max-width: 1199px)";

function matchesCompact(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  // Auto-height embeds (see main.tsx) size to content and can't host the
  // position:fixed drawers, so they always use the full in-flow layout.
  if (document.documentElement.classList.contains("embedded")) return false;
  return window.matchMedia(COMPACT_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matchesCompact);
  useEffect(() => {
    // matchMedia is missing in some environments (e.g. jsdom under test); there
    // we just stay on the desktop layout.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setIsMobile(matchesCompact());
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
