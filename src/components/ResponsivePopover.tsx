import { createElement, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from "react";

const MARGIN = 8;
const GAP = 6;

export function popupPlacement(anchor: { top: number; bottom: number; right: number }, size: { width: number; height: number }, viewport: { left: number; top: number; width: number; height: number }) {
  const leftEdge = viewport.left + MARGIN;
  const topEdge = viewport.top + MARGIN;
  const availableWidth = Math.max(1, viewport.width - 2 * MARGIN);
  const availableHeight = Math.max(1, viewport.height - 2 * MARGIN);
  const below = anchor.bottom + GAP;
  const width = Math.min(size.width, availableWidth);
  const height = Math.min(size.height, availableHeight);
  const left = Math.max(leftEdge, Math.min(anchor.right - width, leftEdge + availableWidth - width));
  const top = Math.max(topEdge, Math.min(below, topEdge + availableHeight - height));
  // Keep the preferred dimensions. Only constrain content that cannot fit
  // anywhere in the viewport; moving above the field is not a reason to grow.
  const mode = size.height > availableHeight ? "screen" as const
    : top !== below || size.width > availableWidth ? "floating" as const : "anchored" as const;
  return { mode, left, top, width, height: size.height > availableHeight ? availableHeight : undefined };
}

const openPopups: HTMLElement[] = [];
let locks = 0;
let previousOverflow = "";
function lockPage() {
  if (locks++ === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  return () => { if (--locks === 0) document.body.style.overflow = previousOverflow; };
}

/** Shared viewport-aware popup. Native popover top-layer keeps it out of clipped
 * scrolling columns without a portal, preserving existing outside-click refs. */
export function ResponsivePopover({ as = "div", children, className = "", onClose, ownCloseButton = false, anchorRef, ...attributes }: HTMLAttributes<HTMLElement> & {
  as?: "div" | "ul";
  children: ReactNode;
  onClose: () => void;
  ownCloseButton?: boolean;
  anchorRef?: RefObject<HTMLElement>;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [popupMode, setPopupMode] = useState<"anchored" | "floating" | "screen">("anchored");
  const screen = popupMode === "screen";
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anchor = anchorRef?.current ?? el.parentElement;
    if (!anchor) return;
    const trigger = anchor.matches("button") ? anchor : anchor.querySelector<HTMLElement>("button[aria-expanded], button");
    let release: (() => void) | undefined;
    let frame = 0;
    let mode: "anchored" | "floating" | "screen" = "anchored";
    // Native top-layer support also handles transformed/sticky ancestors.
    el.showPopover?.();
    openPopups.push(el);
    const place = () => {
      const vv = window.visualViewport;
      const viewport = { left: vv?.offsetLeft ?? 0, top: vv?.offsetTop ?? 0, width: vv?.width ?? window.innerWidth, height: vv?.height ?? window.innerHeight };
      // Measure at its ordinary width and uncapped height, even after screen mode.
      el.dataset.popupMode = "anchored";
      Object.assign(el.style, { width: "", height: "", maxHeight: "none", minWidth: "", left: "0px", top: "0px" });
      let natural = el.getBoundingClientRect();
      // If width is constrained, remeasure the reflowed content before deciding
      // whether it needs a height cap (including a phone's keyboard viewport).
      const maxWidth = Math.max(1, viewport.width - MARGIN * 2);
      if (natural.width > maxWidth) {
        Object.assign(el.style, { width: `${maxWidth}px`, minWidth: "0px" });
        natural = el.getBoundingClientRect();
      }
      const placement = popupPlacement(anchor.getBoundingClientRect(), natural, viewport);
      mode = placement.mode;
      el.dataset.popupMode = mode;
      Object.assign(el.style, { left: `${placement.left}px`, top: `${placement.top}px`, width: `${placement.width}px`, height: placement.height === undefined ? "" : `${placement.height}px`, minWidth: "0px", maxHeight: `${Math.max(1, viewport.height - MARGIN * 2)}px` });
      setPopupMode(mode);
      if (mode === "screen" && !release) {
        release = lockPage();
        if (!el.contains(document.activeElement)) {
          (el.querySelector<HTMLElement>("button, input, select, [tabindex]") ?? el).focus({ preventScroll: true });
        }
      } else if (mode !== "screen" && release) { release(); release = undefined; }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
    const onScroll = (e: Event) => { if (!(e.target instanceof Node) || !el.contains(e.target)) schedule(); };
    const onKey = (e: KeyboardEvent) => {
      if (openPopups[openPopups.length - 1] !== el) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close.current(); }
      if (e.key !== "Tab" || mode !== "screen") return;
      const focusable = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')].filter(n => n.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { e.preventDefault(); el.focus(); }
      else if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    const onOutside = (e: MouseEvent) => {
      if (openPopups[openPopups.length - 1] !== el) return;
      if (e.target instanceof Node && !anchor.contains(e.target) && !el.contains(e.target)) close.current();
    };
    place();
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    resize?.observe(el);
    resize?.observe(anchor);
    const mutation = new MutationObserver(schedule);
    mutation.observe(el, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", onScroll, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      cancelAnimationFrame(frame);
      const index = openPopups.indexOf(el);
      if (index !== -1) openPopups.splice(index, 1);
      resize?.disconnect(); mutation.disconnect(); release?.();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
      if (el.hidePopover && el.matches(":popover-open")) el.hidePopover();
      if (el.contains(document.activeElement) || document.activeElement === document.body) trigger?.focus({ preventScroll: true });
    };
  }, [anchorRef]);
  const dismiss = screen && !ownCloseButton ? createElement(as === "ul" ? "li" : "div", { className: "responsive-popup-dismiss" }, <button type="button" aria-label="Close popup" onClick={onClose}>Close ×</button>) : null;
  return createElement(as, { ...attributes, ref, popover: "manual", tabIndex: -1, className: `${className} responsive-popup`, "data-popup-mode": popupMode }, dismiss, children);
}
