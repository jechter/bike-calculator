import { fixedFormationLayout } from "../lib/draftingFormation";
import { useEffect, useId, useRef, useState } from "react";
import {
  CDA_FORMATIONS, isRotating,
  type CdaParams,
} from "../lib/cda";

/** A small top-down bike/rider glyph, facing the direction of travel (up). */
function BikeIcon({ you }: { you: boolean }) {
  return (
    <g className={`draft-bike${you ? " draft-bike-you" : ""}`} data-rider={you ? "you" : "other"}>
      <path d="M0 -14v7 M0 8v7 M-8 -7h16 M0 -7v15" className="draft-bike-frame" />
      <path d="M-6 5L-4 -3h8l2 8" className="draft-bike-body" />
      <circle cy="-5" r="4" className="draft-bike-head" />
    </g>
  );
}

export function DraftingPreview({ params: p, compact = false }: { params: CdaParams; compact?: boolean }) {
  const rotating = isRotating(p.formation);
  const layout = fixedFormationLayout(p.formation === "doubleRotating" ? "double" : p.formation, p.draftRiders);
  const total = layout.total;
  const bottom = Math.max(88, 40 + (Math.ceil(total / 2) - 1) * 38);
  const height = rotating ? bottom + 52 : layout.height;
  const width = rotating ? 320 : layout.width;
  const omitted = rotating ? 0 : layout.omitted;
  const pathId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const svg = svgRef.current;
    if (paused || reducedMotion) svg?.pauseAnimations?.();
    else svg?.unpauseAnimations?.();
  }, [paused, reducedMotion, rotating, total]);

  // Through & off: advance up the left lane, peel across at the front, drift
  // back down the right lane, then rejoin. All icons keep facing forward.
  const path = `M136 ${bottom} L136 48 A24 24 0 0 1 184 48 L184 ${bottom} A24 24 0 0 1 136 ${bottom}`;
  const duration = Math.max(8, total * 1.4);
  const moving = rotating && total > 1;
  const name = CDA_FORMATIONS.find(f => f.value === p.formation)?.label ?? "Formation";
  const summary = total === 1 ? "Riding alone" : rotating ? `${total} riders · through & off`
    : p.formation === "line" ? `${total - 1} rider${total === 2 ? "" : "s"} ahead`
    : `${total - 1} other rider${total === 2 ? "" : "s"} · ${total} including you`;
  const label = `${summary}; highlighted rider is you`;
  return (
    <figure className="editor-field-wide drafting-preview">
      <div className="drafting-preview-head">
        <span>Formation · top view</span>
        {moving && !reducedMotion && (
          <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume formation animation" : "Pause formation animation"}>
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${name}: ${label}${omitted ? `; ${omitted} riders omitted from schematic` : ""}`} style={{ height: compact ? 150 : Math.min(220, height) }}>
        <text x="20" y="24" className="draft-direction">↑ Travel</text>
        {moving ? (
          <>
            <defs><path id={pathId} d={path} /></defs>
            <use href={`#${pathId}`} className="draft-loop" />
            {Array.from({ length: total }, (_, i) => (
              <g key={`${total}-${i}`}>
                <animateMotion dur={`${duration}s`} begin={`${-duration * i / total}s`} repeatCount="indefinite" rotate="0" calcMode="paced">
                  <mpath href={`#${pathId}`} />
                </animateMotion>
                <BikeIcon you={i === 0} />
              </g>
            ))}
          </>
        ) : (
          (rotating ? [{ x: 0, y: 0, you: true }] : layout.riders).map((rider, i) => (
            <g key={i} transform={`translate(${width / 2 + rider.x} ${40 + rider.y})`}><BikeIcon you={rider.you} /></g>
          ))
        )}
      </svg>
      <figcaption>
        <span className="draft-you-key">● You</span> · {summary}
        {omitted > 0 && <small>Showing the nearest {layout.riders.length - 1} riders{p.formation === "line" ? " ahead" : " in the formation"}; {omitted} more not shown.</small>}
        {p.formation === "double" && total > 1 && <small>Two abreast · drag modeled by row position.</small>}
        {p.formation === "bunch" && total > 1 && <small>Staggered, widening peloton · illustrative shape, not position-exact drag.</small>}
        {moving && <small>{reducedMotion ? "Motion disabled by your reduced-motion preference. " : ""}Schematic rotation; CdA is averaged over the whole group.</small>}
      </figcaption>
    </figure>
  );
}
