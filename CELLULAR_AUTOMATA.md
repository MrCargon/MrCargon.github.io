# Cellular Automata - Conway's Game of Life

**Purpose:** Reference for the Life implementation on this site, and the body of knowledge behind it — rules, patterns, computation, rule-space, recursion, and the algorithms that make large simulations possible.

**Audience:** Anyone reading the source of `ConwayLife.js`, `LifePatterns.js` and `ConwayPage.js`, or curious how a four-line rule ends up being Turing complete.

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

- `src/utils/ConwayLife.js` — the simulation
- `src/utils/LifePatterns.js` — RLE decoder and pattern library
- `src/components/pages/ConwayPage.js` — page controller, owns the WebGL context
- `src/components/pages/conwayPage.html` / `.css` — markup and styling

---

## References

- Gardner, M. "Mathematical Games: The fantastic combinations of John Conway's new solitaire game 'life'", *Scientific American* 223 (October 1970)
- LifeWiki / conwaylife.com — the pattern corpus, RLE format, and rule notation
- Gosper, R. W. — glider gun (1970); Hashlife (1984)
- Due, B. — OTCA metapixel (2006)
- Rendell, P. — Turing machine in Conway's Life (2000; universal 2010)
- Chan, B. — *Lenia: Biology of Artificial Creatures in Continuous Cellular Automata* (see `src/utils/Lenia.js`)

---

**Related:** [`ORBITAL_MECHANICS.md`](ORBITAL_MECHANICS.md) · [`README.md`](README.md)
