import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const SAMPLE_STEPS = 36;
const POINT_DECIMALS = 4;

const els = {
  scene: document.querySelector("#scene"),
  statusText: document.querySelector("#statusText"),
  downloadJson: document.querySelector("#downloadJson"),
  uploadJsonButton: document.querySelector("#uploadJsonButton"),
  uploadJson: document.querySelector("#uploadJson"),
  resetSurface: document.querySelector("#resetSurface"),
  uniformKnots: document.querySelector("#uniformKnots"),
  degreeU: document.querySelector("#degreeU"),
  degreeV: document.querySelector("#degreeV"),
  countU: document.querySelector("#countU"),
  countV: document.querySelector("#countV"),
  knotsU: document.querySelector("#knotsU"),
  knotsV: document.querySelector("#knotsV"),
  controlPointSection: document.querySelector("#controlPointSection"),
  pointHint: document.querySelector("#pointHint"),
  pointU: document.querySelector("#pointU"),
  pointV: document.querySelector("#pointV"),
  pointX: document.querySelector("#pointX"),
  pointY: document.querySelector("#pointY"),
  pointZ: document.querySelector("#pointZ"),
  pointW: document.querySelector("#pointW"),
  jumpU: document.querySelector("#jumpU"),
  jumpV: document.querySelector("#jumpV"),
  jumpPoint: document.querySelector("#jumpPoint"),
  controlPointList: document.querySelector("#controlPointList"),
  sliderU: document.querySelector("#sliderU"),
  sliderV: document.querySelector("#sliderV"),
  valueU: document.querySelector("#valueU"),
  valueV: document.querySelector("#valueV"),
  evalX: document.querySelector("#evalX"),
  evalY: document.querySelector("#evalY"),
  evalZ: document.querySelector("#evalZ"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e10);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.position.set(6.2, -7.6, 5.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
els.scene.appendChild(renderer.domElement);

const controls = createQuaternionCameraControls(camera, renderer.domElement, {
  target: new THREE.Vector3(0, 0, 0.45),
});

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSize(0.58);
scene.add(
  typeof transformControls.getHelper === "function" ? transformControls.getHelper() : transformControls,
);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

scene.add(new THREE.HemisphereLight(0xdcefff, 0x1b2429, 2.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
keyLight.position.set(4, -5, 7);
scene.add(keyLight);

const grid = new THREE.GridHelper(8, 16, 0x35424a, 0x1f2a30);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

let renderGroup = new THREE.Group();
scene.add(renderGroup);

let selected = { u: 1, v: 1 };
let hovered = null;
let isDraggingControlPoint = false;
let controlPointMeshes = new Map();
let model = createDefaultModel();
let lastValidModel = cloneModel(model);
let lastAlertedDataError = "";

syncFormFromModel(model);
renderFromInputs();
animate();

els.downloadJson.addEventListener("click", downloadModel);
els.uploadJsonButton.addEventListener("click", () => els.uploadJson.click());
els.uploadJson.addEventListener("change", uploadModel);
els.resetSurface.addEventListener("click", () => {
  model = createDefaultModel();
  selected = { u: 1, v: 1 };
  syncFormFromModel(model);
  renderFromInputs("Surface reset");
});
els.uniformKnots.addEventListener("click", () => {
  model.degreeU = readInteger(els.degreeU, model.degreeU);
  model.degreeV = readInteger(els.degreeV, model.degreeV);
  model.controlPoints = resizeControlGrid(
    model.controlPoints,
    readInteger(els.countU, model.controlPoints.length),
    readInteger(els.countV, model.controlPoints[0].length),
  );
  model.knotsU = createOpenUniformKnots(model.controlPoints.length, model.degreeU);
  model.knotsV = createOpenUniformKnots(model.controlPoints[0].length, model.degreeV);
  selected.u = clamp(selected.u, 0, model.controlPoints.length - 1);
  selected.v = clamp(selected.v, 0, model.controlPoints[0].length - 1);
  syncFormFromModel(model);
  renderFromInputs("Uniform knots applied");
});

[els.degreeU, els.degreeV, els.countU, els.countV].forEach((input) => {
  input.addEventListener("change", () => {
    const nextDegreeU = readInteger(els.degreeU, model.degreeU);
    const nextDegreeV = readInteger(els.degreeV, model.degreeV);
    const nextCountU = Math.max(nextDegreeU + 1, readInteger(els.countU, model.controlPoints.length));
    const nextCountV = Math.max(nextDegreeV + 1, readInteger(els.countV, model.controlPoints[0].length));
    model.degreeU = nextDegreeU;
    model.degreeV = nextDegreeV;
    model.controlPoints = resizeControlGrid(model.controlPoints, nextCountU, nextCountV);
    model.knotsU = createOpenUniformKnots(nextCountU, nextDegreeU);
    model.knotsV = createOpenUniformKnots(nextCountV, nextDegreeV);
    selected.u = clamp(selected.u, 0, nextCountU - 1);
    selected.v = clamp(selected.v, 0, nextCountV - 1);
    syncFormFromModel(model);
    renderFromInputs("Dimensions updated");
  });
});

[els.knotsU, els.knotsV].forEach((textarea) => {
  textarea.addEventListener("input", () => renderFromInputs());
});

[els.pointU, els.pointV].forEach((select) => {
  select.addEventListener("change", () => {
    selectControlPoint(readInteger(els.pointU, selected.u), readInteger(els.pointV, selected.v));
  });
});

[els.pointX, els.pointY, els.pointZ, els.pointW].forEach((input) => {
  input.addEventListener("input", () => {
    const point = model.controlPoints[selected.u]?.[selected.v];
    if (!point) return;
    point.x = readNumber(els.pointX, point.x);
    point.y = readNumber(els.pointY, point.y);
    point.z = readNumber(els.pointZ, point.z);
    point.w = Math.max(0.001, readNumber(els.pointW, point.w));
    renderFromInputs();
  });
});

[els.sliderU, els.sliderV].forEach((slider) => {
  slider.addEventListener("input", () => updateEvaluation(lastValidModel));
});

[els.valueU, els.valueV].forEach((input) => {
  input.addEventListener("change", () => {
    commitEvaluationInput(input === els.valueU ? "u" : "v");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      input.blur();
    }
  });
});

els.jumpPoint.addEventListener("click", () => {
  selectControlPoint(readInteger(els.jumpU, selected.u), readInteger(els.jumpV, selected.v), {
    status: "Control point selected",
  });
});

els.controlPointList.addEventListener("click", (event) => {
  const row = event.target.closest(".point-row");
  if (!row) return;
  selectControlPoint(Number(row.dataset.u), Number(row.dataset.v), {
    status: "Control point selected",
  });
});

els.controlPointList.addEventListener("pointerover", (event) => {
  const row = event.target.closest(".point-row");
  if (!row) return;
  setHoveredControlPoint({ u: Number(row.dataset.u), v: Number(row.dataset.v) });
});

els.controlPointList.addEventListener("pointerout", (event) => {
  if (event.relatedTarget?.closest?.(".point-row")) return;
  setHoveredControlPoint(null);
});

renderer.domElement.addEventListener("pointerdown", handleScenePointerDown, true);
renderer.domElement.addEventListener("pointermove", handleScenePointerMove);
renderer.domElement.addEventListener("pointerleave", () => {
  setHoveredControlPoint(null);
  transformControls.enabled = true;
});
renderer.domElement.addEventListener("click", handleSceneClick);

transformControls.addEventListener("dragging-changed", (event) => {
  controls.enabled = !event.value;
  isDraggingControlPoint = event.value;
  if (!event.value) {
    renderFromInputs("Control point moved");
  }
});

transformControls.addEventListener("objectChange", () => {
  const object = transformControls.object;
  if (!object?.userData || object.userData.kind !== "control-point") return;
  const point = model.controlPoints[object.userData.u]?.[object.userData.v];
  if (!point) return;
  point.x = object.position.x;
  point.y = object.position.y;
  point.z = object.position.z;
  selected = { u: object.userData.u, v: object.userData.v };
  syncPointSelectors(model);
  syncPointEditor();
  syncJumpInputs(model);
  syncControlPointList();
  updateEvaluation(model);
});

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(els.scene);
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

function createDefaultModel() {
  const degreeU = 3;
  const degreeV = 3;
  const countU = 4;
  const countV = 4;
  const controlPoints = [];

  for (let i = 0; i < countU; i += 1) {
    const row = [];
    for (let j = 0; j < countV; j += 1) {
      const u = i / (countU - 1);
      const v = j / (countV - 1);
      row.push({
        x: (u - 0.5) * 4,
        y: (v - 0.5) * 4,
        z: 0.9 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
        w: i === 1 && j === 2 ? 1.6 : 1,
      });
    }
    controlPoints.push(row);
  }

  return {
    degreeU,
    degreeV,
    knotsU: createOpenUniformKnots(countU, degreeU),
    knotsV: createOpenUniformKnots(countV, degreeV),
    controlPoints,
  };
}

function createOpenUniformKnots(count, degree) {
  if (!Number.isInteger(count) || !Number.isInteger(degree) || count <= degree) {
    return [];
  }

  const interiorCount = count - degree - 1;
  const knots = Array.from({ length: degree + 1 }, () => 0);
  for (let i = 1; i <= interiorCount; i += 1) {
    knots.push(i / (interiorCount + 1));
  }
  knots.push(...Array.from({ length: degree + 1 }, () => 1));
  return knots;
}

function resizeControlGrid(points, countU, countV) {
  const safeCountU = Math.max(2, countU);
  const safeCountV = Math.max(2, countV);
  const next = [];

  for (let i = 0; i < safeCountU; i += 1) {
    const row = [];
    for (let j = 0; j < safeCountV; j += 1) {
      row.push(points[i]?.[j] ? { ...points[i][j] } : defaultPoint(i, j, safeCountU, safeCountV));
    }
    next.push(row);
  }

  return next;
}

function defaultPoint(i, j, countU, countV) {
  const u = countU === 1 ? 0 : i / (countU - 1);
  const v = countV === 1 ? 0 : j / (countV - 1);
  return {
    x: (u - 0.5) * 4,
    y: (v - 0.5) * 4,
    z: 0.45 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
    w: 1,
  };
}

function renderFromInputs(successMessage = "Ready") {
  try {
    model = readModelFromForm();
    validateModel(model);
    lastValidModel = cloneModel(model);
    drawModel(model);
    syncControlPointList();
    setStatus(successMessage);
    lastAlertedDataError = "";
  } catch (error) {
    reportDataError(error.message);
    updateEvaluation(null);
  }
}

function readModelFromForm() {
  const degreeU = readInteger(els.degreeU, model.degreeU);
  const degreeV = readInteger(els.degreeV, model.degreeV);
  const countU = readInteger(els.countU, model.controlPoints.length);
  const countV = readInteger(els.countV, model.controlPoints[0]?.length ?? 0);

  return {
    degreeU,
    degreeV,
    knotsU: parseKnots(els.knotsU.value, "U knots"),
    knotsV: parseKnots(els.knotsV.value, "V knots"),
    controlPoints: resizeControlGrid(model.controlPoints, countU, countV),
  };
}

function validateModel(candidate) {
  if (!Number.isInteger(candidate.degreeU) || candidate.degreeU < 1) {
    throw new Error("Degree U 必须是正整数");
  }
  if (!Number.isInteger(candidate.degreeV) || candidate.degreeV < 1) {
    throw new Error("Degree V 必须是正整数");
  }
  if (!Array.isArray(candidate.controlPoints) || candidate.controlPoints.length < 2) {
    throw new Error("控制点网格至少需要 2 行 U 方向控制点");
  }
  if (!Array.isArray(candidate.controlPoints[0]) || candidate.controlPoints[0].length < 2) {
    throw new Error("控制点网格至少需要 2 列 V 方向控制点");
  }

  const countU = candidate.controlPoints.length;
  const countV = candidate.controlPoints[0].length;
  if (candidate.degreeU >= countU) {
    throw new Error("Degree U 必须小于 U 方向控制点数量");
  }
  if (candidate.degreeV >= countV) {
    throw new Error("Degree V 必须小于 V 方向控制点数量");
  }

  for (let i = 0; i < countU; i += 1) {
    if (!Array.isArray(candidate.controlPoints[i]) || candidate.controlPoints[i].length !== countV) {
      throw new Error("控制点网格必须是矩形二维数组");
    }
    for (let j = 0; j < countV; j += 1) {
      const point = candidate.controlPoints[i][j];
      if (!point || typeof point !== "object") {
        throw new Error(`控制点 [${i}, ${j}] 必须是 [x, y, z, w] 数组`);
      }
      if (![point.x, point.y, point.z, point.w].every(Number.isFinite)) {
        throw new Error(`控制点 [${i}, ${j}] 必须包含有效数值 x、y、z、w`);
      }
      if (point.w <= 0) {
        throw new Error(`控制点 [${i}, ${j}] 的权重 w 必须大于 0`);
      }
    }
  }

  validateKnots(candidate.knotsU, countU, candidate.degreeU, "U");
  validateKnots(candidate.knotsV, countV, candidate.degreeV, "V");
}

function validateKnots(knots, count, degree, axis) {
  const expectedLength = count + degree + 1;
  if (knots.length !== expectedLength) {
    throw new Error(`${axis} 方向节点向量需要 ${expectedLength} 个值`);
  }
  for (let i = 0; i < knots.length; i += 1) {
    if (!Number.isFinite(knots[i])) {
      throw new Error(`${axis} 方向节点向量包含非数值内容`);
    }
    if (i > 0 && knots[i] < knots[i - 1]) {
      throw new Error(`${axis} 方向节点向量必须按非递减顺序排列`);
    }
  }
  if (knots[degree] >= knots[count]) {
    throw new Error(`${axis} 方向节点参数域必须有正长度`);
  }
}

function parseKnots(text, label) {
  const values = text
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((part) => Number(part));

  if (!values.length) {
    throw new Error(`${label} 不能为空`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} 包含无效数值`);
  }
  return values;
}

function drawModel(validModel) {
  transformControls.detach();
  controlPointMeshes = new Map();
  disposeObject(renderGroup);
  scene.remove(renderGroup);
  renderGroup = new THREE.Group();
  scene.add(renderGroup);

  const surfaceGeometry = buildSurfaceGeometry(validModel);
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x48c6a2,
    metalness: 0.1,
    roughness: 0.52,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  renderGroup.add(surface);

  const wireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(surfaceGeometry),
    new THREE.LineBasicMaterial({ color: 0xe1fff7, transparent: true, opacity: 0.22 }),
  );
  renderGroup.add(wireframe);

  renderGroup.add(buildControlNet(validModel));
  renderGroup.add(buildControlPoints(validModel));

  updateEvaluation(validModel);
  attachTransformToSelected();
  updateControlPointVisuals();
}

function buildSurfaceGeometry(validModel) {
  const positions = [];
  const indices = [];
  const domainU = getDomain(validModel.knotsU, validModel.degreeU, validModel.controlPoints.length);
  const domainV = getDomain(validModel.knotsV, validModel.degreeV, validModel.controlPoints[0].length);

  for (let i = 0; i <= SAMPLE_STEPS; i += 1) {
    const u = lerp(domainU[0], domainU[1], i / SAMPLE_STEPS);
    for (let j = 0; j <= SAMPLE_STEPS; j += 1) {
      const v = lerp(domainV[0], domainV[1], j / SAMPLE_STEPS);
      const point = evaluateSurface(validModel, u, v);
      positions.push(point.x, point.y, point.z);
    }
  }

  const rowLength = SAMPLE_STEPS + 1;
  for (let i = 0; i < SAMPLE_STEPS; i += 1) {
    for (let j = 0; j < SAMPLE_STEPS; j += 1) {
      const a = i * rowLength + j;
      const b = a + 1;
      const c = a + rowLength;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildControlNet(validModel) {
  const positions = [];
  const countU = validModel.controlPoints.length;
  const countV = validModel.controlPoints[0].length;

  for (let i = 0; i < countU; i += 1) {
    for (let j = 0; j < countV - 1; j += 1) {
      pushPoint(positions, validModel.controlPoints[i][j]);
      pushPoint(positions, validModel.controlPoints[i][j + 1]);
    }
  }

  for (let j = 0; j < countV; j += 1) {
    for (let i = 0; i < countU - 1; i += 1) {
      pushPoint(positions, validModel.controlPoints[i][j]);
      pushPoint(positions, validModel.controlPoints[i + 1][j]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf3b75b }));
}

function buildControlPoints(validModel) {
  const group = new THREE.Group();
  const countU = validModel.controlPoints.length;
  const countV = validModel.controlPoints[0].length;

  for (let i = 0; i < countU; i += 1) {
    for (let j = 0; j < countV; j += 1) {
      const point = validModel.controlPoints[i][j];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 16, 10),
        new THREE.MeshStandardMaterial({ color: 0xd7f7ff, roughness: 0.45 }),
      );
      mesh.position.set(point.x, point.y, point.z);
      mesh.userData = { kind: "control-point", u: i, v: j };
      controlPointMeshes.set(pointKey(i, j), mesh);
      group.add(mesh);
    }
  }

  return group;
}

function updateEvaluation(validModel) {
  renderGroup.children
    .filter((child) => child.userData.kind === "marker")
    .forEach((marker) => {
      renderGroup.remove(marker);
      disposeObject(marker);
    });

  if (!validModel) {
    if (document.activeElement !== els.valueU) els.valueU.value = "";
    if (document.activeElement !== els.valueV) els.valueV.value = "";
    els.evalX.textContent = "";
    els.evalY.textContent = "";
    els.evalZ.textContent = "";
    return;
  }

  const domainU = getDomain(validModel.knotsU, validModel.degreeU, validModel.controlPoints.length);
  const domainV = getDomain(validModel.knotsV, validModel.degreeV, validModel.controlPoints[0].length);
  const u = lerp(domainU[0], domainU[1], Number(els.sliderU.value) / 1000);
  const v = lerp(domainV[0], domainV[1], Number(els.sliderV.value) / 1000);
  const point = evaluateSurface(validModel, u, v);

  syncEvaluationInputBounds(domainU, domainV);
  if (document.activeElement !== els.valueU) els.valueU.value = formatNumber(u);
  if (document.activeElement !== els.valueV) els.valueV.value = formatNumber(v);
  els.evalX.textContent = formatNumber(point.x);
  els.evalY.textContent = formatNumber(point.y);
  els.evalZ.textContent = formatNumber(point.z);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xff5a3d, emissive: 0x381006, roughness: 0.35 }),
  );
  marker.position.set(point.x, point.y, point.z);
  marker.userData.kind = "marker";
  renderGroup.add(marker);
}

function commitEvaluationInput(axis) {
  if (!lastValidModel) return;
  const input = axis === "u" ? els.valueU : els.valueV;
  const slider = axis === "u" ? els.sliderU : els.sliderV;
  const domain =
    axis === "u"
      ? getDomain(lastValidModel.knotsU, lastValidModel.degreeU, lastValidModel.controlPoints.length)
      : getDomain(lastValidModel.knotsV, lastValidModel.degreeV, lastValidModel.controlPoints[0].length);
  const value = Number(input.value);

  if (!Number.isFinite(value)) {
    updateEvaluation(lastValidModel);
    reportDataError(`${axis.toUpperCase()} 参数必须是数值`);
    return;
  }

  const clamped = clamp(value, domain[0], domain[1]);
  const range = domain[1] - domain[0];
  slider.value = range === 0 ? "0" : String(Math.round(((clamped - domain[0]) / range) * 1000));
  input.value = formatNumber(clamped);
  updateEvaluation(lastValidModel);
  setStatus("Evaluation updated");
}

function syncEvaluationInputBounds(domainU, domainV) {
  els.valueU.min = String(roundForInput(domainU[0]));
  els.valueU.max = String(roundForInput(domainU[1]));
  els.valueV.min = String(roundForInput(domainV[0]));
  els.valueV.max = String(roundForInput(domainV[1]));
}

function evaluateSurface(validModel, u, v) {
  const nU = validModel.controlPoints.length - 1;
  const nV = validModel.controlPoints[0].length - 1;
  const spanU = findSpan(nU, validModel.degreeU, u, validModel.knotsU);
  const spanV = findSpan(nV, validModel.degreeV, v, validModel.knotsV);
  const basisU = basisFunctions(spanU, u, validModel.degreeU, validModel.knotsU);
  const basisV = basisFunctions(spanV, v, validModel.degreeV, validModel.knotsV);
  const numerator = { x: 0, y: 0, z: 0 };
  let denominator = 0;

  for (let l = 0; l <= validModel.degreeV; l += 1) {
    for (let k = 0; k <= validModel.degreeU; k += 1) {
      const point = validModel.controlPoints[spanU - validModel.degreeU + k][spanV - validModel.degreeV + l];
      const factor = basisU[k] * basisV[l] * point.w;
      numerator.x += factor * point.x;
      numerator.y += factor * point.y;
      numerator.z += factor * point.z;
      denominator += factor;
    }
  }

  return {
    x: numerator.x / denominator,
    y: numerator.y / denominator,
    z: numerator.z / denominator,
  };
}

function findSpan(n, degree, value, knots) {
  if (value >= knots[n + 1]) return n;
  if (value <= knots[degree]) return degree;

  let low = degree;
  let high = n + 1;
  let mid = Math.floor((low + high) / 2);

  while (value < knots[mid] || value >= knots[mid + 1]) {
    if (value < knots[mid]) {
      high = mid;
    } else {
      low = mid;
    }
    mid = Math.floor((low + high) / 2);
  }

  return mid;
}

function basisFunctions(span, value, degree, knots) {
  const basis = Array.from({ length: degree + 1 }, () => 0);
  const left = Array.from({ length: degree + 1 }, () => 0);
  const right = Array.from({ length: degree + 1 }, () => 0);
  basis[0] = 1;

  for (let j = 1; j <= degree; j += 1) {
    left[j] = value - knots[span + 1 - j];
    right[j] = knots[span + j] - value;
    let saved = 0;

    for (let r = 0; r < j; r += 1) {
      const denominator = right[r + 1] + left[j - r];
      const temp = denominator === 0 ? 0 : basis[r] / denominator;
      basis[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    basis[j] = saved;
  }

  return basis;
}

function syncFormFromModel(nextModel) {
  els.degreeU.value = String(nextModel.degreeU);
  els.degreeV.value = String(nextModel.degreeV);
  els.countU.value = String(nextModel.controlPoints.length);
  els.countV.value = String(nextModel.controlPoints[0].length);
  els.knotsU.value = formatKnots(nextModel.knotsU);
  els.knotsV.value = formatKnots(nextModel.knotsV);
  syncPointSelectors(nextModel);
  syncPointEditor();
  syncJumpInputs(nextModel);
  syncControlPointList();
}

function syncPointSelectors(nextModel) {
  fillSelect(els.pointU, nextModel.controlPoints.length, selected.u);
  fillSelect(els.pointV, nextModel.controlPoints[0].length, selected.v);
}

function syncPointEditor() {
  const ref = hovered ?? selected;
  const point = model.controlPoints[ref.u]?.[ref.v];
  if (!point) return;
  els.pointHint.textContent = `${hovered ? "Hover" : "Selected"} P[${ref.u}, ${ref.v}]`;
  els.controlPointSection.classList.toggle("hover-matched", Boolean(hovered));
  els.pointX.value = String(roundForInput(point.x));
  els.pointY.value = String(roundForInput(point.y));
  els.pointZ.value = String(roundForInput(point.z));
  els.pointW.value = String(roundForInput(point.w));
}

function syncJumpInputs(nextModel) {
  els.jumpU.max = String(nextModel.controlPoints.length - 1);
  els.jumpV.max = String(nextModel.controlPoints[0].length - 1);
  els.jumpU.value = String(selected.u);
  els.jumpV.value = String(selected.v);
}

function syncControlPointList() {
  const rows = [];
  const countU = model.controlPoints.length;
  const countV = model.controlPoints[0].length;

  for (let i = 0; i < countU; i += 1) {
    for (let j = 0; j < countV; j += 1) {
      const point = model.controlPoints[i][j];
      rows.push(`
        <button class="point-row" type="button" data-u="${i}" data-v="${j}">
          <strong>P[${i}, ${j}]</strong>
          <span>X ${formatNumber(point.x)}</span>
          <span>Y ${formatNumber(point.y)}</span>
          <span>Z ${formatNumber(point.z)}</span>
          <span>W ${formatNumber(point.w)}</span>
        </button>
      `);
    }
  }

  els.controlPointList.innerHTML = rows.join("");
  updateControlPointListHighlights();
}

function updateControlPointListHighlights() {
  els.controlPointList.querySelectorAll(".point-row").forEach((row) => {
    const u = Number(row.dataset.u);
    const v = Number(row.dataset.v);
    row.classList.toggle("selected", u === selected.u && v === selected.v);
    row.classList.toggle("hovered", Boolean(hovered && u === hovered.u && v === hovered.v));
  });
}

function fillSelect(select, count, active) {
  select.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = String(index);
    option.selected = index === active;
    select.appendChild(option);
  }
}

function selectControlPoint(u, v, options = {}) {
  const countU = model.controlPoints.length;
  const countV = model.controlPoints[0].length;
  selected = {
    u: clamp(u, 0, countU - 1),
    v: clamp(v, 0, countV - 1),
  };
  hovered = null;
  syncPointSelectors(model);
  syncPointEditor();
  syncJumpInputs(model);
  syncControlPointList();
  updateControlPointVisuals();
  attachTransformToSelected();
  if (options.status) {
    setStatus(options.status);
  }
}

function setHoveredControlPoint(next) {
  if (isDraggingControlPoint) return;
  const normalized = next
    ? {
        u: clamp(next.u, 0, model.controlPoints.length - 1),
        v: clamp(next.v, 0, model.controlPoints[0].length - 1),
      }
    : null;

  if (
    (hovered === null && normalized === null) ||
    (hovered && normalized && hovered.u === normalized.u && hovered.v === normalized.v)
  ) {
    return;
  }

  hovered = normalized;
  syncPointEditor();
  updateControlPointListHighlights();
  updateControlPointVisuals();
}

function attachTransformToSelected() {
  const mesh = controlPointMeshes.get(pointKey(selected.u, selected.v));
  if (!mesh) {
    transformControls.detach();
    return;
  }
  transformControls.enabled = true;
  transformControls.attach(mesh);
}

function updateControlPointVisuals() {
  controlPointMeshes.forEach((mesh) => {
    const { u, v } = mesh.userData;
    const isSelected = u === selected.u && v === selected.v;
    const isHovered = hovered && u === hovered.u && v === hovered.v;
    mesh.material.color.set(isSelected ? 0xff5a3d : isHovered ? 0xf3b75b : 0xd7f7ff);
    mesh.material.emissive.set(isSelected || isHovered ? 0x2a1408 : 0x000000);
    const scale = isSelected ? 1.45 : isHovered ? 1.25 : 1;
    mesh.scale.setScalar(scale);
  });
}

function handleScenePointerDown(event) {
  if (isDraggingControlPoint || event.button !== 0) return;
  const hit = pickControlPoint(event);
  updateTransformControlAvailability(hit);
}

function handleScenePointerMove(event) {
  if (isDraggingControlPoint) return;
  const hit = pickControlPoint(event);
  updateTransformControlAvailability(hit);
  if (!hit) {
    setHoveredControlPoint(null);
    renderer.domElement.style.cursor = "default";
    return;
  }
  renderer.domElement.style.cursor = "pointer";
  setHoveredControlPoint({ u: hit.userData.u, v: hit.userData.v });
}

function handleSceneClick(event) {
  if (isDraggingControlPoint) return;
  if (controls.didMoveRecently()) return;
  const hit = pickControlPoint(event);
  if (!hit) return;
  selectControlPoint(hit.userData.u, hit.userData.v, {
    status: "Control point selected",
  });
}

function updateTransformControlAvailability(hit) {
  const canUseTransform =
    !hit || (hit.userData.u === selected.u && hit.userData.v === selected.v);
  transformControls.enabled = canUseTransform;
}

function pickControlPoint(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...controlPointMeshes.values()], false);
  return hits[0]?.object ?? null;
}

function downloadModel() {
  const blob = new Blob([`${JSON.stringify(serializeModelForJson(lastValidModel), null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "nurbs-surface.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function uploadModel(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const imported = normalizeImportedModel(JSON.parse(text));
    validateModel(imported);
    model = imported;
    lastValidModel = cloneModel(imported);
    selected = { u: 0, v: 0 };
    syncFormFromModel(model);
    drawModel(model);
    setStatus("JSON loaded");
    lastAlertedDataError = "";
  } catch (error) {
    reportDataError(`JSON 导入失败：${error.message}`);
  }
}

function normalizeImportedModel(value) {
  if (!value || typeof value !== "object") {
    throw new Error("JSON 根节点必须是对象");
  }
  const controlPoints = value.controlPoints;
  if (!Array.isArray(controlPoints)) {
    throw new Error("JSON 必须包含 controlPoints");
  }

  return {
    degreeU: Number(value.degreeU),
    degreeV: Number(value.degreeV),
    knotsU: Array.isArray(value.knotsU) ? value.knotsU.map(Number) : [],
    knotsV: Array.isArray(value.knotsV) ? value.knotsV.map(Number) : [],
    controlPoints: controlPoints.map((row, rowIndex) => {
      if (!Array.isArray(row)) return row;
      return row.map((point, columnIndex) => normalizeControlPoint(point, rowIndex, columnIndex));
    }),
  };
}

function normalizeControlPoint(point, rowIndex, columnIndex) {
  if (Array.isArray(point)) {
    if (point.length !== 4) {
      throw new Error(`控制点 [${rowIndex}, ${columnIndex}] 必须是 [x, y, z, w] 四元数组`);
    }
    return {
      x: Number(point[0]),
      y: Number(point[1]),
      z: Number(point[2]),
      w: Number(point[3]),
    };
  }

  // Backward compatible with older exported files that used object keys.
  if (point && typeof point === "object") {
    return {
      x: Number(point.x),
      y: Number(point.y),
      z: Number(point.z),
      w: Number(point.w),
    };
  }

  throw new Error(`控制点 [${rowIndex}, ${columnIndex}] 必须是 [x, y, z, w] 数组`);
}

function serializeModelForJson(value) {
  return {
    degreeU: value.degreeU,
    degreeV: value.degreeV,
    knotsU: value.knotsU,
    knotsV: value.knotsV,
    controlPoints: value.controlPoints.map((row) =>
      row.map((point) => [point.x, point.y, point.z, point.w]),
    ),
  };
}

function getDomain(knots, degree, count) {
  return [knots[degree], knots[count]];
}

function formatKnots(knots) {
  return knots.map((value) => roundForInput(value)).join(", ");
}

function formatNumber(value) {
  return Number(value).toFixed(POINT_DECIMALS);
}

function roundForInput(value) {
  return Math.round(Number(value) * 1000000) / 1000000;
}

function readInteger(input, fallback) {
  const value = Number(input.value);
  return Number.isInteger(value) ? value : fallback;
}

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function cloneModel(value) {
  return JSON.parse(JSON.stringify(value));
}

function pushPoint(target, point) {
  target.push(point.x, point.y, point.z);
}

function pointKey(u, v) {
  return `${u}:${v}`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message, isError = false) {
  els.statusText.textContent = message;
  els.statusText.classList.toggle("error", isError);
  if (!isError) {
    lastAlertedDataError = "";
  }
}

function reportDataError(message) {
  setStatus(message, true);
  if (message === lastAlertedDataError) return;
  lastAlertedDataError = message;
  window.alert(message);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = els.scene;
  if (!clientWidth || !clientHeight) return;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function createQuaternionCameraControls(cameraRef, element, options = {}) {
  const target = options.target?.clone?.() ?? new THREE.Vector3();
  const minDistance = options.minDistance ?? 1.2;
  const maxDistance = options.maxDistance ?? 80;
  const rotateSpeed = options.rotateSpeed ?? 0.006;
  const panSpeed = options.panSpeed ?? 0.0016;
  const zoomSpeed = options.zoomSpeed ?? 0.0015;
  const offset = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const yaw = new THREE.Quaternion();
  const pitch = new THREE.Quaternion();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const pan = new THREE.Vector3();
  const start = new THREE.Vector2();
  const current = new THREE.Vector2();
  const api = {
    enabled: true,
    target,
    didMoveRecently: () => recentMove,
    update: () => undefined,
  };
  let mode = null;
  let distance = cameraRef.position.distanceTo(target);
  let recentMove = false;
  let recentMoveTimer = 0;

  cameraRef.lookAt(target);
  cameraRef.updateMatrixWorld();
  element.addEventListener("contextmenu", (event) => event.preventDefault());
  element.addEventListener("pointerdown", handlePointerDown);
  element.addEventListener("pointermove", handlePointerMove);
  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("pointercancel", handlePointerUp);
  element.addEventListener("wheel", handleWheel, { passive: false });

  function handlePointerDown(event) {
    if (!api.enabled || event.button > 2) return;
    mode = event.button === 2 || event.shiftKey ? "pan" : "rotate";
    start.set(event.clientX, event.clientY);
    current.copy(start);
    element.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!api.enabled || !mode) return;
    current.set(event.clientX, event.clientY);
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    if (dx === 0 && dy === 0) return;
    start.copy(current);
    markMoved();

    if (mode === "pan") {
      panCamera(dx, dy);
    } else {
      rotateCamera(dx, dy);
    }
  }

  function handlePointerUp(event) {
    mode = null;
    if (element.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event) {
    if (!api.enabled) return;
    event.preventDefault();
    const scale = Math.exp(event.deltaY * zoomSpeed);
    distance = clamp(distance * scale, minDistance, maxDistance);
    offset.subVectors(cameraRef.position, target).setLength(distance);
    cameraRef.position.copy(target).add(offset);
  }

  function rotateCamera(dx, dy) {
    offset.subVectors(cameraRef.position, target);
    distance = clamp(offset.length(), minDistance, maxDistance);
    right.set(1, 0, 0).applyQuaternion(cameraRef.quaternion).normalize();
    up.set(0, 1, 0).applyQuaternion(cameraRef.quaternion).normalize();
    yaw.setFromAxisAngle(up, -dx * rotateSpeed);
    pitch.setFromAxisAngle(right, -dy * rotateSpeed);
    rotation.copy(yaw).premultiply(pitch).normalize();
    offset.applyQuaternion(rotation).setLength(distance);
    cameraRef.position.copy(target).add(offset);
    cameraRef.quaternion.premultiply(rotation).normalize();
  }

  function panCamera(dx, dy) {
    distance = cameraRef.position.distanceTo(target);
    right.set(1, 0, 0).applyQuaternion(cameraRef.quaternion).normalize();
    up.set(0, 1, 0).applyQuaternion(cameraRef.quaternion).normalize();
    pan
      .copy(right)
      .multiplyScalar(-dx * panSpeed * distance)
      .add(up.multiplyScalar(dy * panSpeed * distance));
    target.add(pan);
    cameraRef.position.add(pan);
  }

  function markMoved() {
    recentMove = true;
    window.clearTimeout(recentMoveTimer);
    recentMoveTimer = window.setTimeout(() => {
      recentMove = false;
    }, 80);
  }

  return api;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
}
