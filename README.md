# NurbsSurfaceDisplay

An interactive browser-based NURBS surface visualizer that can import and export surface definitions.

## Features

- Edit NURBS surface degrees, knot vectors, control points, and weights.
- Inspect evaluated 3D points by entering or sliding U/V parameters.
- Interactively select and move control points in the 3D viewport.
- Import and export surface definitions as JSON.

## Run

Use any static file server from the project root:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## JSON Format

```json
{
  "degreeU": 3,
  "degreeV": 3,
  "knotsU": [0, 0, 0, 0, 1, 1, 1, 1],
  "knotsV": [0, 0, 0, 0, 1, 1, 1, 1],
  "controlPoints": [
    [
      { "x": -2, "y": -2, "z": 0, "w": 1 }
    ]
  ]
}
```
