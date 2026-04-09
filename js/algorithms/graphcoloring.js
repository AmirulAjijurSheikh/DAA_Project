import { clamp, getCanvasContext, parseInteger, setupAlgoShell } from "./shared.js";

const COLORS = ["#e879f9", "#14b8a6", "#eab308", "#ef4444", "#84cc16", "#6366f1", "#f97316", "#38bdf8"];
const COLOR_NAMES = ["Violet", "Teal", "Yellow", "Red", "Green", "Indigo", "Orange", "Sky"];

const DEFAULT_NODES = [
  { x: 0.5, y: 0.1, label: "0" },
  { x: 0.85, y: 0.38, label: "1" },
  { x: 0.72, y: 0.82, label: "2" },
  { x: 0.28, y: 0.82, label: "3" },
  { x: 0.15, y: 0.38, label: "4" },
  { x: 0.5, y: 0.5, label: "5" },
];

const DEFAULT_ADJ = [
  [0, 1, 0, 0, 1, 1],
  [1, 0, 1, 0, 0, 1],
  [0, 1, 0, 1, 0, 1],
  [0, 0, 1, 0, 1, 1],
  [1, 0, 0, 1, 0, 1],
  [1, 1, 1, 1, 1, 0],
];

const PRESETS = [
  { label: "6-node (pentagon + center)", nodes: DEFAULT_NODES, adj: DEFAULT_ADJ },
  {
    label: "Cycle C5",
    nodes: [
      { x: 0.5, y: 0.08, label: "0" },
      { x: 0.86, y: 0.38, label: "1" },
      { x: 0.7, y: 0.82, label: "2" },
      { x: 0.3, y: 0.82, label: "3" },
      { x: 0.14, y: 0.38, label: "4" },
    ],
    adj: [
      [0, 1, 0, 0, 1],
      [1, 0, 1, 0, 0],
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1],
      [1, 0, 0, 1, 0],
    ],
  },
  {
    label: "Complete K4",
    nodes: [
      { x: 0.25, y: 0.2, label: "0" },
      { x: 0.75, y: 0.2, label: "1" },
      { x: 0.75, y: 0.78, label: "2" },
      { x: 0.25, y: 0.78, label: "3" },
    ],
    adj: [
      [0, 1, 1, 1],
      [1, 0, 1, 1],
      [1, 1, 0, 1],
      [1, 1, 1, 0],
    ],
  },
  {
    label: "Bipartite K3,3",
    nodes: [
      { x: 0.2, y: 0.22, label: "A" },
      { x: 0.5, y: 0.22, label: "B" },
      { x: 0.8, y: 0.22, label: "C" },
      { x: 0.2, y: 0.76, label: "D" },
      { x: 0.5, y: 0.76, label: "E" },
      { x: 0.8, y: 0.76, label: "F" },
    ],
    adj: [
      [0, 0, 0, 1, 1, 1],
      [0, 0, 0, 1, 1, 1],
      [0, 0, 0, 1, 1, 1],
      [1, 1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0, 0],
    ],
  },
];

let gcNodes = [];
let gcAdj = [];
let gcColors = [];

const INPUTS_FALLBACK = `
  <div class="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Number of Colors (m)</span>
      <input id="gc-m" type="number" min="1" max="8" value="3" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
    </label>
    <div>
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Preset</span>
      <div id="gc-presets" class="flex flex-wrap gap-2"></div>
    </div>
  </div>
`;

const VIZ_HTML = `
  <div class="space-y-3">
    <canvas id="gc-canvas" class="w-full rounded-md border border-slate-200 bg-white" height="300"></canvas>
    <div id="gc-palette" class="flex flex-wrap gap-2"></div>
  </div>
`;

function applyPreset(ctx, presetIndex) {
  const index = clamp(parseInteger(presetIndex, 0), 0, PRESETS.length - 1);
  const preset = PRESETS[index];
  ctx.state.gcPreset = index;
  gcNodes = preset.nodes.map((node) => ({ ...node }));
  gcAdj = preset.adj.map((row) => [...row]);
  gcColors = Array(gcNodes.length).fill(-1);
}

function renderPresetControls(ctx) {
  const controls = document.getElementById("gc-presets");
  if (!(controls instanceof HTMLElement)) {
    return;
  }
  controls.replaceChildren();
  PRESETS.forEach((preset, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "gc-switch-preset";
    button.dataset.preset = String(index);
    const active = ctx.state.gcPreset === index;
    button.className = active
      ? "rounded-md border border-brand-500 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
      : "rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600";
    button.textContent = preset.label;
    controls.append(button);
  });
}

