import { useEffect, useRef, useState } from "react";
import { getShareUrl } from "../embed";

/**
 * Copies a link to the current config. The page keeps its config in the URL hash
 * (see useUrlConfigSync); when embedded in a host page, getShareUrl() returns the
 * host's URL with that hash so the link opens the embedded page, not the bare
 * iframe.
 *
 * Clipboard access can be denied in a cross-origin iframe (the host must grant
 * `allow="clipboard-write"`). We try the async Clipboard API, fall back to a
 * legacy execCommand copy, and if both fail reveal the link in a selected field so
 * it can still be copied by hand.
 */
export function CopyLinkButton() {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  const manualRef = useRef<HTMLInputElement>(null);

  // Auto-select the fallback field so a plain Cmd/Ctrl+C works.
  useEffect(() => {
    if (status === "manual" && manualRef.current) {
      manualRef.current.focus();
      manualRef.current.select();
    }
  }, [status]);

  const copy = async () => {
    const link = getShareUrl();
    setUrl(link);
    if (await copyText(link)) {
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } else {
      setStatus("manual");
    }
  };

  return (
    <div className="copy-link">
      <button
        type="button"
        className={"copy-link-btn" + (status === "copied" ? " copied" : "")}
        onClick={copy}
        title="Copy a link to this configuration"
      >
        {status === "copied" ? "✓ Link copied" : "🔗 Copy link"}
      </button>
      {status === "manual" && (
        <input
          ref={manualRef}
          className="copy-link-manual"
          type="text"
          readOnly
          value={url}
          aria-label="Link to this configuration — copy it"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}

/** Copy `text`, trying the async Clipboard API then a legacy fallback. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path (e.g. clipboard permission denied).
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
