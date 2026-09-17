/*
 * OUTPUT-ONLY animation stripping.
 * The uploaded SVG stays untouched in the UI.
 * Animation elements are removed only from the cloned SVG used for XML output.
 */
function stripSvgAnimationsForOutput(root) {
  if (!root) return root;

  const animationTags = new Set([
    "animate",
    "animateMotion",
    "animateTransform",
    "set",
  ]);

  const clone = root.cloneNode(true);

  clone.querySelectorAll("*").forEach((el) => {
    if (animationTags.has((el.localName || el.tagName || "").toLowerCase())) {
      el.remove();
    }

    // Remove SVG animation-related attributes from output only.
    [
      "begin",
      "dur",
      "end",
      "repeatCount",
      "repeatDur",
      "restart",
      "fill",
      "calcMode",
      "values",
      "keyTimes",
      "keySplines",
      "from",
      "to",
      "by",
      "attributeName",
      "attributeType",
    ].forEach((attr) => {
      // Do not remove ordinary fill used for painting.
      if (attr === "fill") return;
      el.removeAttribute(attr);
    });
  });

  return clone;
}

/* =========================================================
   FINAL SANITY CHECK
========================================================= */
if (typeof showPreview === "function") {
  console.info("[SVG→AM] Preview mode: original SVG animation preserved.");
}

/* =========================================================
   ELEMENT
========================================================= */

const fileInput = document.getElementById("file");

const drop = document.getElementById("drop");

const preview = document.getElementById("preview");

const output = document.getElementById("output");

const projectName = document.getElementById("projectName");

const duration = document.getElementById("duration");

const fps = document.getElementById("fps");

const canvasWidth = document.getElementById("canvasWidth");

const canvasHeight = document.getElementById("canvasHeight");

const color = document.getElementById("color");

const colorText = document.getElementById("colorText");

const forceColor = document.getElementById("forceColor");

const mergeDuplicates = document.getElementById("mergeDuplicates");

const statusBox = document.getElementById("status");

const outputBox = document.getElementById("output");

let svgSource = "";

let lastVectors = [];
let lastDuplicateCount = 0;
let lastEmptyCount = 0;

/* =========================================================
   UTIL
========================================================= */

function num(value, fallback = 0) {
  const n = parseFloat(value);

  return Number.isFinite(n) ? n : fallback;
}

function clean(value) {
  if (!Number.isFinite(value)) {
    return "0.000000";
  }

  if (Math.abs(value) < 0.0000005) {
    value = 0;
  }

  return Number(value.toFixed(6)).toFixed(6);
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setStatus(text, type = "") {
  statusBox.textContent = text;

  statusBox.className = "status " + type;
}

/* =========================================================
   FILE
========================================================= */

drop.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (file) {
    loadSVG(file);
  }
});

drop.addEventListener("dragover", (event) => {
  event.preventDefault();

  drop.classList.add("drag");
});

drop.addEventListener("dragleave", () => {
  drop.classList.remove("drag");
});

drop.addEventListener("drop", (event) => {
  event.preventDefault();

  drop.classList.remove("drag");

  const file = event.dataTransfer.files[0];

  if (file) {
    loadSVG(file);
  }
});

function loadSVG(file) {
  if (!file.name.toLowerCase().endsWith(".svg")) {
    setStatus("File harus SVG.", "error");

    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    svgSource = reader.result;

    projectName.value = file.name.replace(/\.svg$/i, "");

    showPreview();

    setStatus("SVG berhasil dimuat.", "ok");
  };

  reader.onerror = () => {
    setStatus("Gagal membaca file SVG.", "error");
  };

  reader.readAsText(file);
}

/* =========================================================
   COLOR
========================================================= */

color.addEventListener("input", () => {
  colorText.value = color.value.toUpperCase();
});

colorText.addEventListener("input", () => {
  if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) {
    color.value = colorText.value;
  }
});

function rgbToAM(r, g, b, alpha = 1) {
  r = Math.max(0, Math.min(255, Math.round(r)));

  g = Math.max(0, Math.min(255, Math.round(g)));

  b = Math.max(0, Math.min(255, Math.round(b)));

  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));

  return (
    "#" +
    a.toString(16).padStart(2, "0") +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

function colorToAM(value, opacity = 1) {
  value = String(value || "")
    .trim()
    .toLowerCase();

  const names = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    orange: "#ffa500",
    purple: "#800080",
    gray: "#808080",
    grey: "#808080",
  };

  if (names[value]) {
    value = names[value];
  }

  const rgba = value.match(/^rgba?\(([^)]+)\)$/);

  if (rgba) {
    const parts = rgba[1].split(",").map((x) => x.trim());

    const r = num(parts[0]);

    const g = num(parts[1]);

    const b = num(parts[2]);

    let a = opacity;

    if (parts[3] !== undefined) {
      a *= num(parts[3], 1);
    }

    return rgbToAM(r, g, b, a);
  }

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    value =
      "#" + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
  }

  if (/^#[0-9a-f]{4}$/i.test(value)) {
    const r = parseInt(value[1] + value[1], 16);

    const g = parseInt(value[2] + value[2], 16);

    const b = parseInt(value[3] + value[3], 16);

    const a = parseInt(value[4] + value[4], 16) / 255;

    return rgbToAM(r, g, b, a * opacity);
  }

  if (/^#[0-9a-f]{6}$/i.test(value)) {
    const r = parseInt(value.slice(1, 3), 16);

    const g = parseInt(value.slice(3, 5), 16);

    const b = parseInt(value.slice(5, 7), 16);

    return rgbToAM(r, g, b, opacity);
  }

  return rgbToAM(255, 255, 255, opacity);
}

/* =========================================================
   MATRIX
========================================================= */

function matrixMultiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],

    a[1] * b[0] + a[3] * b[1],

    a[0] * b[2] + a[2] * b[3],

    a[1] * b[2] + a[3] * b[3],

    a[0] * b[4] + a[2] * b[5] + a[4],

    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMatrix(matrix, x, y) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],

    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function parseTransform(text) {
  let result = [1, 0, 0, 1, 0, 0];

  if (!text) return result;

  const regex = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

  let match;

  while ((match = regex.exec(text))) {
    const type = match[1].toLowerCase();

    const values = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    let matrix = [1, 0, 0, 1, 0, 0];

    if (type === "matrix" && values.length >= 6) {
      matrix = values.slice(0, 6);
    } else if (type === "translate") {
      matrix = [1, 0, 0, 1, values[0] || 0, values[1] || 0];
    } else if (type === "scale") {
      const sx = values[0] ?? 1;

      const sy = values[1] ?? sx;

      matrix = [sx, 0, 0, sy, 0, 0];
    } else if (type === "rotate") {
      const angle = ((values[0] || 0) * Math.PI) / 180;

      const c = Math.cos(angle);

      const s = Math.sin(angle);

      const rotation = [c, s, -s, c, 0, 0];

      if (values.length >= 3) {
        const cx = values[1];

        const cy = values[2];

        matrix = matrixMultiply(
          matrixMultiply([1, 0, 0, 1, cx, cy], rotation),
          [1, 0, 0, 1, -cx, -cy],
        );
      } else {
        matrix = rotation;
      }
    } else if (type === "skewx") {
      const angle = ((values[0] || 0) * Math.PI) / 180;

      matrix = [1, 0, Math.tan(angle), 1, 0, 0];
    } else if (type === "skewy") {
      const angle = ((values[0] || 0) * Math.PI) / 180;

      matrix = [1, Math.tan(angle), 0, 1, 0, 0];
    }

    result = matrixMultiply(result, matrix);
  }

  return result;
}

/* =========================================================
   SVG VIEWBOX
========================================================= */

function getSVGInfo(svg) {
  let width = num(svg.getAttribute("width"), 1080);

  let height = num(svg.getAttribute("height"), 1080);

  let minX = 0;
  let minY = 0;

  const viewBox = svg.getAttribute("viewBox");

  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (values.length === 4 && values.every(Number.isFinite)) {
      minX = values[0];

      minY = values[1];

      width = values[2];

      height = values[3];
    }
  }

  return {
    minX,
    minY,
    width,
    height,
  };
}

function getAnimatedAttributeValue(element, attributeName) {
  if (!element) return null;
  const wanted = String(attributeName || "").toLowerCase();
  let value = element.getAttribute(attributeName);

  for (const child of Array.from(element.children || [])) {
    const tag = (child.localName || child.tagName || "").toLowerCase();
    if (!["set", "animate", "animatecolor", "animatetransform"].includes(tag))
      continue;

    const attr =
      child.getAttribute("attributeName") ||
      child.getAttribute("attributename");
    if (!attr || attr.toLowerCase() !== wanted) continue;

    const values = child.getAttribute("values");
    if (values && values.trim()) {
      const frames = values
        .split(";")
        .map((v) => v.trim())
        .filter(Boolean);
      if (frames.length) value = frames[frames.length - 1];
    }

    const to = child.getAttribute("to");
    if (to && to.trim()) value = to.trim();

    if ((value == null || value === "") && child.getAttribute("from")) {
      value = child.getAttribute("from").trim();
    }
  }

  return value == null ? null : String(value).trim();
}