function drawGraph() {
  const chart = getCanvasContext("gc-canvas", 300);
  if (!chart) {
    return;
  }
  const { ctx, width: w, height: h } = chart;
  const nx = (node) => node.x * w * 0.82 + w * 0.09;
  const ny = (node) => node.y * h * 0.82 + h * 0.08;
  ctx.clearRect(0, 0, w, h);

  gcAdj.forEach((row, i) => {
    row.forEach((value, j) => {
      if (!value || i >= j) {
        return;
      }
      const conflict = gcColors[i] >= 0 && gcColors[i] === gcColors[j];
      ctx.strokeStyle = conflict ? "#ef4444" : "#94a3b8";
      ctx.lineWidth = conflict ? 2.5 : 1.5;
      if (conflict) {
        ctx.setLineDash([5, 3]);
      }
      ctx.beginPath();
      ctx.moveTo(nx(gcNodes[i]), ny(gcNodes[i]));
      ctx.lineTo(nx(gcNodes[j]), ny(gcNodes[j]));
      ctx.stroke();
      ctx.setLineDash([]);
    });
  });

  gcNodes.forEach((node, index) => {
    const colorIdx = gcColors[index];
    const fill = colorIdx >= 0 ? COLORS[colorIdx] : "#f8fafc";
    const stroke = colorIdx >= 0 ? COLORS[colorIdx] : "#64748b";
    ctx.fillStyle = fill;
    ctx.globalAlpha = colorIdx >= 0 ? 0.75 : 1;
    ctx.beginPath();
    ctx.arc(nx(node), ny(node), 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = colorIdx >= 0 ? "#ffffff" : "#0f172a";
    ctx.font = "bold 13px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, nx(node), ny(node));
  });
}

function renderPalette() {
  const palette = document.getElementById("gc-palette");
  if (!(palette instanceof HTMLElement)) {
    return;
  }
  palette.replaceChildren();
  const used = [...new Set(gcColors.filter((color) => color >= 0))];
  used.forEach((index) => {
    const chip = document.createElement("div");
    chip.className = "rounded-full border px-3 py-1 text-xs font-mono";
    chip.style.borderColor = `${COLORS[index]}66`;
    chip.style.background = `${COLORS[index]}22`;
    chip.style.color = COLORS[index];
    chip.textContent = COLOR_NAMES[index];
    palette.append(chip);
  });
}

export async function setup(ctx) {
  if (!Number.isInteger(ctx.state.gcPreset)) {
    ctx.state.gcPreset = 0;
  }
  if (!(await setupAlgoShell(ctx, "graphcoloring", INPUTS_FALLBACK, VIZ_HTML))) {
    return;
  }
  applyPreset(ctx, ctx.state.gcPreset);
  renderPresetControls(ctx);
  drawGraph();
  renderPalette();
}

export function run(ctx) {
  const maxColors = clamp(parseInteger(document.getElementById("gc-m")?.value, 3), 1, COLORS.length);
  gcColors = Array(gcNodes.length).fill(-1);
  const n = gcNodes.length;
  let solutionFound = false;
  const steps = [];

  const isSafe = (node, color) => {
    for (let i = 0; i < n; i += 1) {
      if (gcAdj[node][i] && gcColors[i] === color) {
        return false;
      }
    }
    return true;
  };

  const solve = (node) => {
    if (node === n) {
      solutionFound = true;
      const snapshot = [...gcColors];
      steps.push(() => {
        gcColors = snapshot;
        drawGraph();
        renderPalette();
        const used = new Set(snapshot).size;
        ctx.addLog(`Solution found using ${used} color(s)`);
        ctx.renderSidebar("graphcoloring", `Solution found | Colors used: ${used} | Max allowed: ${maxColors}`);
      });
      return true;
    }

    for (let color = 0; color < maxColors; color += 1) {
      if (!isSafe(node, color)) {
        continue;
      }
      gcColors[node] = color;
      const assign = [...gcColors];
      const label = gcNodes[node].label;
      steps.push(() => {
        gcColors = assign;
        drawGraph();
        renderPalette();
        ctx.addLog(`Node ${label} -> ${COLOR_NAMES[color]}`);
      });

      if (solve(node + 1)) {
        return true;
      }

      gcColors[node] = -1;
      const back = [...gcColors];
      steps.push(() => {
        gcColors = back;
        drawGraph();
        renderPalette();
        ctx.addLog(`Backtrack node ${label}`);
      });
    }

    return false;
  };

  solve(0);

  if (!solutionFound && steps.length === 0) {
    steps.push(() => {
      ctx.addLog("No valid coloring found.");
      ctx.renderSidebar("graphcoloring", "No valid coloring. Increase m and retry.");
    });
  }

  return { steps };
}

export function action(ctx, actionNode) {
  if (actionNode?.dataset?.action !== "gc-switch-preset") {
    return false;
  }

  const presetIndex = parseInteger(actionNode.dataset.preset, 0);
  applyPreset(ctx, presetIndex);
  renderPresetControls(ctx);
  drawGraph();
  renderPalette();
  ctx.clearTimer(ctx.state);
  ctx.state.stepQueue = [];
  ctx.state.stepIdx = 0;
  ctx.state.logs = [];
  ctx.renderSidebar("graphcoloring");
  return true;
}

export async function reset(ctx) {
  await setup(ctx);
}
