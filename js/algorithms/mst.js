import { getCanvasContext, parseInteger, setupAlgoShell } from "./shared.js";

const MST_TEST_CASES = [
  {
    label: "Test 1 - Cycle Demo",
    desc: "Classic 6-node graph. Edges A-B and B-F are rejected due to cycles.",
    nodes: [
      { x: 0.15, y: 0.28, label: "A" },
      { x: 0.42, y: 0.1, label: "B" },
      { x: 0.78, y: 0.2, label: "C" },
      { x: 0.88, y: 0.62, label: "D" },
      { x: 0.52, y: 0.78, label: "E" },
      { x: 0.12, y: 0.78, label: "F" },
    ],
    edges: [
      { u: 4, v: 5, w: 1 },
      { u: 0, v: 5, w: 2 },
      { u: 2, v: 3, w: 3 },
      { u: 0, v: 1, w: 4 },
      { u: 1, v: 4, w: 5 },
      { u: 1, v: 2, w: 6 },
      { u: 3, v: 4, w: 7 },
      { u: 0, v: 4, w: 8 },
      { u: 1, v: 5, w: 8 },
      { u: 2, v: 4, w: 9 },
    ],
  },
  {
    label: "Test 2 - Dense Graph",
    desc: "5-node dense graph where many candidate edges are rejected by cycle checks.",
    nodes: [
      { x: 0.5, y: 0.1, label: "P" },
      { x: 0.85, y: 0.4, label: "Q" },
      { x: 0.68, y: 0.85, label: "R" },
      { x: 0.32, y: 0.85, label: "S" },
      { x: 0.15, y: 0.4, label: "T" },
    ],
    edges: [
      { u: 0, v: 1, w: 2 },
      { u: 1, v: 2, w: 3 },
      { u: 2, v: 3, w: 1 },
      { u: 3, v: 4, w: 4 },
      { u: 4, v: 0, w: 5 },
      { u: 0, v: 2, w: 6 },
      { u: 1, v: 3, w: 7 },
      { u: 0, v: 3, w: 8 },
      { u: 1, v: 4, w: 9 },
      { u: 2, v: 4, w: 10 },
    ],
  },
  {
    label: "Test 3 - Sparse Graph",
    desc: "4-node sparse graph where every edge can be accepted without cycles.",
    nodes: [
      { x: 0.2, y: 0.2, label: "W" },
      { x: 0.75, y: 0.2, label: "X" },
      { x: 0.75, y: 0.78, label: "Y" },
      { x: 0.2, y: 0.78, label: "Z" },
    ],
    edges: [
      { u: 0, v: 1, w: 3 },
      { u: 1, v: 2, w: 5 },
      { u: 2, v: 3, w: 2 },
      { u: 0, v: 3, w: 7 },
    ],
  },
];

let selectedEdges = [];
let cycleEdge = null;

const INPUTS_FALLBACK = `
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" id="mst-case-controls"></div>
    <p id="mst-tc-desc" class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"></p>
  </div>
`;

const VIZ_HTML = `
  <div class="space-y-3">
    <canvas id="mst-canvas" class="w-full rounded-md border border-slate-200 bg-white" height="300"></canvas>
    <div id="mst-cycle-warning" class="hidden rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      <div class="font-semibold">Cycle detected - edge rejected</div>
      <div id="mst-cycle-msg"></div>
    </div>
  </div>
`;

function getCurrentCase(state) {
  const index = Math.max(0, Math.min(MST_TEST_CASES.length - 1, parseInteger(state.mstTC, 0)));
  return { index, tc: MST_TEST_CASES[index] };
}

function renderCaseControls(state) {
  const controls = document.getElementById("mst-case-controls");
  const desc = document.getElementById("mst-tc-desc");
  if (!(controls instanceof HTMLElement) || !(desc instanceof HTMLElement)) {
    return;
  }

  controls.replaceChildren();
  MST_TEST_CASES.forEach((testCase, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "mst-switch-case";
    button.dataset.case = String(index);
    const active = index === state.mstTC;
    button.className = active
      ? "rounded-md border border-brand-500 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
      : "rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600";
    button.textContent = testCase.label;
    controls.append(button);
  });

  desc.textContent = MST_TEST_CASES[state.mstTC].desc;
}