/* Recover final static transform from animateTransform. Animation is not exported. */
function getAnimatedTransformValue(element) {
  if (!element) return null;
  let result = null;
  for (const child of Array.from(element.children || [])) {
    const tag = (child.localName || child.tagName || "").toLowerCase();
    if (tag !== "animatetransform") continue;
    const type = (child.getAttribute("type") || "translate")
      .trim()
      .toLowerCase();
    let frame = null;
    const values = child.getAttribute("values");
    if (values && values.trim()) {
      const frames = values
        .split(";")
        .map((v) => v.trim())
        .filter(Boolean);
      if (frames.length) frame = frames[frames.length - 1];
    }
    const to = child.getAttribute("to");
    if (to && to.trim()) frame = to.trim();
    if (!frame) {
      const from = child.getAttribute("from");
      if (from && from.trim()) frame = from.trim();
    }
    if (!frame) continue;
    const nums = frame
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (!nums.length) continue;
    if (type === "scale") {
      const sx = nums[0],
        sy = nums.length > 1 ? nums[1] : sx;
      result = `scale(${sx} ${sy})`;
    } else if (type === "translate") {
      result = `translate(${nums[0] || 0} ${nums.length > 1 ? nums[1] : 0})`;
    } else if (type === "rotate") {
      result =
        nums.length >= 3
          ? `rotate(${nums[0] || 0} ${nums[1]} ${nums[2]})`
          : `rotate(${nums[0] || 0})`;
    } else if (type === "skewx") {
      result = `skewX(${nums[0] || 0})`;
    } else if (type === "skewy") {
      result = `skewY(${nums[0] || 0})`;
    } else if (type === "matrix" && nums.length >= 6) {
      result = `matrix(${nums.slice(0, 6).join(" ")})`;
    }
  }
  return result;
}

/* =========================================================
   SVG ELEMENT TO PATH
========================================================= */

function elementToPath(element) {
  if (!element) return "";
  const tag = (element.localName || element.tagName || "").toLowerCase();

  const animated = (name, fallback = "0") => {
    const value = getAnimatedAttributeValue(element, name);
    if (value !== null && value !== "") return value;
    const attr = element.getAttribute(name);
    return attr !== null && attr !== "" ? attr : fallback;
  };

  if (tag === "path") {
    return animated("d", "").trim();
  }

  if (tag === "line") {
    return `M ${num(animated("x1"))} ${num(animated("y1"))} L ${num(animated("x2"))} ${num(animated("y2"))}`;
  }

  if (tag === "rect") {
    const x = num(animated("x"));
    const y = num(animated("y"));
    const w = num(animated("width"));
    const h = num(animated("height"));
    if (w <= 0 || h <= 0) return "";

    let rx = num(animated("rx"));
    let ry = num(animated("ry"));
    if (!rx && !ry)
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    if (!rx) rx = ry;
    if (!ry) ry = rx;
    rx = Math.min(Math.abs(rx), w / 2);
    ry = Math.min(Math.abs(ry), h / 2);
    const k = 0.5522847498;
    return [
      `M ${x + rx} ${y}`,
      `L ${x + w - rx} ${y}`,
      `C ${x + w - rx + k * rx} ${y} ${x + w} ${y + ry - k * ry} ${x + w} ${y + ry}`,
      `L ${x + w} ${y + h - ry}`,
      `C ${x + w} ${y + h - ry + k * ry} ${x + w - rx + k * rx} ${y + h} ${x + w - rx} ${y + h}`,
      `L ${x + rx} ${y + h}`,
      `C ${x + rx - k * rx} ${y + h} ${x} ${y + h - ry + k * ry} ${x} ${y + h - ry}`,
      `L ${x} ${y + ry}`,
      `C ${x} ${y + ry - k * ry} ${x + rx - k * rx} ${y} ${x + rx} ${y}`,
      "Z",
    ].join(" ");
  }

  if (tag === "circle" || tag === "ellipse") {
    const cx = num(animated("cx"));
    const cy = num(animated("cy"));
    const rx =
      tag === "circle"
        ? Math.abs(num(animated("r")))
        : Math.abs(num(animated("rx")));
    const ry = tag === "circle" ? rx : Math.abs(num(animated("ry")));
    if (rx <= 0 || ry <= 0) return "";
    const k = 0.5522847498;
    return [
      `M ${cx + rx} ${cy}`,
      `C ${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry}`,
      `C ${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy}`,
      `C ${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry}`,
      `C ${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy}`,
      "Z",
    ].join(" ");
  }

  if (tag === "polygon" || tag === "polyline") {
    const points = String(animated("points", "")).trim();
    if (!points) return "";
    const values = points
      .replace(/,/g, " ")
      .split(/\s+/)
      .map(Number)
      .filter(Number.isFinite);
    if (values.length < 4) return "";
    let d = `M ${values[0]} ${values[1]}`;
    for (let i = 2; i + 1 < values.length; i += 2)
      d += ` L ${values[i]} ${values[i + 1]}`;
    if (tag === "polygon") d += " Z";
    return d;
  }

  return "";
}

/* =========================================================
   PATH TOKENIZER
========================================================= */

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
}

/* =========================================================
   ARC TO CUBIC
========================================================= */

function arcToCubic(x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  if (rx < 0.0000001 || ry < 0.0000001) {
    return [
      {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        x: x2,
        y: y2,
      },
    ];
  }

  const phi = (angle * Math.PI) / 180;

  const cosPhi = Math.cos(phi);

  const sinPhi = Math.sin(phi);

  const dx = (x1 - x2) / 2;

  const dy = (y1 - y2) / 2;

  const xPrime = cosPhi * dx + sinPhi * dy;

  const yPrime = -sinPhi * dx + cosPhi * dy;

  let lambda = (xPrime * xPrime) / (rx * rx) + (yPrime * yPrime) / (ry * ry);

  if (lambda > 1) {
    const scale = Math.sqrt(lambda);

    rx *= scale;
    ry *= scale;
  }

  const numerator =
    rx * rx * ry * ry - rx * rx * yPrime * yPrime - ry * ry * xPrime * xPrime;

  const denominator = rx * rx * yPrime * yPrime + ry * ry * xPrime * xPrime;

  const sign = largeArc === sweep ? -1 : 1;

  const factor =
    denominator === 0
      ? 0
      : sign * Math.sqrt(Math.max(0, numerator / denominator));

  const cxPrime = factor * ((rx * yPrime) / ry);

  const cyPrime = factor * ((-ry * xPrime) / rx);

  const cx = cosPhi * cxPrime - sinPhi * cyPrime + (x1 + x2) / 2;

  const cy = sinPhi * cxPrime + cosPhi * cyPrime + (y1 + y2) / 2;

  function vectorAngle(ux, uy, vx, vy) {
    const dot = ux * vx + uy * vy;

    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));

    if (!len) return 0;

    let angle = Math.acos(Math.max(-1, Math.min(1, dot / len)));

    if (ux * vy - uy * vx < 0) {
      angle = -angle;
    }

    return angle;
  }

  let startAngle = vectorAngle(
    1,
    0,
    (xPrime - cxPrime) / rx,
    (yPrime - cyPrime) / ry,
  );

  let deltaAngle = vectorAngle(
    (xPrime - cxPrime) / rx,
    (yPrime - cyPrime) / ry,
    (-xPrime - cxPrime) / rx,
    (-yPrime - cyPrime) / ry,
  );

  if (!sweep && deltaAngle > 0) {
    deltaAngle -= Math.PI * 2;
  }

  if (sweep && deltaAngle < 0) {
    deltaAngle += Math.PI * 2;
  }

  const segments = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)));

  const delta = deltaAngle / segments;

  function pointAt(t) {
    const cosT = Math.cos(t);

    const sinT = Math.sin(t);

    return {
      x: cx + cosPhi * rx * cosT - sinPhi * ry * sinT,

      y: cy + sinPhi * rx * cosT + cosPhi * ry * sinT,
    };
  }

  const result = [];

  for (let i = 0; i < segments; i++) {
    const a0 = startAngle + i * delta;

    const a1 = a0 + delta;

    const p0 = pointAt(a0);

    const p3 = pointAt(a1);

    const alpha = (4 / 3) * Math.tan(delta / 4);

    const t0 = {
      x: -rx * Math.sin(a0),
      y: ry * Math.cos(a0),
    };

    const t1 = {
      x: -rx * Math.sin(a1),
      y: ry * Math.cos(a1),
    };

    const c1 = {
      x: p0.x + alpha * (cosPhi * t0.x - sinPhi * t0.y),

      y: p0.y + alpha * (sinPhi * t0.x + cosPhi * t0.y),
    };

    const c2 = {
      x: p3.x - alpha * (cosPhi * t1.x - sinPhi * t1.y),

      y: p3.y - alpha * (sinPhi * t1.x + cosPhi * t1.y),
    };

    result.push({
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: p3.x,
      y: p3.y,
    });
  }

  return result;
}

/* =========================================================
   PATH PARSER
========================================================= */

