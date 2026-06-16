---
title: 'Web NURBS Surface Visualizer'
type: 'feature'
created: '2026-06-11'
status: 'done'
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The project needs a browser-based NURBS surface visualizer where users can change degree, knot vectors, control points, and weights, inspect the evaluated 3D point for selected `(u, v)`, and exchange surface definitions as JSON.

**Approach:** Build a static web app with local NURBS evaluation, a Three.js scene for the rendered surface/control net/point marker, editor controls for the surface parameters, and import/export actions for the JSON model.

## Boundaries & Constraints

**Always:** Keep the app runnable without a build step. Validate degree/knot/control-grid compatibility before rendering. Preserve a stable JSON format containing `degreeU`, `degreeV`, `knotsU`, `knotsV`, and a rectangular `controlPoints` grid with `x`, `y`, `z`, and `w`.

**Ask First:** Do not add backend storage, server-side conversion, CAD kernel integration, or binary CAD import/export.

**Never:** Do not depend on project-specific native libraries. Do not silently render invalid NURBS definitions as if they were valid.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit surface | User changes degree, knot vector, selected control point, or weight | Surface, control net, current point, and JSON export update from the new definition | Invalid values show a validation message and keep the last valid scene |
| Inspect point | User moves U and V sliders | Marker moves to evaluated 3D point and coordinates update | If the surface is invalid, point readout is cleared |
| Export JSON | User clicks download | Browser downloads the current surface definition as JSON | Disabled only by browser download restrictions |
| Import JSON | User uploads matching JSON | Editor and scene load the uploaded surface | Malformed or incompatible JSON shows an error and does not replace the current surface |

</frozen-after-approval>

## Code Map

- `index.html` -- app shell, controls, file input, scene mount.
- `styles.css` -- responsive dark tool UI and editor layout.
- `src/app.js` -- NURBS math, validation, state management, Three.js rendering, JSON import/export.

## Tasks & Acceptance

**Execution:**
- [x] `index.html` -- create a static UI for parameter editing, sliders, import/export, and 3D viewport.
- [x] `styles.css` -- style the UI for desktop and mobile without layout overlap.
- [x] `src/app.js` -- implement NURBS basis/evaluation, validation, surface mesh rendering, control point editing, sliders, and JSON import/export.

**Acceptance Criteria:**
- Given the default model, when the page loads, then a 3D NURBS surface, control net, and selected point marker are visible.
- Given valid edits to degree, knots, control points, or weights, when the value changes, then the surface and point readout update.
- Given U/V sliders, when either slider moves, then the displayed 3D point matches the current surface evaluation.
- Given a downloaded JSON file, when it is uploaded again, then the same surface is restored.
- Given invalid JSON or incompatible NURBS dimensions, when uploaded or edited, then the app reports the error without replacing the current valid scene.

## Verification

**Commands:**
- `node --check src\app.js` -- expected: JavaScript syntax check passes.
- `python -m http.server 4173` -- expected: static app serves locally at `http://localhost:4173`.
- Chrome headless/CDP inspection at `http://localhost:4173` -- expected: canvas exists, slider changes evaluation output, invalid knots show validation error, and no console errors.

## Suggested Review Order

**Entry And Layout**

- App shell and controls
  [`index.html:19`](../../index.html#L19)

- Responsive tool layout
  [`styles.css:60`](../../styles.css#L60)

**State And Validation**

- Input-to-model boundary
  [`app.js:220`](../../src/app.js#L220)

- NURBS compatibility checks
  [`app.js:248`](../../src/app.js#L248)

**Rendering And Evaluation**

- Three.js scene setup
  [`app.js:36`](../../src/app.js#L36)

- Surface mesh sampling
  [`app.js:354`](../../src/app.js#L354)

- Rational surface evaluation
  [`app.js:471`](../../src/app.js#L471)

**JSON Exchange**

- Download current model
  [`app.js:578`](../../src/app.js#L578)

- Upload and normalize JSON
  [`app.js:592`](../../src/app.js#L592)
