import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initEmbedBridge, isEmbedded } from "./embed";
import "./styles.css";

// When embedded in a cross-origin iframe (e.g. the Rückenwind WordPress page)
// there are two modes:
//
//  - Fill mode (host adds `?embed=fill` to the iframe src): the host gives us a
//    real, window-sized viewport and lets us scroll internally, so we behave
//    exactly like standalone — the 100vh adaptive layouts react to window
//    resizes. We only wire up config/share-link mirroring.
//  - Auto-height mode (default, older hosts): the host can't give us a fixed
//    height, so we size to content and post our height out for it to resize the
//    iframe to fit — no inner scrollbar, but the layout can't be viewport-driven.
//
// The mode class is set BEFORE the first render so useIsMobile sees it on mount
// (auto-height embeds can't host the fixed-position compact drawers, so they
// always use the in-flow layout — see useIsMobile).
// Embedding is opt-in; an ordinary preview iframe must still use real URLs.
const embedded = isEmbedded();
const fillViewport =
  embedded && new URLSearchParams(window.location.search).get("embed") === "fill";
if (embedded) {
  document.documentElement.classList.add(fillViewport ? "embed-fill" : "embedded");
}

// Launched from the home screen as a fullscreen web app: the bottom bar needs
// extra room for the rounded screen corners and the home indicator / gesture
// bar (see html.standalone in styles.css). `navigator.standalone` is iOS-only.
if (
  window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone
) {
  document.documentElement.classList.add("standalone");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (embedded) {
  if (fillViewport) {
    // The host mounts us as a fixed full-window overlay (class already set above);
    // html.embed-fill in styles.css stops overscroll chaining to the host page.
  } else {
    // Size to content instead of the viewport so the iframe can shrink as well as
    // grow (see html.embedded rules in styles.css).
    const postHeight = () => {
      const height = Math.ceil(
        document.documentElement.getBoundingClientRect().height,
      );
      window.parent.postMessage({ type: "bikecalc:height", height }, "*");
    };
    new ResizeObserver(postHeight).observe(document.documentElement);
    window.addEventListener("load", postHeight);
    // Let the host request a fresh measurement (e.g. right after it loads).
    window.addEventListener("message", (e) => {
      if (e.data?.type === "bikecalc:request-height") postHeight();
    });
    postHeight();
  }

  // Config sharing: learn the host page URL and mirror our config hash to it, so
  // the "Copy link" button can share a link that opens the embedded page.
  initEmbedBridge();
}
