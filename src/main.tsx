import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { initEmbedBridge } from "./embed";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

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
if (window.parent !== window) {
  const fillViewport =
    new URLSearchParams(window.location.search).get("embed") === "fill";

  if (!fillViewport) {
    // Size to content instead of the viewport so the iframe can shrink as well as
    // grow (see html.embedded rules in styles.css).
    document.documentElement.classList.add("embedded");
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