function parsePath(d) {
  const tokens = tokenizePath(d || "");
  let index = 0,
    command = "";
  let currentX = 0,
    currentY = 0,
    startX = 0,
    startY = 0;
  let lastCubicX = null,
    lastCubicY = null,
    lastQuadX = null,
    lastQuadY = null;
  const commands = [];
  const argCount = {
    M: 2,
    L: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    T: 2,
    A: 7,
    Z: 0,
  };

  function hasNumber() {
    return index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);
  }
  function getNumber() {
    return Number(tokens[index++]);
  }
  function resetSmooth() {
    lastCubicX = lastCubicY = lastQuadX = lastQuadY = null;
  }

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
    if (!command) break;

    const relative = command === command.toLowerCase();
    const cmd = command.toUpperCase();
    if (!(cmd in argCount)) {
      command = "";
      continue;
    }

    if (cmd === "Z") {
      commands.push({ cmd: "Z", values: [] });
      currentX = startX;
      currentY = startY;
      resetSmooth();
      command = "";
      continue;
    }

    const n = argCount[cmd];
    if (!hasNumber()) {
      command = "";
      continue;
    }

    let consumed = false;
    while (hasNumber()) {
      if (index + n > tokens.length) break;
      const a = [];
      let valid = true;
      for (let k = 0; k < n; k++) {
        if (index >= tokens.length || /^[a-zA-Z]$/.test(tokens[index])) {
          valid = false;
          break;
        }
        const v = getNumber();
        if (!Number.isFinite(v)) valid = false;
        a.push(v);
      }
      if (!valid || a.length !== n) break;
      consumed = true;

      if (cmd === "M") {
        let x = a[0],
          y = a[1];
        if (relative) {
          x += currentX;
          y += currentY;
        }
        currentX = x;
        currentY = y;
        startX = x;
        startY = y;
        commands.push({ cmd: "M", values: [x, y] });
        resetSmooth();
        command = relative ? "l" : "L";
      } else if (cmd === "L") {
        let x = a[0],
          y = a[1];
        if (relative) {
          x += currentX;
          y += currentY;
        }
        commands.push({ cmd: "L", values: [x, y] });
        currentX = x;
        currentY = y;
        resetSmooth();
      } else if (cmd === "H") {
        let x = a[0];
        if (relative) x += currentX;
        commands.push({ cmd: "L", values: [x, currentY] });
        currentX = x;
        resetSmooth();
      } else if (cmd === "V") {
        let y = a[0];
        if (relative) y += currentY;
        commands.push({ cmd: "L", values: [currentX, y] });
        currentY = y;
        resetSmooth();
      } else if (cmd === "C") {
        let x1 = a[0],
          y1 = a[1],
          x2 = a[2],
          y2 = a[3],
          x = a[4],
          y = a[5];
        if (relative) {
          x1 += currentX;
          y1 += currentY;
          x2 += currentX;
          y2 += currentY;
          x += currentX;
          y += currentY;
        }
        commands.push({ cmd: "C", values: [x1, y1, x2, y2, x, y] });
        currentX = x;
        currentY = y;
        lastCubicX = x2;
        lastCubicY = y2;
        lastQuadX = lastQuadY = null;
      } else if (cmd === "S") {
        let x2 = a[0],
          y2 = a[1],
          x = a[2],
          y = a[3];
        if (relative) {
          x2 += currentX;
          y2 += currentY;
          x += currentX;
          y += currentY;
        }
        const x1 = lastCubicX === null ? currentX : 2 * currentX - lastCubicX;
        const y1 = lastCubicY === null ? currentY : 2 * currentY - lastCubicY;
        commands.push({ cmd: "C", values: [x1, y1, x2, y2, x, y] });
        currentX = x;
        currentY = y;
        lastCubicX = x2;
        lastCubicY = y2;
        lastQuadX = lastQuadY = null;
      } else if (cmd === "Q") {
        let qx = a[0],
          qy = a[1],
          x = a[2],
          y = a[3];
        if (relative) {
          qx += currentX;
          qy += currentY;
          x += currentX;
          y += currentY;
        }
        const c1x = currentX + (2 / 3) * (qx - currentX),
          c1y = currentY + (2 / 3) * (qy - currentY);
        const c2x = x + (2 / 3) * (qx - x),
          c2y = y + (2 / 3) * (qy - y);
        commands.push({ cmd: "C", values: [c1x, c1y, c2x, c2y, x, y] });
        currentX = x;
        currentY = y;
        lastQuadX = qx;
        lastQuadY = qy;
        lastCubicX = c2x;
        lastCubicY = c2y;
      } else if (cmd === "T") {
        let x = a[0],
          y = a[1];
        if (relative) {
          x += currentX;
          y += currentY;
        }
        const qx = lastQuadX === null ? currentX : 2 * currentX - lastQuadX;
        const qy = lastQuadY === null ? currentY : 2 * currentY - lastQuadY;
        const c1x = currentX + (2 / 3) * (qx - currentX),
          c1y = currentY + (2 / 3) * (qy - currentY);
        const c2x = x + (2 / 3) * (qx - x),
          c2y = y + (2 / 3) * (qy - y);
        commands.push({ cmd: "C", values: [c1x, c1y, c2x, c2y, x, y] });
        currentX = x;
        currentY = y;
        lastQuadX = qx;
        lastQuadY = qy;
        lastCubicX = c2x;
        lastCubicY = c2y;
      } else if (cmd === "A") {
        let rx = a[0],
          ry = a[1],
          rotation = a[2],
          largeArc = a[3] !== 0,
          sweep = a[4] !== 0,
          x = a[5],
          y = a[6];
        if (relative) {
          x += currentX;
          y += currentY;
        }
        if (rx === 0 || ry === 0) {
          commands.push({ cmd: "L", values: [x, y] });
        } else {
          const curves = arcToCubic(
            currentX,
            currentY,
            rx,
            ry,
            rotation,
            largeArc,
            sweep,
            x,
            y,
          );
          if (curves.length) {
            for (const c of curves) {
              commands.push({
                cmd: "C",
                values: [c.x1, c.y1, c.x2, c.y2, c.x, c.y],
              });
              lastCubicX = c.x2;
              lastCubicY = c.y2;
            }
          } else commands.push({ cmd: "L", values: [x, y] });
        }
        currentX = x;
        currentY = y;
        lastQuadX = lastQuadY = null;
      }
    }
    if (!consumed) break;
  }
  return commands;
}

/* =========================================================
   COMMANDS TO PATH
========================================================= */

function commandsToPath(commands) {
  let result = "";

  for (const item of commands) {
    if (item.cmd === "Z") {
      result += "Z";

      continue;
    }

    const v = item.values;

    if (item.cmd === "M") {
      result += `M ${clean(v[0])} ${clean(v[1])} `;
    } else if (item.cmd === "L") {
      result += `L ${clean(v[0])} ${clean(v[1])} `;
    } else if (item.cmd === "C") {
      result +=
        `C ` +
        `${clean(v[0])} ${clean(v[1])} ` +
        `${clean(v[2])} ${clean(v[3])} ` +
        `${clean(v[4])} ${clean(v[5])} `;
    }
  }

  return result.trim();
}

/* =========================================================
   SVG STYLE
========================================================= */

/* =========================================================
   CSS RULE ENGINE
   Reads SVG <style> blocks without changing geometry.
========================================================= */

let svgCSSRules = [];
let svgCSSOrder = 0;

function buildCSSRules(root) {
  svgCSSRules = [];
  svgCSSOrder = 0;

  if (!root) return svgCSSRules;

  const styles = root.querySelectorAll("style");
  for (const styleEl of styles) {
    const text = styleEl.textContent || "";
    const css = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(
        /@(?:font-face|keyframes|media|supports|import)[\s\S]*?\{[\s\S]*?\}/gi,
        "",
      );

    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const selectorText = m[1].trim();
      const body = m[2];
      const declarations = {};

      body.split(";").forEach((part) => {
        const i = part.indexOf(":");
        if (i < 0) return;
        const property = part.slice(0, i).trim().toLowerCase();
        const value = part.slice(i + 1).trim();
        if (property && value) declarations[property] = value;
      });

      if (!Object.keys(declarations).length) continue;

      selectorText.split(",").forEach((selector) => {
        selector = selector.trim();
        if (!selector || selector.startsWith("@")) return;
        svgCSSRules.push({
          selector,
          declarations,
          order: svgCSSOrder++,
          specificity: cssSpecificity(selector),
        });
      });
    }
  }

  return svgCSSRules;
}

function cssSpecificity(selector) {
  const s = selector.replace(/::[\w-]+/g, "");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const tags = (s.match(/(^|[ >+~])([a-zA-Z][\w-]*)/g) || []).length;
  return [ids, classes, tags];
}

