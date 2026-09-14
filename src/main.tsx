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

// When embedded in a cross-origin iframe (e.g. the Rückenwind WordPress page),
// the parent can't read our height directly. Post our content height out so the
// host page can resize the iframe to fit — no inner scrollbar needed.
if (window.parent !== window) {
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

  // Config sharing: learn the host page URL and mirror our config hash to it, so
  // the "Copy link" button can share a link that opens the embedded page.
  initEmbedBridge();
}
