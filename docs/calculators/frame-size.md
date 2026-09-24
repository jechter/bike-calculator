# Frame Size Calculator

Sizes a bike around a rider, and explains *what the numbers mean*. The headline
output is **reach and stack** — the frame-independent fit coordinates — because a
single seat-tube "size" is ambiguous once top tubes slope. Works in **either
direction**:

- **Rider → fit** (default): from body measurements, propose target **reach** &
  **stack**, a starting **saddle height** and **crank length**, and a **nominal
  frame size** for finding the right ballpark to try.
- **Frame → rider** (reverse): a bike lands on the bench — who does it fit? Enter
  the frame's seat-tube size and get back the rider **height** and **inseam**
  band to match against the waiting list.

> These are **starting targets**, not prescriptions. Reach/stack targets bake in
> typical stem / spacer / setback assumptions; brand geometry, flexibility and
> preference all shift them. Confirm with a fit or a test ride.

## Why not just "frame size"?

A single seat-tube number is a weak way to describe a frame:

- **Actual seat tube (centre-to-top)** depends on how far the top tube slopes. A
  compact frame with a steeply sloping top tube has a much shorter c–t than a
  level-top-tube frame that fits the same rider.
- The **effective / virtual seat tube** measures up to where a *horizontal* top
  tube would meet the seat axis (at the head-tube-top height) — always longer
  than the actual, and by definition ≥ the stack (they form a right triangle).
- A manufacturer's **"size" number is neither**: it usually sits somewhere
  *between* the actual and effective lengths, and brands differ — which is why
  many are dropping numbers for S/M/L. So the size number can't be pinned to one
  edge of the geometry; the diagram shows both edges, and the **Frame size** field
  is just the traditional inseam-based ballpark for picking what to try.
- **Reach & stack** are the modern, brand-independent coordinates: the horizontal
  (reach) and vertical (stack) distance from the bottom-bracket centre to the
  top-centre of the head tube. They don't move when the top tube slopes, so they
  compare directly across any two frames — use them to compare real candidates.

## Inputs (rider → fit)

- **Body height** — drives the torso estimate.
- **Cycling inseam** (barefoot, crotch-to-floor with a book pulled up firm) —
  drives saddle height, stack and the effective size.
- **Arm length** (shoulder/acromion to wrist) — with the torso, drives reach.

  Inseam and arm start **empty**, showing a greyed height-based estimate (≈47 %
  and ≈33 % of height) as a placeholder. That estimate is used until you type a
  measured value, so the tool works from height alone but rewards measuring.
- **Bike category** — one picker that merges the old "frame style" and "riding
  position", because they go together in practice: Time trial, Road (aero /
  vintage / endurance), Gravel (race / adventure), Mountain, Hybrid-city. Each
  category carries the inseam→size multiplier, the reach/stack position, and the
  top-tube slope used to draw actual-vs-effective seat tube in the diagram. A
  separate **Vintage** group (road / rigid MTB / city-roadster) covers the
  traditional level-top-tube frames, which share a low stack and got their
  upright position from a tall/long stem rather than frame height. Stack ranks as
  you'd expect — TT lowest, then aero ≈ vintage (a level-top-tube frame is
  inherently fairly low — not more aggressive, just constrained by geometry),
  then endurance/gravel, with MTB and upright city highest. Each category also
  carries a short description (what's distinct about it) and category-specific
  **sizing guidance**, shown under the picker — because what to check differs:
  sporty sloped bikes live and die by reach & stack, upright city bikes mostly
  need the right seat-tube/standover, and vintage bikes have a low frame stack
  but lots of stem adjustment.

Gender isn't asked: what matters is the actual leg, torso and arm lengths, which
the three body inputs already capture.

## Outputs (rider → fit)

- **Reach & stack** (mm), each with a ± ~1-size band, plus the **stack : reach**
  ratio as a shape descriptor (higher = more upright).
- **Frame size** (cm) — the nominal, inseam-based ballpark (with a range and the
  nominal S/M/L, plus inches for MTB) and a note explaining it's a label, not a
  geometric length.
- **Saddle height** (LeMond, `inseam × 0.883`, BB centre → saddle top).
- **Crank length** suggestion (range + nearest available size).
- **Wheel size** — the standard that fits the frame's style *and* size (see below),
  shown with its ISO/ETRTO bead diameter and drawn to scale in the diagram.

## Formulas (approximate, calibrated rules of thumb)

Let `H` = height, `I` = inseam, `A` = arm (cm).

### Body segments

```
torso_cm ≈ H × 0.818 − I               (shoulder/acromion height − inseam, floored at 0)
arm_cm   ≈ H × 0.33 + 0.3 × (I − 0.47 × H)   (prefill; from height *and* inseam)
```

The arm estimate starts from height (≈0.33 × H) and nudges for build: legs longer
than the height-average pair with slightly longer arms (both are long-bone
traits), so typing a measured inseam sharpens the arm guess too. With an average
inseam the term vanishes and it's just 0.33 × H.

### Reach & stack (mm)

Reach scales with the forward-reaching segments (torso + arm); the category's
`reachBase` shifts it longer (race) or shorter (upright). Stack is the vertical
rise of the seat tube plus the category's `frontEndRise` (how high the front end
sits above the classic seat-tube top). This ties stack to the geometry and
matches real frames — a 56 cm endurance frame ≈ 590 mm stack; a level-top-tube
race frame sits *below* its own frame size (the seat tube, being the hypotenuse,
is longer than its vertical rise).