function compareSpecificity(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function cssSimpleMatch(element, token) {
  token = token.trim();
  if (!token || !element || element.nodeType !== 1) return false;

  // Remove pseudo classes that are not useful for static SVG conversion.
  token = token.replace(
    /:(hover|active|focus|visited|link|before|after|first-child|last-child|nth-child\([^)]*\))/g,
    "",
  );
  if (!token) return true;

  const tagMatch = token.match(/^([a-zA-Z][\w-]*|\*)/);
  if (
    tagMatch &&
    tagMatch[1] !== "*" &&
    element.tagName.toLowerCase() !== tagMatch[1].toLowerCase()
  )
    return false;

  const idMatches = token.match(/#[\w-]+/g) || [];
  const id = element.getAttribute("id") || "";
  for (const x of idMatches) {
    if (id !== x.slice(1)) return false;
  }

  const classMatches = token.match(/\.[\w-]+/g) || [];
  const classes = (element.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean);
  for (const x of classMatches) {
    if (!classes.includes(x.slice(1))) return false;
  }

  const attrs = token.match(/\[[^\]]+\]/g) || [];
  for (const raw of attrs) {
    const a = raw.slice(1, -1).trim();
    const m = a.match(/^([\w:-]+)\s*(?:([~|^$*]?=)\s*["']?([^"']*)["']?)?$/);
    if (!m) continue;
    const name = m[1];
    const actual = element.getAttribute(name);
    if (actual === null) return false;
    if (m[2]) {
      const expected = m[3].trim();
      if (m[2] === "=" && actual !== expected) return false;
      if (m[2] === "~=" && !actual.split(/\s+/).includes(expected))
        return false;
      if (
        m[2] === "|=" &&
        actual !== expected &&
        !actual.startsWith(expected + "-")
      )
        return false;
      if (m[2] === "^=" && !actual.startsWith(expected)) return false;
      if (m[2] === "$=" && !actual.endsWith(expected)) return false;
      if (m[2] === "*=" && !actual.includes(expected)) return false;
    }
  }
  return true;
}

function cssSelectorMatch(element, selector) {
  selector = selector.trim().replace(/\s+/g, " ");
  if (!selector) return false;

  // Child combinator.
  if (selector.includes(">")) {
    const parts = selector
      .split(">")
      .map((x) => x.trim())
      .filter(Boolean);
    let current = element;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!current || !cssSimpleMatch(current, parts[i])) return false;
      if (i > 0) current = current.parentElement;
    }
    return true;
  }

  // Descendant combinator.
  const parts = selector.split(" ").filter(Boolean);
  let current = element;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!current) return false;
    if (i === parts.length - 1) {
      if (!cssSimpleMatch(current, parts[i])) return false;
    } else {
      let found = false;
      current = current.parentElement;
      while (current) {
        if (cssSimpleMatch(current, parts[i])) {
          found = true;
          break;
        }
        current = current.parentElement;
      }
      if (!found) return false;
    }
  }
  return true;
}

function getCSSProperty(element, property) {
  if (!element || !svgCSSRules.length) return null;
  property = property.toLowerCase();

  let best = null;
  for (const rule of svgCSSRules) {
    if (!Object.prototype.hasOwnProperty.call(rule.declarations, property))
      continue;
    if (!cssSelectorMatch(element, rule.selector)) continue;

    if (
      !best ||
      compareSpecificity(rule.specificity, best.specificity) > 0 ||
      (compareSpecificity(rule.specificity, best.specificity) === 0 &&
        rule.order > best.order)
    ) {
      best = rule;
    }
  }
  return best ? best.declarations[property] : null;
}

function getStyleValue(element, property) {
  property = property.toLowerCase();

  const direct = element.getAttribute(property);
  if (direct !== null) return direct;

  const style = element.getAttribute("style");
  if (style) {
    const regex = new RegExp(
      "(?:^|;)\\s*" + property + "\\s*:\\s*([^;]+)",
      "i",
    );
    const match = style.match(regex);
    if (match) return match[1].trim();
  }

  const css = getCSSProperty(element, property);
  if (css !== null && css !== undefined) return css;

  return null;
}

function getInheritedStyle(element, property, fallback) {
  let current = element;

  while (current && current.nodeType === 1) {
    const value = getStyleValue(current, property);

    if (value !== null && value !== "inherit") {
      return value;
    }

    current = current.parentElement;
  }

  return fallback;
}

function getOpacity(element) {
  let opacity = 1;

  let current = element;

  const values = [];

  while (current && current.nodeType === 1) {
    const value = getStyleValue(current, "opacity");

    if (value !== null) {
      values.push(num(value, 1));
    }

    const fillOpacity = getStyleValue(current, "fill-opacity");

    if (fillOpacity !== null) {
      values.push(num(fillOpacity, 1));
    }

    current = current.parentElement;
  }

  for (const value of values) {
    opacity *= value;
  }

  return Math.max(0, Math.min(1, opacity));
}

function getFill(element) {
  const value = getInheritedStyle(element, "fill", "#000000");

  if (value === "none") {
    return null;
  }

  return value;
}

/* =========================================================
   SHADOW / FILTER SUPPORT
   SVG filter shadows are approximated as real AM vector layers.
   AM's simple fillColor/path structure cannot reproduce a browser
   Gaussian blur exactly, so we create several low-opacity offset
   copies. This keeps the shadow visible instead of silently dropping it.
========================================================= */

function parseShadowColor(value, fallback = "#000000") {
  if (!value) return fallback;
  value = String(value).trim();
  if (value.toLowerCase() === "currentcolor") return fallback;
  return value;
}

function getFilterId(element) {
  const value = getInheritedStyle(element, "filter", "");
  const m = String(value || "").match(/url\(\s*["']?#([^"')]+)["']?\s*\)/i);
  return m ? m[1] : null;
}

function readFilterShadowSpecs(element) {
  const id = getFilterId(element);
  if (!id) return [];

  const doc = element.ownerDocument;
  const filter = doc.getElementById(id);
  if (!filter) return [];

  const specs = [];
  const children = [...filter.children];

  for (const node of children) {
    const tag = node.tagName.toLowerCase();

    if (tag === "fedropshadow") {
      specs.push({
        dx: num(node.getAttribute("dx"), 2),
        dy: num(node.getAttribute("dy"), 2),
        blur: Math.max(0, num(node.getAttribute("stdDeviation"), 0)),
        color: parseShadowColor(node.getAttribute("flood-color"), "#000000"),
        opacity: num(node.getAttribute("flood-opacity"), 1),
      });
      continue;
    }

    /* Common Illustrator/Figma style chain:
           feGaussianBlur + feOffset + feFlood.
        */
    if (tag === "fegaussianblur") {
      const inName = node.getAttribute("in") || "SourceGraphic";
      const blur = Math.max(
        0,
        num((node.getAttribute("stdDeviation") || "").split(/[ ,]+/)[0], 0),
      );
      const offset = children.find(
        (x) =>
          x.tagName.toLowerCase() === "feoffset" &&
          (x.getAttribute("in") || "") === inName,
      );
      const flood = children.find((x) => x.tagName.toLowerCase() === "feflood");

      if (blur > 0 || offset || flood) {
        specs.push({
          dx: offset ? num(offset.getAttribute("dx"), 0) : 0,
          dy: offset ? num(offset.getAttribute("dy"), 0) : 0,
          blur,
          color: parseShadowColor(
            flood?.getAttribute("flood-color"),
            "#000000",
          ),
          opacity: num(flood?.getAttribute("flood-opacity"), 1),
        });
      }
    }
  }

  return specs;
}

function shiftCommands(commands, dx, dy) {
  return commands.map((item) => {
    if (item.cmd === "Z") return { cmd: "Z", values: [] };
    const v = item.values.slice();
    if (item.cmd === "M" || item.cmd === "L") {
      v[0] += dx;
      v[1] += dy;
    } else if (item.cmd === "C") {
      v[0] += dx;
      v[1] += dy;
      v[2] += dx;
      v[3] += dy;
      v[4] += dx;
      v[5] += dy;
    }
    return { cmd: item.cmd, values: v };
  });
}

function makeShadowLayers(transformed, baseOpacity, spec) {
  if (!spec || spec.opacity <= 0) return [];

  const blur = Math.min(40, Math.max(0, spec.blur || 0));
  const layers = [];

  if (blur <= 0) {
    layers.push({
      commands: shiftCommands(transformed, spec.dx, spec.dy),
      opacity: Math.min(1, baseOpacity * spec.opacity),
    });
    return layers;
  }

  /* More layers = softer edge. Keep it bounded so a giant SVG filter
       does not produce hundreds of AM layers. */
  const count = Math.min(6, Math.max(2, Math.ceil(blur / 3)));

  /*
       IMPORTANT:
       The previous version divided opacity only by the number of rings.
       Each ring contains 9 copies, so the copies stacked into an almost
       solid grey shape. That is why the shirt shadows became huge and
       much darker than the original SVG.

       Distribute the opacity over ALL generated copies instead.
    */
  const positionsCount = 9;
  const alpha = (baseOpacity * spec.opacity) / (count * positionsCount);

  for (let i = count; i >= 1; i--) {
    const t = i / count;
    const spread = blur * t * 0.55;
    const positions = [
      [0, 0],
      [-spread, 0],
      [spread, 0],
      [0, -spread],
      [0, spread],
      [-spread, -spread],
      [spread, -spread],
      [-spread, spread],
      [spread, spread],
    ];

    for (const [ox, oy] of positions) {
      layers.push({
        commands: shiftCommands(transformed, spec.dx + ox, spec.dy + oy),
        opacity: alpha,
      });
    }
  }
  return layers;
}

function addShadowVectors(element, transformed, baseOpacity, addVector) {
  const specs = readFilterShadowSpecs(element);
  if (!specs.length) return;

  for (const spec of specs) {
    const layers = makeShadowLayers(transformed, baseOpacity, spec);
    for (const layer of layers) {
      const b = calculateBounds(layer.commands);
      if (!b || b.width <= 0.001 || b.height <= 0.001) continue;
      const local = localizeCommands(layer.commands, b);
      const path = commandsToPath(local);
      if (path.length < 3) continue;

      addVector(
        path,
        b.centerX,
        b.centerY,
        b.width,
        b.height,
        spec.color,
        Math.max(0, Math.min(1, layer.opacity)),
        "Shadow",
      );
    }
  }
}

