import { useEffect, useState } from "react";

// True while the viewport is at or below the mobile breakpoint (the width at
// which the sidebar becomes a drawer and the page header folds into the top bar).
// Kept in one place so App and the pages that hoist actions into the top bar
// agree on the threshold (mirrors the 720px media query in styles.css).
const MOBILE_QUERY = "(max-width: 720px)";

function matchesMobile(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matchesMobile);
  useEffect(() => {
    // matchMedia is missing in some environments (e.g. jsdom under test); there
    // we just stay on the desktop layout.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
