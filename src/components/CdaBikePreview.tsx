import { BikePositionDiagram, type ReclinedBikeStyle } from "./BikePositionDiagram";
import type { ReactNode } from "react";
import {
  findCategory, fitTargets, cockpitForFrame, wheelForFrame,
  suggestCrankLength,
} from "../lib/frameSize";
import { CDA_POSITIONS, bikeByValue, type CdaBike, type CdaParams } from "../lib/cda";

// CdA presets map to the same geometry and cockpit data as the frame-size tool.
const CATEGORY: Partial<Record<CdaBike, string>> = {
  road: "road-aero", endurance: "road-endurance", gravel: "gravel-adventure",
  tt: "tt", city: "city", mtb: "mtb",
};
const POSTURE: Partial<Record<CdaParams["position"], number>> = {
  tops: 0, hoods: 0.4, drops: 0.7, dropsLow: 1,
  clipOnAero: 1, upright: 0, flatForward: 0.7, aeroTuck: 1, baseBar: 0,
};

export function CdaBikePreview({ params: p }: { params: CdaParams }) {
  const categoryId = CATEGORY[p.bike];
  const description = `${bikeByValue(p.bike).label} · ${CDA_POSITIONS[p.position].label}`;
  if (!categoryId) {
    const kind: ReclinedBikeStyle = p.bike === "velomobile" ? "velomobile"
      : p.position === "lowracer" || p.position === "lowracerTail" ? p.position : "highracer";
    return (
      <PreviewFigure description={description}>
        <BikePositionDiagram kind={kind} heightCm={p.heightCm} label={description} />
      </PreviewFigure>
    );
  }
  const category = findCategory(categoryId);
  const heightCm = Math.max(120, Math.min(210, p.heightCm));
  // Height is the only body measurement in CdA; use typical proportions, not a fit claim.
  const inseamCm = heightCm * 0.47;
  const armCm = heightCm * 0.331;
  const fit = fitTargets({ heightCm, inseamCm, armCm, category });
  const frameCm = inseamCm * category.sizeMult;
  const cockpit = cockpitForFrame(category, frameCm);
  const aero = p.position === "clipOnAero";
  const wheel = wheelForFrame(category, frameCm);
  return (
    <PreviewFigure description={description}>
      <BikePositionDiagram kind="upright" frame={{
        compact: true,
        label: `${description}: approximate bike and rider side view`,
        reachMm: fit.reachMm,
        stackMm: fit.stackMm,
        topTubeSlopeDeg: category.topTubeSlopeDeg,
        geometry: category.geometry,
        saddleHeightMm: fit.saddleHeightCm * 10,
        crankLengthMm: suggestCrankLength(inseamCm).suggestedMm,
        bodyHeightMm: heightCm * 10,
        inseamMm: inseamCm * 10,
        armLengthMm: armCm * 10,
        cockpit: aero ? { ...cockpit, bar: "aero", gripFwdMm: 155, gripDropMm: -8 } : cockpit,
        wheelRadiusMm: wheel.outerMm / 2,
        posture: POSTURE[p.position] ?? 0,
      }} />
    </PreviewFigure>
  );
}

function PreviewFigure({ description, children }: { description: string; children: ReactNode }) {
  return (
    <figure className="editor-field-wide cda-bike-preview">
      <div className="drafting-preview-head">Riding position</div>
      {children}
      <figcaption>{description}</figcaption>
    </figure>
  );
}