/* =========================================================
   GLOBAL SVG → AM MATRIX
========================================================= */

function makeSVGToAMMatrix(info, width, height) {
  /*
   * FIT / CONTAIN
   *
   * SVG tetap proporsional.
   */

  const scale = Math.min(width / info.width, height / info.height);

  const renderedWidth = info.width * scale;

  const renderedHeight = info.height * scale;

  const offsetX = (width - renderedWidth) / 2;

  const offsetY = (height - renderedHeight) / 2;

  /*
   * SVG:
   *
   * x - viewBoxMinX
   * y - viewBoxMinY
   *
   * kemudian scale
   * kemudian center.
   */

  return [
    scale,
    0,
    0,
    scale,

    offsetX - info.minX * scale,

    offsetY - info.minY * scale,
  ];
}

/* =========================================================
   BOUNDING BOX
========================================================= */

function calculateBounds(commands) {
  const points = [];

  for (const item of commands) {
    if (item.cmd === "Z") continue;

    const values = item.values;

    for (let i = 0; i < values.length; i += 2) {
      points.push({
        x: values[i],
        y: values[i + 1],
      });
    }
  }

  if (points.length === 0) {
    return null;
  }

  let minX = Infinity;

  let minY = Infinity;

  let maxX = -Infinity;

  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);

    minY = Math.min(minY, point.y);

    maxX = Math.max(maxX, point.x);

    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,

    width: maxX - minX,

    height: maxY - minY,

    centerX: (minX + maxX) / 2,

    centerY: (minY + maxY) / 2,
  };
}

/* =========================================================
   TRANSFORM COMMANDS
========================================================= */

function transformCommands(commands, matrix) {
  const transformed = [];

  for (const item of commands) {
    if (item.cmd === "Z") {
      transformed.push({
        cmd: "Z",
        values: [],
      });

      continue;
    }

    const values = item.values;

    const newValues = [];

    for (let i = 0; i < values.length; i += 2) {
      const point = applyMatrix(matrix, values[i], values[i + 1]);

      newValues.push(point.x, point.y);
    }

    transformed.push({
      cmd: item.cmd,
      values: newValues,
    });
  }

  return transformed;
}

/* =========================================================
   LOCALIZE PATH
========================================================= */

function localizeCommands(commands, bounds) {
  return commands.map((item) => {
    if (item.cmd === "Z") {
      return {
        cmd: "Z",
        values: [],
      };
    }

    const values = item.values.slice();

    for (let i = 0; i < values.length; i += 2) {
      values[i] -= bounds.centerX;

      values[i + 1] -= bounds.centerY;
    }

    return {
      cmd: item.cmd,
      values,
    };
  });
}

/* =========================================================
   DUPLICATE KEY
========================================================= */

function normalizePath(path) {
  return path
    .replace(/-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g, (number) => {
      const n = parseFloat(number);

      if (!Number.isFinite(n)) return "0";

      return (Math.round(n * 1000) / 1000).toString();
    })
    .replace(/[,\s]+/g, " ")
    .trim();
}

function canonicalizePath(path) {
  const commands = parsePath(path);

  const normalized = [];

  let lastX = null;
  let lastY = null;

  for (const item of commands) {
    if (item.cmd === "Z") {
      normalized.push("Z");
      continue;
    }

    const values = item.values.slice();

    /*
     * Remove consecutive duplicate
     * points. This kills a common SVG
     * export artifact where the same
     * endpoint is written 3-5 times.
     */
    const cleaned = [];

    for (let i = 0; i < values.length; i += 2) {
      const x = Math.round(values[i] * 1000) / 1000;

      const y = Math.round(values[i + 1] * 1000) / 1000;

      if (
        item.cmd === "L" &&
        lastX !== null &&
        Math.abs(x - lastX) < 0.0005 &&
        Math.abs(y - lastY) < 0.0005
      ) {
        continue;
      }

      cleaned.push(x, y);

      lastX = x;
      lastY = y;
    }

    if (cleaned.length) {
      normalized.push(item.cmd + ":" + cleaned.join(","));
    }
  }

  return normalized.join("|");
}

function makeDuplicateKey(vector) {
  return [
    canonicalizePath(vector.path),
    Math.round(vector.x * 1000) / 1000,
    Math.round(vector.y * 1000) / 1000,
    Math.round(vector.width * 1000) / 1000,
    Math.round(vector.height * 1000) / 1000,
    vector.color.toLowerCase(),
    Math.round(vector.opacity * 1000) / 1000,
  ].join("|");
}

function matrixScale(matrix) {
  const sx = Math.hypot(matrix[0], matrix[1]);

  const sy = Math.hypot(matrix[2], matrix[3]);

  /*
   * Geometric mean is a stable
   * approximation for stroke width
   * under scale/rotation transforms.
   */
  return Math.sqrt(Math.max(0.000001, sx * sy));
}

function strokeToOutline(path, width, linecap = "butt", linejoin = "round") {
  if (!path || width <= 0) {
    return "";
  }

  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  const node = document.createElementNS("http://www.w3.org/2000/svg", "path");

  host.setAttribute("width", "1");

  host.setAttribute("height", "1");

  host.style.position = "fixed";

  host.style.left = "-100000px";

  host.style.top = "-100000px";

  host.style.width = "1px";

  host.style.height = "1px";

  host.style.visibility = "hidden";

  node.setAttribute("d", path);

  host.appendChild(node);

  document.body.appendChild(host);

  let length = 0;

  try {
    length = node.getTotalLength();
  } catch (error) {
    host.remove();
    return "";
  }

  if (!Number.isFinite(length) || length <= 0) {
    host.remove();
    return "";
  }

  /*
   * Keep point count sane. One stroke
   * becomes ONE vector, not hundreds.
   */
  const count = Math.max(16, Math.min(220, Math.ceil(length / 6)));

  const points = [];

  for (let i = 0; i <= count; i++) {
    const p = node.getPointAtLength((length * i) / count);

    points.push({
      x: p.x,
      y: p.y,
    });
  }

  host.remove();

  if (points.length < 2) {
    return "";
  }

  const half = width / 2;

  const left = [];
  const right = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];

    const before = points[Math.max(0, i - 1)];

    const after = points[Math.min(points.length - 1, i + 1)];

    let dx = after.x - before.x;

    let dy = after.y - before.y;

    const len = Math.hypot(dx, dy) || 1;

    dx /= len;
    dy /= len;

    const nx = -dy;

    const ny = dx;

    left.push({
      x: current.x + nx * half,
      y: current.y + ny * half,
    });

    right.push({
      x: current.x - nx * half,
      y: current.y - ny * half,
    });
  }

  /*
   * Round caps.
   */
  function cap(center, sideA, sideB, reverse = false) {
    if (linecap !== "round") {
      return [sideA];
    }

    const radius = Math.hypot(sideA.x - center.x, sideA.y - center.y);

    let a = Math.atan2(sideA.y - center.y, sideA.x - center.x);

    let b = Math.atan2(sideB.y - center.y, sideB.x - center.x);

    if (reverse) {
      while (b < a) b += Math.PI * 2;
    } else {
      while (b > a) b -= Math.PI * 2;
    }

    const result = [];

    const steps = 8;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      const angle = a + (b - a) * t;

      result.push({
        x: center.x + Math.cos(angle) * radius,

        y: center.y + Math.sin(angle) * radius,
      });
    }

    return result;
  }

  const polygon = [];

  polygon.push(...cap(points[0], left[0], right[0], false));

  polygon.push(...left.slice(1));

  const endCap = cap(
    points[points.length - 1],
    right[right.length - 1],
    left[left.length - 1],
    true,
  );

  polygon.push(...endCap);

  polygon.push(...right.slice(0, -1).reverse());

  const first = polygon[0];

  let result = `M ${clean(first.x)} ${clean(first.y)}`;

  for (let i = 1; i < polygon.length; i++) {
    result += ` L ${clean(polygon[i].x)} ${clean(polygon[i].y)}`;
  }

  result += " Z";

  return result;
}

/* =========================================================
   ANIMATION POLICY
========================================================= */

/*
 * This converter intentionally does NOT convert SVG animation into
 * Alight Motion keyframes.
 *
 * The job of this version is much simpler:
 *
 *     SVG geometry  ->  AM geometry
 *
 * Animation nodes are metadata for the SVG renderer. They must never
 * become a reason to delete their parent geometry.
 *
 * Supported animation elements that are removed when a static clone is
 * prepared:
 *
 *     animate
 *     animateTransform
 *     animateMotion
 *     set
 *
 * We also remove SVG timing containers that have no geometry of their own.
 *
 * The original SVG source is never mutated by this helper. A clone is
 * created first, then animation nodes are removed from the clone.
 *
 * This is deliberately conservative. We do not attempt to guess the final
 * frame of an animation, because doing that is exactly how small elements
 * disappear or become duplicated in complicated SVG files.
 */

const SVG_ANIMATION_TAGS = new Set([
  "animate",
  "animateTransform",
  "animateMotion",
  "set",
]);

