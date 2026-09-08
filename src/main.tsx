import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
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
