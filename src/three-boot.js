/**
 * three-boot.js - loads three.js r184 (ESM, via the import map in index.html) and
 * republishes it as window.THREE for the classic scripts. Was an inline <script
 * type="module"> in index.html; moved to a file so the CSP can drop 'unsafe-inline'
 * from script-src (roast R3 #7). The import map itself must stay inline (browsers do
 * not support <script type="importmap" src>), so it is allowed by its sha256 hash -
 * tests/verify-csp.cjs checks that hash and the SRI integrity entries.
 */
import * as THREE_NS from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

// COLOUR MANAGEMENT OFF — deliberate, and the single most important line here.
//
// r152+ converts every material colour from sRGB to linear on input. r128 never
// did, so it effectively rendered every authored colour brighter than specified.
// This entire scene — sun, corona, chromosphere, flares, solar wind, orbit rings,
// planet tints — was hand-tuned by eye against that legacy behaviour over a long
// time. Turning colour management on made all of it render "correctly" and
// therefore visibly darker: measured 18.07 -> 15.86 mean screen luminance (-12%),
// well outside the +/-0.07 run-to-run noise, and the user spotted it immediately.
//
// Two ways out: re-tune dozens of materials by hand, or restore the colour
// pipeline the artwork was authored for. This is one documented line versus an
// open-ended re-tune with no reference to tune against, so: off.
// Measured with it off: 17.21 / 33.5% visible, back in line with the r128 look.
//
// If the scene is ever re-authored against correct colour, delete this line —
// but expect to re-tune every emissive and translucent material at the same time.
THREE_NS.ColorManagement.enabled = false;

// An ES module namespace object is immutable, so the addons cannot be hung off it
// directly the way examples/js used to. Spread into a plain object first.
const THREE = { ...THREE_NS };
THREE.OrbitControls = OrbitControls;
THREE.LineSegmentsGeometry = LineSegmentsGeometry;
THREE.LineMaterial = LineMaterial;
THREE.LineSegments2 = LineSegments2;
// NOTE: THREE.Timer needs NO import — it moved into CORE in r184 and already
// arrives via the namespace spread above. Importing it from
// 'three/addons/misc/Timer.js' 404s, and a failed import in this module aborts
// the whole bootstrap, so window.THREE is never set and the entire site dies
// silently. Verified the hard way.
window.THREE = THREE;
window.__threeReady = true;