function isSVGAnimationElement(element) {
  if (!element || element.nodeType !== 1) {
    return false;
  }

  return SVG_ANIMATION_TAGS.has(element.tagName.toLowerCase());
}

function removeSVGAnimationNodes(root) {
  if (!root || !root.querySelectorAll) {
    return 0;
  }

  const nodes = Array.from(
    root.querySelectorAll("animate, animateTransform, animateMotion, set"),
  );

  let removed = 0;

  for (const node of nodes) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
      removed++;
    }
  }

  return removed;
}

function cloneSVGWithoutAnimation(svg) {
  if (!svg) {
    return null;
  }

  const clone = svg.cloneNode(true);

  removeSVGAnimationNodes(clone);

  return clone;
}

/*
 * Animation attributes are intentionally ignored.
 *
 * These helpers are kept separate so future code does not accidentally
 * interpret animation values as geometry.
 */

function hasSVGAnimation(element) {
  if (!element || !element.querySelectorAll) {
    return false;
  }

  if (
    Array.from(element.children || []).some((child) =>
      isSVGAnimationElement(child),
    )
  ) {
    return true;
  }

  return (
    element.querySelector("animate, animateTransform, animateMotion, set") !==
    null
  );
}

function countSVGAnimations(root) {
  if (!root || !root.querySelectorAll) {
    return 0;
  }

  return root.querySelectorAll("animate, animateTransform, animateMotion, set")
    .length;
}

/* =========================================================
   GEOMETRY PRESERVATION HELPERS
========================================================= */

/*
 * SVG element preservation rules:
 *
 * 1. Never discard geometry because of animation.
 * 2. Never discard geometry because opacity is zero.
 * 3. Never discard geometry because visibility is hidden.
 * 4. Never discard geometry because display is none.
 * 5. Never discard a valid path merely because its paint is "none".
 * 6. Resolve <use> references when possible.
 * 7. Keep parent transforms.
 * 8. Keep stroke geometry.
 * 9. Keep shadows generated from supported SVG paint.
 * 10. Do not turn animation frames into duplicate vectors.
 */

const SVG_GEOMETRY_TAGS = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "line",
]);

function isSVGGeometryElement(element) {
  if (!element || element.nodeType !== 1) {
    return false;
  }

  return SVG_GEOMETRY_TAGS.has(element.tagName.toLowerCase());
}

function isSVGContainerElement(element) {
  if (!element || element.nodeType !== 1) {
    return false;
  }

  const tag = element.tagName.toLowerCase();

  return tag === "g" || tag === "svg" || tag === "symbol" || tag === "use";
}

function getSVGGeometryCount(root) {
  if (!root || !root.querySelectorAll) {
    return 0;
  }

  let count = 0;

  for (const element of root.querySelectorAll("*")) {
    if (isSVGGeometryElement(element)) {
      count++;
    }
  }

  return count;
}

function getSVGGeometryTags(root) {
  const result = [];

  if (!root || !root.querySelectorAll) {
    return result;
  }

  for (const element of root.querySelectorAll("*")) {
    if (isSVGGeometryElement(element)) {
      result.push(element.tagName.toLowerCase());
    }
  }

  return result;
}

/*
 * A geometry can legitimately have fill:none and stroke:none.
 * SVG still knows the path exists. AM cannot visually show an unpainted
 * vector, but the converter can preserve it as a transparent vector.
 */

function geometryNeedsTransparentFallback(element) {
  if (!element) {
    return false;
  }

  const fill = getFill(element);
  const stroke = getStroke(element);

  return fill === null && stroke === null;
}

/* =========================================================
   SAFE STYLE HELPERS
========================================================= */

/*
 * Animation can temporarily modify CSS properties. We only need the
 * static style available on the element. We never evaluate a timeline.
 */

function safeStaticOpacity(element) {
  try {
    return getOpacity(element);
  } catch (error) {
    console.warn("Unable to read opacity:", error);

    return 1;
  }
}

function safeStaticFill(element) {
  try {
    return getFill(element);
  } catch (error) {
    console.warn("Unable to read fill:", error);

    return null;
  }
}

function safeStaticStroke(element) {
  try {
    return getStroke(element);
  } catch (error) {
    console.warn("Unable to read stroke:", error);

    return null;
  }
}

/* =========================================================
   VECTOR ID / LABEL HELPERS
========================================================= */

function getStableSVGElementName(element, index) {
  if (!element) {
    return `Vector ${index}`;
  }

  const candidates = [
    element.getAttribute("id"),
    element.getAttribute("data-name"),
    element.getAttribute("aria-label"),
    element.getAttribute("inkscape:label"),
  ];

  for (const value of candidates) {
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }

  return `Vector ${index}`;
}