```
reach_mm ≈ 0.25 × (torso_cm + arm_cm) × 10 + reachBase[category]
stack_mm ≈ (I × 10 × sizeMult[category]) × sin(73°) + frontEndRise[category]
```

`sizeMult` ≈ 0.665 for road/gravel, 0.63 for city, 0.57 for MTB. `reachBase`
runs ~45 (upright) to ~118 (TT). `frontEndRise` is how high the front end (head-
tube top) sits above the seat cluster of a level frame — small for TT/race, tall
for MTB/upright. In real frames that height is carried by a **longer head tube**
(and, on MTBs, a longer/suspension fork), not by head tube above the top tube,
which stays within ~1 cm; more of the relaxed position still comes from spacers
and taller stems above the frame. Shown as a band (reach ±12 mm, stack ±15 mm).

### Frame size & saddle height

```
frame size (cm)                     ≈ I × sizeMult[category]   (road 0.665 … mtb 0.57)
saddle height (BB → saddle top, cm)  = I × 0.883               (LeMond)
```

The multipliers are the widely-used inseam rules of thumb (Hinault/LeMond
lineage). The frame size is a **nominal label**, not a geometric length: a real
frame's "size" sits between its actual and effective seat-tube lengths (both
shown, to scale, in the diagram). Nominal XS/S/M/L is derived from the **rider's
inseam** (body size), not the scaled size, so a given rider gets the same nominal
label on a road bike or an MTB.

## Reverse: frame → who it fits

The workshop case: a donated frame plus a waiting list. Every forward size
formula is a straight multiply, so the reverse is a divide.

```
inseam_cm   = frame_cm ÷ category_multiplier          (e.g. road ÷ 0.665)
inseam band = (frame_cm ± 1.5) ÷ category_multiplier   (forward ±1.5 cm range, inverted)
height_cm   = inseam_cm ÷ leg_proportion               (default ≈ 0.47)
```

- **Input**: frame size read at the bench — seat-tube cm for most bikes, or
  inches for MTB frames (× 2.54 first). The category still matters: the same
  seat-tube cm belongs to a longer leg on an MTB than on a road bike.
- **Output**: a rider **height** band and **inseam** band, the nominal S/M/L and
  a starting saddle height. Match the list on **inseam** — it's the reliable
  figure; the height band slides with leg proportion. The diagram illustrates the
  central rider this frame is built around (endurance position).

## Crank length suggestion

No consensus formula, so present a range and lean toward available sizes (~2.5 mm
steps). From inseam `I` (cm):

```
crank_mm ≈ I × 1.25 + 65
crank_mm ≈ I × 10 × 0.216
```

Show the spanning range and snap the midpoint to the nearest available size.
Recent fitting trends favour **shorter** cranks; also mind pedal/ground clearance
and knee comfort. Feeds the [drivetrain gain-ratio calc](drivetrain.md).

## Diagram

An inline SVG (like the other calculators, not a static image) draws a diamond
frame to scale from the computed numbers. **Stack** (blue) rises straight from
the bottom bracket and **reach** (red) runs forward from the top of it to the
head-tube top, so the two together place the head tube exactly as the numbers do.
The top tube ends at the top of the head tube (no head tube drawn above it). From
there, two seat-tube lengths are shown in two shades of green:

- the **actual seat tube** (dark green) — to where the real *sloping* top tube
  meets the seat axis (shorter);
- the **effective / virtual seat tube** (light green) — to where a *horizontal*
  top tube would meet it, at the head-tube-top height (longer, and ≥ stack).

A frame's marketing "size" lives somewhere between the two, so it isn't drawn.
The top tube meets the head tube ~1 cm below its top (as real frames do). Each
category picks one of three **geometry styles**:

- **classic** — level top tube (slope 0), so the two green lengths coincide
  (vintage);
- **sloping** — a sloping top tube; the head tube runs *down* to a roughly fixed
  rigid-fork crown, so a higher-stack frame is drawn with a longer head tube
  (most modern bikes);
- **suspension** — a longer fork raises the crown, so the head tube stays short
  even with a tall front end, drawn with a stanchion + lowers (mountain bikes).

A **crank arm** (violet) pivots at the bottom bracket, drawn to scale at the
suggested crank length with a pedal across its end and the length labelled, so
the crank suggestion is shown in the geometry too.

