# Cellular Automata - Conway's Game of Life

**Purpose:** Reference for the three artificial-life simulations on this site, and the body of knowledge behind them — rules, patterns, computation, rule-space, recursion, particle dynamics, and the algorithms that make large simulations possible.

**Audience:** Anyone reading the source of `ConwayLife.js`, `Lenia.js`, `ParticleLife.js`, `LifeView.js` or `LifePatterns.js` — or curious how a four-line rule ends up being Turing complete.

---

## Sourcing Note — read this before trusting anything below

This document was assembled from six sources supplied as links. **None of their transcripts or descriptions could be retrieved** — YouTube served only page chrome, and Reddit refused the request outright. Only the titles were readable:

| # | Title as shown | Topic it fixes |
|:--|:--|:--|
| 1 | *Programming Conway's Game of Life \| Coding Challenge* | implementation from scratch |
| 2 | *Let's BUILD a COMPUTER in CONWAY's GAME of LIFE ⠠⠵* | universality, logic gates |
| 3 | *The Conway Multiverse* | rule space beyond B3/S23 |
| 4 | *How I released a game that has no assets* | generative content, zero bytes |
| 5 | *Atoms of atoms in an infinite recursion in…* (Reddit) | metapixel / Life in Life |
| 6 | *Huge 2^64 Conway's Game Of Life Sim, using Sparse Encoding* | scale, sparse representation |