function normalizeVectorLabel(label) {
  return String(label || "Vector")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/* =========================================================
   PATH VALIDATION HELPERS
========================================================= */

function isUsableAMPath(path) {
  if (typeof path !== "string") {
    return false;
  }

  const value = path.trim();

  if (value.length < 3) {
    return false;
  }

  /*
   * A valid converted path normally contains at least one command.
   */
  if (!/[MLCQAZ]/i.test(value)) {
    return false;
  }

  return true;
}

function countPathCommands(path) {
  if (typeof path !== "string") {
    return 0;
  }

  const matches = path.match(/[MLCQAZ]/gi);

  return matches ? matches.length : 0;
}

function getPathComplexity(path) {
  return countPathCommands(path);
}

/* =========================================================
   BOUNDS VALIDATION HELPERS
========================================================= */

function isUsableBounds(bounds) {
  if (!bounds) {
    return false;
  }

  const values = [
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    bounds.centerX,
    bounds.centerY,
  ];

  if (values.some((value) => !Number.isFinite(value))) {
    return false;
  }

  if (bounds.width < 0 || bounds.height < 0) {
    return false;
  }

  return true;
}

function clampOpacity(value) {
  const n = num(value, 1);

  return Math.max(0, Math.min(1, n));
}

/* =========================================================
   PRESERVE ELEMENT INVENTORY
========================================================= */

/*
 * This inventory is diagnostic only. It does not alter the SVG.
 * It helps identify the classic problem:
 *
 *     "SVG contains 30 geometry elements but only 18 vectors were made."
 *
 * The converter can then report the numbers without pretending that
 * animation is the cause.
 */

function buildSVGInventory(root) {
  const inventory = {
    totalElements: 0,
    geometry: 0,
    groups: 0,
    uses: 0,
    defs: 0,
    animations: 0,
    hidden: 0,
    opacityZero: 0,
    fillNone: 0,
    strokeNone: 0,
    byTag: Object.create(null),
  };

  if (!root || !root.querySelectorAll) {
    return inventory;
  }

  const elements = Array.from(root.querySelectorAll("*"));

  for (const element of elements) {
    inventory.totalElements++;

    const tag = element.tagName.toLowerCase();

    inventory.byTag[tag] = (inventory.byTag[tag] || 0) + 1;

    if (isSVGGeometryElement(element)) {
      inventory.geometry++;
    }

    if (tag === "g" || tag === "svg" || tag === "symbol") {
      inventory.groups++;
    }

    if (tag === "use") {
      inventory.uses++;
    }

    if (tag === "defs") {
      inventory.defs++;
    }

    if (isSVGAnimationElement(element)) {
      inventory.animations++;
    }

    const display = getStyleValue(element, "display");

    const visibility = getStyleValue(element, "visibility");

    if (display === "none" || visibility === "hidden") {
      inventory.hidden++;
    }

    let opacity = 1;

    try {
      opacity = getOpacity(element);
    } catch {
      opacity = 1;
    }

    if (opacity <= 0) {
      inventory.opacityZero++;
    }

    const fill = safeStaticFill(element);

    const stroke = safeStaticStroke(element);

    if (fill === null) {
      inventory.fillNone++;
    }

    if (stroke === null) {
      inventory.strokeNone++;
    }
  }

  return inventory;
}

/* =========================================================
   PRESERVATION ASSERTIONS
========================================================= */

/*
 * These checks do not throw merely because an element is invisible.
 * They are here to make sure a geometry element is not accidentally
 * removed by a later refactor.
 */

function assertGeometryPreservation(root, vectors) {
  if (!root) {
    return {
      sourceGeometry: 0,
      outputVectors: vectors.length,
      missingEstimate: 0,
    };
  }

  const sourceGeometry = getSVGGeometryCount(root);

  const outputVectors = Array.isArray(vectors) ? vectors.length : 0;

  return {
    sourceGeometry,
    outputVectors,
    missingEstimate: Math.max(0, sourceGeometry - outputVectors),
  };
}

/* =========================================================
   ANIMATION-SAFE PARSING
========================================================= */

/*
 * DOMParser keeps animation nodes as children of their parent geometry.
 * That is perfectly valid, but the converter should not walk into them
 * looking for geometry. The existing collector already ignores unsupported
 * tags. This helper makes that rule explicit.
 */

function shouldTraverseSVGChild(element) {
  if (!element || element.nodeType !== 1) {
    return false;
  }

  const tag = element.tagName.toLowerCase();

  if (SVG_ANIMATION_TAGS.has(tag)) {
    return false;
  }

  if (
    tag === "style" ||
    tag === "metadata" ||
    tag === "title" ||
    tag === "desc" ||
    tag === "script"
  ) {
    return false;
  }

  return true;
}

function getGeometryChildren(element) {
  if (!element || !element.children) {
    return [];
  }

  return Array.from(element.children).filter(shouldTraverseSVGChild);
}

/* =========================================================
   STATIC SVG CLONE
========================================================= */

function prepareStaticSVG(svg) {
  /*
   * The original source is left untouched.
   *
   * This function is OUTPUT-ONLY. Do not use it for the live preview.
   * The live preview must retain SVG animation.
   */
  return cloneSVGWithoutAnimation(svg);
}

/* =========================================================
   END ANIMATION POLICY
========================================================= */

/* =========================================================
   COLLECT
========================================================= */

function getStrokeOpacity(element) {
  let opacity = 1;
  let current = element;

  while (current && current.nodeType === 1) {
    const globalOpacity = getStyleValue(current, "opacity");

    const strokeOpacity = getStyleValue(current, "stroke-opacity");

    if (globalOpacity !== null && globalOpacity !== "inherit") {
      opacity *= num(globalOpacity, 1);
    }

    if (strokeOpacity !== null && strokeOpacity !== "inherit") {
      opacity *= num(strokeOpacity, 1);
    }

    current = current.parentElement;
  }

  return Math.max(0, Math.min(1, opacity));
}

function getStrokeWidth(element) {
  const value = getInheritedStyle(element, "stroke-width", "1");

  return Math.max(0, num(value, 1));
}

function getStroke(element) {
  const value = getInheritedStyle(element, "stroke", "none");

  if (!value || value === "none" || value === "transparent") {
    return null;
  }

  return value;
}

function collectReferencedSVGElement(
  element,
  parentMatrix,
  svgMatrix,
  result,
  seen,
) {
  if (!element || element.nodeType !== 1) {
    return;
  }

  /*
   * Build a tiny traversal root around the referenced node itself.
   * Unlike the previous `{children:[target]}` trick, this keeps access
   * to ownerDocument and therefore works for nested <use> references.
   */
  const tag = element.tagName.toLowerCase();

  /*
   * Geometry elements can be collected directly by using a temporary
   * container with the element as its only child.
   */
  const wrapper = {
    children: [element],
  };

  collectVectors(wrapper, parentMatrix, svgMatrix, result, seen);
}

/*
 * Animated SVG fallback.
 * Some SVG exporters store a tiny/degenerate base path (for example
 * M-22.5,419) and put the real geometry in <set attributeName="d" ...>.
 * The old collector rejected those paths because their base bounds were
 * zero. For Alight Motion XML we intentionally do NOT reproduce the
 * animation, but we keep the last useful animated geometry instead.
 */
function getUsablePathData(element) {
  if (!element) return null;
  const tag = (element.localName || element.tagName || "").toLowerCase();
  let path = elementToPath(element);

  if (tag === "path") {
    const animatedD = getAnimatedAttributeValue(element, "d");
    if (animatedD) {
      const parsed = parsePath(animatedD);
      const bounds = parsed.length ? calculateBounds(parsed) : null;
      if (bounds && (bounds.width > 0.001 || bounds.height > 0.001)) {
        path = animatedD;
      }
    }
  }

  return path && path.trim() ? path.trim() : null;
}

function collectVectors(root, parentMatrix, svgMatrix, result, seen) {
  for (const element of root.children) {
    const tag = element.tagName.toLowerCase();

    if (
      tag === "defs" ||
      tag === "style" ||
      tag === "metadata" ||
      tag === "title" ||
      tag === "desc" ||
      tag === "script"
    ) {
      continue;
    }

    const display = getStyleValue(element, "display");
    const visibility = getStyleValue(element, "visibility");

    /*
     * display and visibility are intentionally read but NOT used
     * to discard geometry.
     */

    /* Animated transforms are flattened to their final static frame. */
    const animatedTransform = getAnimatedTransformValue(element);
    let ownMatrix = parseTransform(
      animatedTransform || element.getAttribute("transform") || "",
    );

    /*
     * Nested <svg> punya x/y + viewBox sendiri.
     * Versi lama memperlakukan <svg> seperti <g>,
     * sehingga SVG tertentu bisa loncat/buyar.
     */
    if (tag === "svg" && element !== root) {
      const x = num(element.getAttribute("x"), 0);
      const y = num(element.getAttribute("y"), 0);
      ownMatrix = matrixMultiply(ownMatrix, [1, 0, 0, 1, x, y]);

      const vb = (element.getAttribute("viewBox") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      if (vb.length === 4 && vb.every(Number.isFinite)) {
        const sw = num(element.getAttribute("width"), vb[2]);
        const sh = num(element.getAttribute("height"), vb[3]);
        if (sw > 0 && sh > 0) {
          const sx = sw / vb[2],
            sy = sh / vb[3];
          let sx2 = sx,
            sy2 = sy;
          const par =
            element.getAttribute("preserveAspectRatio") || "xMidYMid meet";
          if (!/^none\b/i.test(par)) {
            const q = Math.min(sx, sy);
            sx2 = sy2 = q;
          }
          const tx = -vb[0] * sx2;
          const ty = -vb[1] * sy2;
          ownMatrix = matrixMultiply(ownMatrix, [sx2, 0, 0, sy2, tx, ty]);
        }
      }
    }

    const combined = matrixMultiply(parentMatrix, ownMatrix);

    const supported = [
      "path",
      "rect",
      "circle",
      "ellipse",
      "polygon",
      "polyline",
      "line",
    ];

    if (supported.includes(tag)) {
      const rawPath = getUsablePathData(element);

      if (rawPath) {
        const parsed = parsePath(rawPath);

        if (parsed.length) {
          const fullMatrix = matrixMultiply(svgMatrix, combined);
          const transformed = transformCommands(parsed, fullMatrix);
          const bounds = calculateBounds(transformed);

          if (bounds && (bounds.width > 0.001 || bounds.height > 0.001)) {
            const local = localizeCommands(transformed, bounds);
            const finalPath = commandsToPath(local);

            if (finalPath.length > 2) {
              const opacity = getOpacity(element);

              const addVector = (
                path,
                vectorX,
                vectorY,
                vectorWidth,
                vectorHeight,
                colorValue,
                vectorOpacity,
                suffix,
              ) => {
                if (!path || path.length < 3) {
                  lastEmptyCount++;
                  return;
                }

                const vector = {
                  path,
                  x: vectorX,
                  y: vectorY,
                  width: vectorWidth,
                  height: vectorHeight,
                  color: colorToAM(colorValue, vectorOpacity),
                  opacity: vectorOpacity,
                  label:
                    element.getAttribute("id") ||
                    element.getAttribute("data-name") ||
                    `Vector ${result.length + 1}` +
                      (suffix ? " " + suffix : ""),
                };

                const key = makeDuplicateKey(vector);
                if (mergeDuplicates.checked && seen.has(key)) {
                  lastDuplicateCount++;
                  return;
                }
                if (mergeDuplicates.checked) seen.add(key);
                result.push(vector);
              };

              /* Shadow harus masuk SEBELUM fill supaya berada di belakang objek. */
              addShadowVectors(element, transformed, opacity, addVector);

              const fill = getFill(element);
              if (fill !== null) {
                const colorValue = forceColor.checked ? color.value : fill;
                addVector(
                  finalPath,
                  bounds.centerX,
                  bounds.centerY,
                  bounds.width,
                  bounds.height,
                  colorValue,
                  opacity,
                  "",
                );
              }

              const stroke = getStroke(element);

              if (fill === null && stroke === null) {
                addVector(
                  finalPath,
                  bounds.centerX,
                  bounds.centerY,
                  bounds.width,
                  bounds.height,
                  "#00000000",
                  0,
                  "Unpainted",
                );
              }

              if (stroke !== null) {
                const strokeWidth = getStrokeWidth(element);

                if (strokeWidth > 0) {
                  const scaledStrokeWidth =
                    strokeWidth * matrixScale(fullMatrix);

                  const outline = strokeToOutline(
                    segmentsToSVGPath(transformed),
                    scaledStrokeWidth,
                    getInheritedStyle(element, "stroke-linecap", "butt"),
                    getInheritedStyle(element, "stroke-linejoin", "round"),
                  );

                  if (outline) {
                    const outlineCommands = parsePath(outline);
                    const outlineBounds = calculateBounds(outlineCommands);

                    if (
                      outlineBounds &&
                      outlineBounds.width > 0.001 &&
                      outlineBounds.height > 0.001
                    ) {
                      const outlineLocal = localizeCommands(
                        outlineCommands,
                        outlineBounds,
                      );

                      const strokeColor = forceColor.checked
                        ? color.value
                        : stroke;

                      addVector(
                        commandsToPath(outlineLocal),
                        outlineBounds.centerX,
                        outlineBounds.centerY,
                        outlineBounds.width,
                        outlineBounds.height,
                        strokeColor,
                        getStrokeOpacity(element),
                        "Stroke",
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (tag === "use") {
      const href =
        element.getAttribute("href") || element.getAttribute("xlink:href");
      if (href && href[0] === "#") {
        /*
         * IMPORTANT:
         * `root` can be a synthetic object when resolving <use>.
         * Therefore root.ownerDocument may be undefined.
         * Always resolve the referenced node from the real SVG
         * document owned by the <use> element.
         */
        const doc = element.ownerDocument;
        const target = doc ? doc.getElementById(href.slice(1)) : null;

        if (target) {
          const x = num(element.getAttribute("x"), 0);
          const y = num(element.getAttribute("y"), 0);

          const useMatrix = matrixMultiply(combined, [1, 0, 0, 1, x, y]);

          collectReferencedSVGElement(
            target,
            useMatrix,
            svgMatrix,
            result,
            seen,
          );
        }
      }
    }

    if (
      tag === "g" ||
      tag === "svg" ||
      tag === "use" ||
      element.children.length
    ) {
      collectVectors(element, combined, svgMatrix, result, seen);
    }
  }
  return result;
}

function segmentsToSVGPath(commands) {
  let result = "";

  for (const item of commands) {
    if (item.cmd === "Z") {
      result += "Z ";
      continue;
    }

    const v = item.values;

    if (item.cmd === "M") {
      result += `M ${v[0]} ${v[1]} `;
    } else if (item.cmd === "L") {
      result += `L ${v[0]} ${v[1]} `;
    } else if (item.cmd === "C") {
      result += `C ${v[0]} ${v[1]} ` + `${v[2]} ${v[3]} ` + `${v[4]} ${v[5]} `;
    }
  }

  return result.trim();
}

/* =========================================================
   XML SHAPE
========================================================= */

function createAMShape(vector, index, totalTime) {
  const opacity = vector.opacity;

  const opacityXML =
    opacity < 0.999999
      ? `
          <opacity value="${clean(opacity)}" />`
      : "";

  return `
  <shape
    id="${10000000 + index}"
    label="${esc(vector.label)}"
    startTime="0"
    endTime="${totalTime}"
    fillType="color"
    mediaFillMode="stretch">

    <transform>

      <location value="${clean(vector.x)},${clean(vector.y)},0.000000" />${opacityXML}

    </transform>

    <fillColor value="${vector.color}" />

    <path d="${esc(vector.path)}" />

  </shape>`;
}

/* =========================================================
   GENERATE XML
========================================================= */

function generateXML() {
  if (!svgSource) {
    throw new Error("Upload SVG terlebih dahulu.");
  }

  const parser = new DOMParser();

  const documentSVG = parser.parseFromString(svgSource, "image/svg+xml");

  if (documentSVG.querySelector("parsererror")) {
    throw new Error("SVG tidak valid atau rusak.");
  }

  const svg = documentSVG.documentElement;

  buildCSSRules(svg);

  const info = getSVGInfo(svg);

  if (info.width <= 0 || info.height <= 0) {
    throw new Error("viewBox SVG tidak valid.");
  }

  const width = Math.max(1, num(canvasWidth.value, 1080));

  const height = Math.max(1, num(canvasHeight.value, 1080));

  const svgMatrix = makeSVGToAMMatrix(info, width, height);

  const vectors = [];

  lastDuplicateCount = 0;
  lastEmptyCount = 0;

  const seen = new Set();

  collectVectors(svg, [1, 0, 0, 1, 0, 0], svgMatrix, vectors, seen);

  if (vectors.length === 0) {
    const inventory = buildSVGInventory(svg);
    throw new Error(
      `Tidak ada vector yang berhasil dibaca. SVG memiliki ${inventory.geometry} geometry dan ${inventory.animations} elemen animasi.`,
    );
  }

  lastVectors = vectors;

  /*
   * Diagnostic information. This is deliberately non-fatal.
   * A mismatch is reported in the console rather than deleting vectors.
   */
  const inventory = buildSVGInventory(svg);

  const preservation = assertGeometryPreservation(svg, vectors);

  console.info("[SVG→AM] Inventory:", inventory);

  console.info("[SVG→AM] Preservation:", preservation);

  const seconds = Math.max(0.1, num(duration.value, 5));

  const frameRate = Math.max(1, Math.round(num(fps.value, 30)));

  const totalTime = Math.round(seconds * 1000);

  const title = projectName.value.trim() || "My Vector";

  let shapes = "";

  vectors.forEach((vector, index) => {
    shapes += createAMShape(vector, index + 1, totalTime);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!--
  Created by SVG to Alight Motion XML Converter - Geometry Preservation
  Vector layers: ${vectors.length}

  SVG animation policy:
  - SVG animation is intentionally NOT converted.
  - Geometry belonging to animated elements is preserved.
  - opacity/display/visibility are never used as a reason to delete geometry.
  - <use> references are resolved where possible.
  - Degenerate paths are recovered from their final animated d-value when available.
-->

<scene
  title="${esc(title)}"
  width="${Math.round(width)}"
  height="${Math.round(height)}"
  exportWidth="${Math.round(width)}"
  exportHeight="${Math.round(height)}"
  precompose="dynamicResolution"
  bgcolor="#00000000"
  totalTime="${totalTime}"
  fps="${frameRate}"
  modifiedTime="0"
  amver="1002592"
  ffver="106"
  am="com.alightcreative.motion/5.0.275"
  amplatform="android"
  retime="freeze"
  retimeAdaptFPS="false">

${shapes}

</scene>`;

  return xml;
}

/* =========================================================
   PREVIEW
========================================================= */

function showPreview() {
  if (!svgSource) return;

  const parser = new DOMParser();

  const doc = parser.parseFromString(svgSource, "image/svg+xml");

  if (doc.querySelector("parsererror")) {
    return;
  }

  const svg = doc.documentElement;

  buildCSSRules(svg);

  preview.innerHTML = "";

  /*
   * PREVIEW MUST KEEP SVG ANIMATION.
   */
  const clone = svg.cloneNode(true);

  clone.removeAttribute("width");

  clone.removeAttribute("height");

  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  preview.appendChild(clone);

  const info = getSVGInfo(svg);

  const width = Math.max(1, num(canvasWidth.value, 1080));

  const height = Math.max(1, num(canvasHeight.value, 1080));

  const svgMatrix = makeSVGToAMMatrix(info, width, height);

  const vectors = [];

  lastDuplicateCount = 0;
  lastEmptyCount = 0;

  const seen = new Set();

  collectVectors(svg, [1, 0, 0, 1, 0, 0], svgMatrix, vectors, seen);

  const rawElements = svg.querySelectorAll("*").length;

  const rawVectors = collectRawVectors(svg);

  document.getElementById("elements").textContent = rawElements;

  document.getElementById("rawVectors").textContent = rawVectors;

  document.getElementById("finalVectors").textContent = vectors.length;

  document.getElementById("duplicates").textContent = lastDuplicateCount;
}

/* =========================================================
   RAW VECTOR COUNT
========================================================= */

function collectRawVectors(root) {
  let count = 0;

  const supported = [
    "path",
    "rect",
    "circle",
    "ellipse",
    "polygon",
    "polyline",
    "line",
  ];

  for (const element of root.children) {
    const tag = element.tagName.toLowerCase();

    if (supported.includes(tag)) {
      const path = elementToPath(element);

      if (path) count++;
    }

    for (const child of getGeometryChildren(element)) {
      count += collectRawVectors(child);
    }
  }

  return count;
}

/* =========================================================
   CONVERT
========================================================= */

document.getElementById("convert").addEventListener("click", () => {
  try {
    const xml = generateXML();

    outputBox.value = xml;

    showPreview();

    setStatus(`Berhasil: ${lastVectors.length} vector dibuat.`, "ok");
  } catch (error) {
    console.error(error);

    setStatus(error.message, "error");
  }
});

/* =========================================================
   COPY
========================================================= */

document.getElementById("copy").addEventListener("click", async () => {
  if (!outputBox.value) {
    setStatus("XML masih kosong.", "error");

    return;
  }

  try {
    await navigator.clipboard.writeText(outputBox.value);
  } catch {
    outputBox.select();

    document.execCommand("copy");
  }

  setStatus("XML berhasil dicopy.", "ok");
});

/* =========================================================
   DOWNLOAD
========================================================= */

document.getElementById("download").addEventListener("click", () => {
  if (!outputBox.value) {
    setStatus("Convert dulu.", "error");

    return;
  }

  let name = projectName.value.trim() || "My Vector";

  name = name.replace(/[<>:"/\\|?*]/g, "_");

  const blob = new Blob([outputBox.value], {
    type: "application/xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = name + ".xml";

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);

  setStatus("XML berhasil didownload.", "ok");
});

/* =========================================================
   CLEAR
========================================================= */

document.getElementById("clear").addEventListener("click", () => {
  svgSource = "";

  lastVectors = [];
  lastDuplicateCount = 0;
  lastEmptyCount = 0;

  fileInput.value = "";

  outputBox.value = "";

  preview.innerHTML = `<div class="empty">
                Upload SVG terlebih dahulu
            </div>`;

  document.getElementById("elements").textContent = "0";

  document.getElementById("rawVectors").textContent = "0";

  document.getElementById("finalVectors").textContent = "0";

  document.getElementById("duplicates").textContent = "0";

  setStatus("Data dibersihkan.");
});

/* =========================================================
   UPDATE PREVIEW SAAT CANVAS BERUBAH
========================================================= */

canvasWidth.addEventListener("input", () => {
  if (svgSource) showPreview();
});

canvasHeight.addEventListener("input", () => {
  if (svgSource) showPreview();
});

/* =========================================================
   START
========================================================= */

setStatus("Upload SVG terlebih dahulu.");