function drawGraph(tc, currentEdge = null) {
  const chart = getCanvasContext("mst-canvas", 300);
  if (!chart) {
    return;
  }

  const { ctx, width: w, height: h } = chart;
  const nx = (node) => node.x * w * 0.88 + w * 0.06;
  const ny = (node) => node.y * h * 0.82 + h * 0.08;
  ctx.clearRect(0, 0, w, h);

  tc.edges.forEach((edge) => {
    const a = tc.nodes[edge.u];
    const b = tc.nodes[edge.v];
    const isSelected = selectedEdges.some((e) => e.u === edge.u && e.v === edge.v && e.w === edge.w);
    const isCurrent = currentEdge && currentEdge.u === edge.u && currentEdge.v === edge.v;
    const isCycle = cycleEdge && cycleEdge.u === edge.u && cycleEdge.v === edge.v && cycleEdge.w === edge.w;

    ctx.strokeStyle = isCycle ? "#ef4444" : isSelected ? "#14b8a6" : isCurrent ? "#eab308" : "#94a3b8";
    ctx.lineWidth = isCycle || isSelected ? 3 : 1.5;
    if (isCycle) {
      ctx.setLineDash([5, 3]);
    }
    ctx.beginPath();
    ctx.moveTo(nx(a), ny(a));
    ctx.lineTo(nx(b), ny(b));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText(String(edge.w), (nx(a) + nx(b)) / 2, (ny(a) + ny(b)) / 2 - 6);
  });

  tc.nodes.forEach((node, index) => {
    const included = selectedEdges.some((edge) => edge.u === index || edge.v === index);
    ctx.fillStyle = included ? "#ecfeff" : "#f8fafc";
    ctx.beginPath();
    ctx.arc(nx(node), ny(node), 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = included ? "#0f766e" : "#6366f1";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, nx(node), ny(node));
  });
  ctx.textBaseline = "alphabetic";
}

function updateCycleWarning(message = "") {
  const warning = document.getElementById("mst-cycle-warning");
  const text = document.getElementById("mst-cycle-msg");
  if (!(warning instanceof HTMLElement) || !(text instanceof HTMLElement)) {
    return;
  }

  if (!message) {
    warning.classList.add("hidden");
    text.textContent = "";
    return;
  }

  warning.classList.remove("hidden");
  text.textContent = message;
}

function updateResult(ctx, tc) {
  const total = selectedEdges.reduce((sum, edge) => sum + edge.w, 0);
  const edges = selectedEdges.map((edge) => `${tc.nodes[edge.u].label}-${tc.nodes[edge.v].label}`).join(", ");
  ctx.renderSidebar(
    "mst",
    `Cost: ${total} | Edges: ${edges || "-"} | Progress: ${selectedEdges.length}/${tc.nodes.length - 1}`,
  );
}

function applyCase(ctx, nextIndex) {
  ctx.state.mstTC = Math.max(0, Math.min(MST_TEST_CASES.length - 1, nextIndex));
  selectedEdges = [];
  cycleEdge = null;
  ctx.state.stepQueue = [];
  ctx.state.stepIdx = 0;
  ctx.state.logs = [];
  ctx.clearTimer(ctx.state);
  renderCaseControls(ctx.state);
  const { tc } = getCurrentCase(ctx.state);
  drawGraph(tc);
  updateCycleWarning("");
  ctx.renderSidebar("mst");
}

export async function setup(ctx) {
  const { index, tc } = getCurrentCase(ctx.state);
  ctx.state.mstTC = index;
  if (!(await setupAlgoShell(ctx, "mst", INPUTS_FALLBACK, VIZ_HTML))) {
    return;
  }
  selectedEdges = [];
  cycleEdge = null;
  renderCaseControls(ctx.state);
  drawGraph(tc);
  updateCycleWarning("");
}

export function run(ctx) {
  const { tc } = getCurrentCase(ctx.state);
  const nodes = tc.nodes;
  const sorted = [...tc.edges].sort((a, b) => a.w - b.w);
  const parent = nodes.map((_, i) => i);
  const rank = nodes.map(() => 0);

  selectedEdges = [];
  cycleEdge = null;
  updateCycleWarning("");
  drawGraph(tc);

  const find = (x) => {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  };

  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) {
      return;
    }
    if (rank[ra] < rank[rb]) {
      parent[ra] = rb;
    } else if (rank[ra] > rank[rb]) {
      parent[rb] = ra;
    } else {
      parent[rb] = ra;
      rank[ra] += 1;
    }
  };

  const steps = sorted.map((edge) => () => {
    const fa = find(edge.u);
    const fb = find(edge.v);
    if (fa !== fb) {
      selectedEdges.push({ ...edge });
      union(edge.u, edge.v);
      cycleEdge = null;
      updateCycleWarning("");
      drawGraph(tc, edge);
      ctx.addLog(`ADD ${nodes[edge.u].label}-${nodes[edge.v].label} (w=${edge.w})`);
    } else {
      cycleEdge = { ...edge };
      const message = `Edge ${nodes[edge.u].label}-${nodes[edge.v].label} (weight ${edge.w}) creates a cycle.`;
      updateCycleWarning(message);
      drawGraph(tc, null);
      ctx.addLog(`REJECT ${nodes[edge.u].label}-${nodes[edge.v].label} (w=${edge.w}) - cycle`);
    }
    updateResult(ctx, tc);
  });

  return { steps };
}

export function action(ctx, actionNode) {
  const actionName = actionNode?.dataset?.action;
  if (actionName !== "mst-switch-case") {
    return false;
  }
  const index = parseInteger(actionNode.dataset.case, ctx.state.mstTC || 0);
  applyCase(ctx, index);
  return true;
}

export async function reset(ctx) {
  await setup(ctx);
}