So: **the videos set the syllabus; they are not the citation.** Everything factual below comes from the established literature (Gardner's original column, the LifeWiki/conwaylife.com corpus, and the primary discoveries named inline), all of which is independently checkable. Nothing here is a paraphrase of a video that was not read.

Where a figure is one I am confident of, it is stated plainly. Where it is not, it says so.

---

## Table of Contents

1. [The Rule](#1-the-rule)
2. [B/S Notation](#2-bs-notation)
3. [Pattern Taxonomy](#3-pattern-taxonomy)
4. [Why It Computes](#4-why-it-computes)
5. [The Multiverse of Rules](#5-the-multiverse-of-rules)
6. [Life Inside Life](#6-life-inside-life)
7. [Making It Fast](#7-making-it-fast)
7b. [Off the Grid — Particle Life](#7b-off-the-grid--particle-life)
8. [Zero Assets](#8-zero-assets)
9. [How This Site Implements It](#9-how-this-site-implements-it)

---

## 1. The Rule

Devised by **John Horton Conway** in 1970 and popularised by **Martin Gardner** in *Scientific American*, October 1970.

An infinite orthogonal grid of cells, each alive or dead. Every cell looks at its **eight** neighbours (the Moore neighbourhood) and the whole grid updates **simultaneously**:

| Current | Live neighbours | Next |
|:--|:--|:--|
| alive | 0 or 1 | dead (underpopulation) |
| alive | **2 or 3** | **alive** |
| alive | 4+ | dead (overpopulation) |
| dead | **exactly 3** | **alive** (birth) |

That is the entire specification. Everything in the rest of this document is a consequence of those four lines.

> **The simultaneity is not a detail.** Every cell must read the *previous* generation. Updating in place — letting a cell see neighbours that have already moved — produces a different automaton entirely, and it is the single most common bug in a first implementation. Double-buffering is not an optimisation here; it is the rule.

---

## 2. B/S Notation

Life generalises to `B<births>/S<survivals>`: the neighbour counts that create a cell, and those that let one persist.

Conway's Life is **B3/S23** — born on exactly 3, survives on 2 or 3.

This notation is what makes §5 possible: change the digits and you get a different universe with the same machinery. The implementation here stores both sets as **9-bit masks** (one bit per possible neighbour count, 0–8), so the rule is two integers and switching universes costs nothing.

---

## 3. Pattern Taxonomy

Patterns are classified by what they do over time.

### Still lifes — period 1, never change

| Name | Cells |
|:--|--:|
| Block | 4 |
| Tub | 4 |
| Boat | 5 |
| Beehive | 6 |
| Loaf | 7 |

The block is the simplest: a 2×2 square where every live cell has exactly 3 live neighbours, and every adjacent dead cell has at most 2. Perfectly balanced against both rules.

### Oscillators — return to their start after *p* generations

| Name | Period |
|:--|--:|
| Blinker | 2 |
| Toad | 2 |
| Beacon | 2 |
| Pulsar | 3 |
| Pentadecathlon | 15 |

The blinker is three cells in a row: the ends die of underpopulation, two cells above and below the centre are born, and it flips between horizontal and vertical forever.

### Spaceships — translate across the grid

| Name | Period | Speed | Direction |
|:--|--:|:--|:--|
| Glider | 4 | c/4 | diagonal |
| LWSS (lightweight spaceship) | 4 | c/2 | orthogonal |
| MWSS / HWSS | 4 | c/2 | orthogonal |

"c" is the speed of light in the automaton — one cell per generation, the maximum at which information can propagate. A glider moves **one cell diagonally every four generations**, hence c/4. It is the smallest and by far the most important spaceship, because it is how Life moves *information* (§4).

### Guns — emit spaceships forever

The **Gosper glider gun** (Bill Gosper, November 1970) is a period-30 oscillator that releases a glider every 30 generations. It was the first pattern proven to grow without bound, and it won Conway's $50 prize for exactly that.

Unbounded growth mattered because Conway had conjectured no pattern could grow forever. The gun disproved it, and in doing so supplied the component that makes computation possible.

### Methuselahs — tiny patterns with long, chaotic lives

| Name | Cells | Stabilises at generation |
|:--|--:|--:|
| R-pentomino | 5 | 1,103 |
| Acorn | 7 | 5,206 |
| Diehard | 7 | 130 (vanishes completely) |

Five cells running for over a thousand generations is the clearest demonstration that Life is not predictable by inspection. There is no shortcut: to know what the R-pentomino does, you run it.

---

## 4. Why It Computes

**Conway's Game of Life is Turing complete.** Anything a computer can compute, a sufficiently large Life pattern can compute.

The construction, in the order the pieces are needed:

1. **A signal.** A glider is a discrete packet that travels a straight line at a known speed. Present = 1, absent = 0.
2. **A clock.** A glider gun emits at a fixed period, giving a timebase.
3. **Logic.** Two gliders colliding at the right angle and phase annihilate each other. That single fact gives NOT (a stream deletes a probe), AND, and OR — and NAND alone is functionally complete, so everything else follows.
4. **Memory.** Still lifes store state; eaters absorb unwanted output; loops of circulating gliders hold values.
5. **Wiring.** Distance and phase are the routing. Timing *is* the circuit — a wire that is one cell too long changes the collision phase and breaks the gate.

From those, people have built real machines inside Life. **Paul Rendell** constructed a Turing machine (first version 2000, a universal one in 2010). Later community projects built increasingly complete computers, culminating in patterns that run programs.

> **The point worth taking away:** nothing was added to the rules. Universality was already present in B3/S23 in 1970; it took decades to *find* the arrangement. A rule and its consequences are separated by an enormous amount of search.

---

## 5. The Multiverse of Rules

B3/S23 is one point in a space of 2^9 × 2^9 = **262,144** possible birth/survival rules on the Moore neighbourhood. Most are boring: they die instantly or fill the grid. A few are as rich as Life.

| Rule | Name | Character |
|:--|:--|:--|
| **B3/S23** | Life | the balanced case |
| **B36/S23** | HighLife | as Life, plus a genuine **replicator** that copies itself |
| **B3678/S34678** | Day & Night | symmetric under swapping alive/dead — patterns work identically on a live background |
| **B2/S** | Seeds | nothing ever survives; every cell dies each step and is replaced by births. Violently explosive |
| **B3/S012345678** | Life without Death | nothing ever dies. Grows monotonically, produces "ladders" |
| **B3/S12345** | Maze | grows into stable maze-like corridors |
| **B1357/S1357** | Replicator | every pattern reproduces itself |

Two directions lead out of the table:

- **Larger neighbourhoods** — take the radius past 1 and you reach *Larger than Life*, where the rule is a range of neighbour counts over a disc.
- **Make everything continuous** — cell values, neighbourhood, and time step — and you arrive at **Lenia** (Bert Chan), which is what the *Artificial Life* page on this site already runs. Conway's Life is the discrete corner of the same space.

That is the honest relationship between the two pages here: same family, opposite ends.

---

## 6. Life Inside Life

The **OTCA metapixel** (Brice Due, 2006) is a Life pattern that behaves like a single Life cell.

- Each metapixel occupies **2048 × 2048** cells.
- It runs on a period of **35,328** generations — that is one "meta-generation".
- It is configurable: the same construction can emulate any B/S rule, not only B3/S23.

Tile the plane with metapixels and you have a Life board whose cells are themselves Life boards. Zoom out by 2048× and 35,328 generations, and you see Life again. Repeat. That is the "atoms of atoms, infinite recursion" the Reddit post shows.

It is not a trick or an overlay — it is B3/S23 running plain rules, arranged so that the aggregate behaviour of four million cells reproduces the behaviour of one.

> The practical consequence for a browser: a single metapixel is 4.2 million cells and one meta-generation is 35,328 steps. Rendering *one* meta-step of a 10×10 metapixel board is ~4×10^11 cell updates. This is a thing to **link to and explain**, not to run live on a portfolio page — and saying so is more honest than shipping something that pretends.

---

## 7. Making It Fast

Three strategies, in increasing order of cleverness.

### Dense grid, per-cell update
Every cell, every generation. O(width × height) per step. Simple and correct; fine to a few hundred squared in JavaScript, and fine to several thousand squared on a GPU because each cell is independent — which is exactly why this site runs it as a fragment shader.

### Sparse / coordinate encoding
Store only live cells (a hash set of coordinates) and only visit them plus their neighbours. Cost becomes O(live cells) instead of O(area), which decouples the simulation from the size of the universe.

This is what allows a **2^64 × 2^64** address space: the grid is never allocated, only the population is. A glider travelling for a billion generations costs the same per step as one sitting still. The trade is that dense, busy regions are *slower* than a plain array because of hashing overhead — sparse wins on emptiness, not on activity.

### Hashlife
**Bill Gosper, 1984.** The grid is a quadtree; identical subtrees are shared (hash-consed); and the future of a node is memoised.

Because Life is deterministic and local, an identical square of cells always produces an identical result — so the same computation is never done twice. On regular or repetitive patterns this gives **superlinear** speedup: hashlife can jump 2^k generations in roughly the time a naive simulator takes for one, and it is what makes running a metapixel board tractable at all.

The catch: memory grows with pattern *diversity*, and truly chaotic patterns defeat the cache. Hashlife is spectacular on structure and unremarkable on noise.

---

## 7b. Off the Grid — Particle Life

Conway is a discrete grid of binary cells. Lenia is a discrete grid of continuous values.
**Particle Life has no grid at all**: typed particles move in continuous space, and the
only rule is how each type feels about every other.

For a pair (a, b) at distance d within the interaction radius R, with q = d/R:

| q | force |
|:--|:--|
| q < β | universal **repulsion**, ramping from −REPULSION at q=0 to 0 at β |
| β ≤ q < 1 | attraction of strength **M[a][b]**, peaking midway and tapering to 0 |

Two details carry the whole thing:

**M is asymmetric on purpose.** Coral may chase mint while mint flees coral. That
one-sidedness is where chasing, orbiting and self-propelling clusters come from. Symmetrise
the matrix and you get crystals and blobs — pretty, and much less alive.

**The repulsion is not decoration.** Without it every attracting pair collapses to a point
and the simulation dies as a handful of infinitely dense dots. It is scaled well above the
maximum attraction, because a particle is pulled by many neighbours at once but pushed by
only the few that are truly close — parity is not enough.

### Two things measurement forced

*Both were found by tests, not by looking.*

- **A speed limit.** A step must never move a particle further than the repulsion zone is
  wide, or a particle deep inside that zone is thrown clean past its neighbour in one step
  and the pair swap places instead of separating. Measured before the cap: an all-attract
  matrix left the closest pair at 2.7e-3 with repulsion versus 1.5e-3 without — a mere
  1.8×, when it should be an order of magnitude. This is the standard stability condition
  for explicit integration: the step must not skip the feature it is resolving.
- **Terminal speed is `forceScale · dt / (1 − friction)`.** At the first constants that
  was 0.086 world-units per step — a particle crossing 8% of the world every tick, which
  mixes everything instead of letting structure form.

### Why this one is on the CPU

Conway and Lenia are stencil operations: every cell reads a fixed neighbourhood at a fixed
offset, which is exactly what a fragment shader does well. This is not — each particle must
*find* its neighbours, which on the WebGL1-style `ShaderMaterial` this site uses would mean
encoding a spatial structure into textures and reading it back.

A uniform-grid spatial hash on the CPU sizes each bucket to one interaction radius, so
every neighbour in range is in this bucket or one of the eight around it. Measured at 3000
particles: **6.31 ms per step versus 97.02 ms brute force, 15.4× faster**, and 2000
particles step in 2.93 ms against a 16.7 ms frame budget. It is also testable without a
GPU, and `tests/verify-particles.cjs` proves the hashed path produces velocities identical
to testing every pair — worst delta 0.00e+0.

An unverifiable GPU version would have been the worse engineering trade.

### Density regulation — the part that was missing

CodeNoodles calls this *"the most important component to making complex particle life"*,
and the first implementation here did not have it. Without it, any pair of mutually
attracting types collapses into an ever-denser knot and the field ends as a few tight blobs
that never change again. Short-range repulsion does **not** prevent this: repulsion stops
particles *overlapping*, but a clump keeps recruiting from outside indefinitely, because
attraction is summed over every neighbour in range while repulsion only acts on the few
that are truly close.

The rule is that attraction is conditional on **not already being surrounded by your own
kind**. Crucially it is same-type crowding that matters, not crowding as such — a dense
nucleus wrapped in a membrane of another species is a structure worth keeping; a dense ball
of one colour is the failure mode.

Getting the measure right took two wrong attempts, both worth recording:

| attempt | why it failed |
|:--|:--|
| `same / (1 + other)` | Cancels. When everything attracts, `other` grows in proportion to `same`, so the ratio sat near 0.5 however dense it got. Measured effect on the field: occupancy 255 vs 246 — nothing. |
| threshold `2.5`, picked by eye | The measure's actual range was 0 to 0.95, so the threshold was never reached and the regulation was inert. An invented number, which is the exact mistake this document's own testing notes warn about. |

The measure that works is the signed **excess**, `same − other`, both weighted by `1 − d/R`
so a neighbour at the edge of the radius counts for nothing. Measured:

| field | at t=0 | after 600 steps |
|:--|--:|--:|
| self-attracting (segregates into single-colour balls) | −2.9 | **+19.9** |
| all-attracting (stays thoroughly mixed) | −3.0 | **−14.1** |

Negative is the healthy case — it means a particle is outnumbered by other types. So the
threshold engages on exactly the configuration the rule is about and never on the other.
With regulation on, the segregating field's 95th-percentile excess falls from 30.6 to 22.3
and it spreads over **421 → 650** of 1600 occupancy cells; the mixed field is untouched
(224 vs 226). Applied to attraction only — damping repulsion as well would let crowded
particles merge, which is the thing being prevented.

It costs nothing extra: the crowding is accumulated during the neighbour sweep that is
already happening, and the scale it produces is used on the *next* step. That one-frame lag
avoids a second pass over every neighbour, and is invisible — a particle moves at most
`beta · radius` per step, so its neighbourhood barely changes between frames.

`Density regulation` is exposed on the page with tolerance and firmness sliders, because
turning it off and watching the field collapse into blobs is the clearest demonstration of
why it is there.

### 7c. The same rule in three dimensions — the site's backdrop

The main page's backdrop is a scene selector: the solar system by default, or **Particle
Space** — the same model again, with the world a wrapped *cube* instead of a wrapped
square. Because you are looking into a volume rather than at a plane, structures pass in
front of and behind each other, and that depth is the only reason to have a 3D version at
all.

What differs from the 2D sim is confined to the innermost loop: **27 buckets instead of
9**, three coordinates instead of two. What does *not* differ is the model, and that now
lives in one file — `ForceMatrix.js` — holding the palette, the interaction matrix and the
force curve, shared by both. Both sims *inline* the curve into their hot loop rather than
calling it a few hundred thousand times a step, so `tests/verify-field3d.cjs` recovers each
sim's force **empirically** (two particles, one step, divide the velocity change by
`forceScale · dt`) and sweeps the whole radius comparing against the reference. 120 samples,
worst disagreement 7.4e-6.

The third dimension is not free: with density held constant, 27 buckets means about **3×
the neighbours per particle**, and cost scales with radius *cubed*. Hence 2200 particles
here against 1800 on the Life page. Measured: 2000 particles step in **4.93 ms hashed
versus 67.67 ms brute force (13.7×)**, inside a 16.7 ms budget.

Two rendering decisions were forced by looking at it rather than by counting:

- **Not additive blending.** Additive *sums* colours, and a cluster is exactly where
  particles overlap — so every interesting structure saturated to white and the species
  became unreadable at precisely the moment they mattered. Sampled from the rendered
  frame: 4% of lit pixels carried any hue.
- **Colours must be written in linear light.** three.js renders with
  `outputColorSpace = 'srgb'`, so the final shader encodes linear → sRGB on the way out.
  Material colours are converted on the way *in* to match; **vertex colour attributes
  never are**. Feeding the sRGB palette straight into the attribute got it encoded twice
  and pushed every channel towards white — coral (255, 107, 71) arrived as (224, 192, 176).
  After converting the palette to linear: **95%** of lit pixels carry a species colour, up
  from 4%. This affected the 2D sim too, and is why `ForceMatrix` exports both
  `TYPE_COLOURS` (sRGB, for CSS swatches) and `TYPE_COLOURS_LINEAR` (for the GPU).

  Note this is independent of `THREE.ColorManagement.enabled`, which is `false` here and
  misled the first diagnosis: that flag governs conversion of *inputs*, not the output
  encoding, and the output encoding is what does the damage.

---

## 8. Zero Assets

The *Artificial Life* page on this site already states its rule: no sprites, no textures, no audio files — every pixel and every sound generated from maths at runtime.

Life is the purest possible case of that idea. The entire visual content is **two integers** (the birth and survival masks) plus an initial condition. The Gosper glider gun, an infinite stream of moving structures, is 36 live cells — under 40 bytes if you store coordinates, and about 70 characters as RLE text.

Patterns here are stored as **RLE strings in source**, the standard interchange format from conwaylife.com. Nothing is fetched, nothing is decoded from a binary, and the whole library costs less than a small PNG.

---

## 9. How This Site Implements It

| Concern | Decision | Reason |
|:--|:--|:--|
| Where the simulation runs | GPU fragment shader, ping-pong render targets | Each cell is independent; costs **zero per-frame JavaScript**, the failure mode profiling already found in this project's tile engine |
| Rule representation | two 9-bit masks as uniforms | Any B/S rule, switchable per frame, no shader recompile |
| Boundary | torus (`RepeatWrapping`) | Nothing dies against an edge; a glider that leaves returns |
| Patterns | RLE strings decoded at runtime | §8 — zero asset bytes |
| Teardown | explicit `dispose()` + `forceContextLoss()` | Leaked WebGL contexts are not garbage collected and browsers cap them per tab; the existing `LifePage` already learned this |
| Reduced motion | starts paused | The simulation *is* the motion; honouring the preference means not running it |

Files:

- `src/utils/ForceMatrix.js` — the Particle Life *model*: palette, interaction matrix, force curve. Shared by the 2D and 3D sims so the rule cannot drift between them
- `src/utils/ConwayLife.js` — the discrete simulation
- `src/utils/Lenia.js` — the continuous simulation
- `src/utils/ParticleLife.js` — the grid-free simulation, 2D, on the Life page
- `src/utils/ParticleField3D.js` — the grid-free simulation in a wrapped cube, as the site's backdrop
- `src/utils/LifeView.js` — shared zoom, pan, palette and per-cell gradient
- `src/utils/LifePatterns.js` — RLE decoder and pattern library
- `src/components/pages/LifePage.js` — page controller for all three modes, owns the WebGL context
- `src/components/pages/lifePage.html` / `.css` — markup and styling
- `src/components/simulation/solarsystem/SpaceEnvironment.js` — hosts the scene selector (`setSceneMode`) that swaps the solar system for the particle field

Tests:

- `tests/verify-patterns.cjs` — RLE round-trips, 14 patterns and 7 rule presets
- `tests/verify-particles.cjs` — the 2D force law, two particles at a time
- `tests/verify-field3d.cjs` — the 3D field, and proof that all three copies of the force curve still agree
- `tests/e2e/life-full.spec.js` — every control on the Life page
- `tests/e2e/scene-select.spec.js` — the backdrop switch, driven through the actual buttons
- `tests/e2e/scene-look.spec.js` — samples the rendered pixels: coverage, hue count, saturation, motion

---

## References

- Gardner, M. "Mathematical Games: The fantastic combinations of John Conway's new solitaire game 'life'", *Scientific American* 223 (October 1970)
- LifeWiki / conwaylife.com — the pattern corpus, RLE format, and rule notation
- Gosper, R. W. — glider gun (1970); Hashlife (1984)
- Due, B. — OTCA metapixel (2006)
- Rendell, P. — Turing machine in Conway's Life (2000; universal 2010)
- Chan, B. — *Lenia: Biology of Artificial Creatures in Continuous Cellular Automata* (see `src/utils/Lenia.js`)
- CodeNoodles — *I Created Realistic Life With Particles* ([2vt4MBxcOhs](https://www.youtube.com/watch?v=2vt4MBxcOhs)). Source of density regulation, which it calls the most important component
- Krafer — *I made a Molecular Simulation using Quarks* ([njaBPMuiX3I](https://www.youtube.com/watch?v=njaBPMuiX3I))
- Zanzlanz — *How I released a game that has no assets* ([Qr3VsZYQy4s](https://www.youtube.com/watch?v=Qr3VsZYQy4s)). Source of the Fourier-series shape engine in `src/utils/SineShape.js` and of §8's zero-asset rule
- kavan — *Simulating Atoms in C++* ([OSAOh4L41Wg](https://www.youtube.com/watch?v=OSAOh4L41Wg)). Hydrogen orbitals by CDF-sampling the Schrödinger wavefunction — not yet implemented here; see the note below

> **A note on reading these.** YouTube watch pages are JS-rendered, so a plain fetch
> returns only the page footer. That is not evidence the content is unavailable — full
> transcripts come back from `youtube-transcript-api`. An earlier pass here concluded from
> a footer-only fetch that "neither transcript nor description was retrievable", built
> Particle Life from the titles alone, and consequently shipped it without the one
> component its source video singles out as most important. Fetch the transcript.

---

**Related:** [`ORBITAL_MECHANICS.md`](ORBITAL_MECHANICS.md) · [`README.md`](README.md)