To the **left**, a front-view cyclist is drawn to scale on the same ground line,
with dimension lines for the three body inputs so the measurements driving the
fit are visible: **body height** (cyan, full height), **cycling inseam** (pink,
ground to crotch) and **arm length** (amber, shoulder to wrist) — each with its
own colour, echoed as a dot on the matching input. Every measurement label shows
its value at a consistent size, and **hovering or editing a value in the UI
highlights the matching measurement** in the diagram (thicker line, coloured
glow, larger label). The figure is a
vectorized (potrace) line-art illustration in `src/components/cyclistFigure.ts`,
scaled so its ink height equals the rider's body height. It is **split into three bands that are vertically scaled independently** — legs
(feet→crotch) span the actual **inseam**, the torso (crotch→neck) takes up the
slack, and the **head (neck→top) keeps its natural size** — so inseam reshapes
only the legs and torso: a longer inseam draws longer legs and a shorter torso,
and vice versa (widths keep the uniform scale; the splits are seamless). The
**arms** (bare forearms + hands, traced as a separate piece cut at the sleeve
hem) hang from the sleeve line and **scale vertically with arm length**,
independent of the body. The dimension lines are labelled with the entered
values. In "identify a frame" mode it illustrates the representative rider the
frame fits.

### Wheel size

`wheelForFrame(category, frameCm)` (in `frameSize.ts`) picks the wheel a frame of
this **style and size** would really be built with. Style sets the standard —
700c for road/gravel/TT, 29" for trail, 27" for vintage road, 26" for vintage
MTB, 28" for a roadster — and size then shifts it where the industry does: the
smallest road/gravel frames drop to **650b**, and the smallest trail frames drop
from 29" to **27.5"**. Below the adult range the ladder continues down through
the **kids' sizes** — **24" → 20" → 16" → 14" → 12"** — chosen by the rider's
cycling inseam (`frameCm ÷ the category multiplier`) so a small "road" and a
small "mtb" frame of the same-sized child land on the same wheel. Each `Wheel`
carries the common name, the ISO/ETRTO bead diameter, and an approximate outer
diameter with a typical tyre, so the diagram draws the wheels to scale (a 29"
wheel is visibly taller than a 26", and a 12" a fraction of either). The value is
shown in the results (name + ISO), labelled on the front wheel, and — like the
other measurements — highlights in the diagram when hovered/edited.

The frame parts that depend on the wheel — **BB drop, chainstay length, fork rake
and fork-crown height** — scale with the wheel radius in the diagram (tuned so a
700c wheel reproduces the original numbers), so a small wheel gets a
correspondingly short fork and stays instead of a big-wheel frame drawn around a
tiny wheel.

(To fit children, the body-measurement minimums go down to a 100 cm rider / 38 cm
inseam, and the crank list starts at kids' lengths — 102 mm and up.)

### Seated riding position

The same diagram also poses an approximate **capsule rider on the bike** to show
**how the rider would sit on it**. The three contact points come from the
geometry plus the **cockpit** — `cockpitForFrame(category, frameCm)` in
`frameSize.ts`. A per-category base (`COCKPITS`, defined for the category's
average frame) sets the stem rise, bar type and hand reach/drop; the **stem
length and spacer stack then scale with frame size** — a bigger frame gets a
longer stem and fewer spacers (its head tube is already taller), a smaller frame
the reverse — snapped to the usual 10 mm / 5 mm increments. The stem length + rise,
spacers and bar reach/drop place the **handlebar grip** (drawn up the steerer →
along the stem → out to the hands); the saddle gives the **hips**; the
crank/pedal gives the **foot**. The knee is solved with two-bone IK; segment
lengths come from the body measurements.

The **same resolved cockpit** is passed into the diagram *and* shown in the
"Cockpit (typical)" results, so the quoted stem/spacers always match the stem
drawn on the bike, and both move as the frame size changes.

A **posture slider** under the diagram sets how aggressively the rider sits, from
**arms fully straight** (0, upright) to the most aggressive position (1). Both
keep the hips at the saddle and the hands on the bar; only the torso lean, elbow
bend and (on drop/TT bars) the hand position change.

- **Hand positions.** Drop bars carry three (**tops → hoods → drops**) and TT
  bars two (**base bar → aero extensions**), derived from the cockpit's primary
  hand position; flat bars have one. You can't grip between them, so the slider
  is split into equal bands and the hand **snaps** to one — the more aggressive,
  the lower/more-forward — with the inactive positions shown as open dots.
- **Torso lean.** For the current grip we find the lean for a straight arm
  (shoulder a full arm from the grip) and for the aggressive extreme, then
  interpolate; the elbow follows by IK. The aggressive extreme is a **forearm
  parallel to the ground, OR a 60° elbow, whichever is reached first** — some
  geometries can't reach a level forearm without over-bending the elbow.

Like the rest of the fit model, the cockpit numbers are **hand-picked
approximations**, meant to visualise the position, not spec it.
