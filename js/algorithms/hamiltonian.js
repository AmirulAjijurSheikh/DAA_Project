import { getCanvasContext, setupAlgoShell } from "./shared.js";

const HAM_NODES = [
  { x: 0.5, y: 0.12 },
  { x: 0.85, y: 0.38 },
  { x: 0.72, y: 0.82 },
  { x: 0.28, y: 0.82 },
  { x: 0.15, y: 0.38 },
];

const HAM_ADJ = [
  [0, 1, 0, 1, 1],
  [1, 0, 1, 0, 1],
  [0, 1, 0, 1, 0],
  [1, 0, 1, 0, 1],
  [1, 1, 0, 1, 0],
];

const INPUTS_FALLBACK =
  '<p class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Pentagon graph (5 nodes). Backtracking searches for a Hamiltonian cycle.</p>';

const VIZ_HTML = `
  <div class="space-y-3">
    <canvas id="ham-canvas" class="w-full rounded-md border border-slate-200 bg-white" height="300"></canvas>
    <div id="ham-info" class="text-xs font-mono text-slate-600"></div>
  </div>
`;

function drawGraph(path = [], current = -1) {
  const chart = getCanvasContext("ham-canvas", 280);
  if (!chart) {
    return;
  }

  const { ctx, width: w, height: h } = chart;
  const nx = (node) => node.x * w * 0.7 + w * 0.15;
  const ny = (node) => node.y * h * 0.8 + h * 0.08;

  ctx.clearRect(0, 0, w, h);

  HAM_ADJ.forEach((row, i) => {
    row.forEach((value, j) => {
      if (!value || i >= j) {
        return;
      }
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nx(HAM_NODES[i]), ny(HAM_NODES[i]));
      ctx.lineTo(nx(HAM_NODES[j]), ny(HAM_NODES[j]));
      ctx.stroke();
    });
  });

  for (let i = 0; i < path.length - 1; i += 1) {
    const a = HAM_NODES[path[i]];
    const b = HAM_NODES[path[i + 1]];
    ctx.strokeStyle = "#14b8a6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nx(a), ny(a));
    ctx.lineTo(nx(b), ny(b));
    ctx.stroke();
  }

  if (path.length > 1 && HAM_ADJ[path[path.length - 1]][path[0]]) {
    const a = HAM_NODES[path[path.length - 1]];
    const b = HAM_NODES[path[0]];
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(nx(a), ny(a));
    ctx.lineTo(nx(b), ny(b));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  HAM_NODES.forEach((node, idx) => {
    const inPath = path.includes(idx);
    const isCurrent = idx === current;
    ctx.fillStyle = inPath ? "#ccfbf1" : isCurrent ? "#fef3c7" : "#f8fafc";
    ctx.beginPath();
    ctx.arc(nx(node), ny(node), 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inPath ? "#0f766e" : isCurrent ? "#d97706" : "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(idx), nx(node), ny(node));
  });
}

export async function setup(ctx) {
  if (!(await setupAlgoShell(ctx, "hamiltonian", INPUTS_FALLBACK, VIZ_HTML))) {
    return;
  }
  drawGraph([], -1);
}

export function run(ctx) {
  const n = HAM_NODES.length;
  const path = [0];
  const visited = Array(n).fill(false);
  visited[0] = true;
  const steps = [];
  let foundPath = null;

  const solve = (pos) => {
    if (pos === n) {
      if (HAM_ADJ[path[pos - 1]][path[0]]) {
        foundPath = [...path];
        steps.push(() => {
          drawGraph(foundPath, foundPath[0]);
          const info = document.getElementById("ham-info");
          if (info) {
            info.textContent = `Cycle found: 0 -> ${foundPath.slice(1).join(" -> ")} -> 0`;
          }
          ctx.addLog(`Cycle found: 0 -> ${foundPath.slice(1).join(" -> ")} -> 0`);
          ctx.renderSidebar("hamiltonian", `Hamiltonian cycle found: 0 -> ${foundPath.slice(1).join(" -> ")} -> 0`);
        });
        return true;
      }
      return false;
    }

    for (let v = 1; v < n; v += 1) {
      if (!visited[v] && HAM_ADJ[path[pos - 1]][v]) {
        path.push(v);
        visited[v] = true;
        const snapshot = [...path];
        steps.push(() => {
          drawGraph(snapshot, v);
          ctx.addLog(`Try node ${v} at depth ${pos}`);
        });

        if (solve(pos + 1)) {
          return true;
        }

        path.pop();
        visited[v] = false;
        const backtrack = [...path];
        steps.push(() => {
          drawGraph(backtrack, -1);
          ctx.addLog(`Backtrack from ${v}`);
        });
      }
    }

    return false;
  };

  const solved = solve(1);
  if (!solved) {
    steps.push(() => {
      drawGraph([], -1);
      const info = document.getElementById("ham-info");
      if (info) {
        info.textContent = "No Hamiltonian cycle exists for this graph.";
      }
      ctx.addLog("No Hamiltonian cycle exists.");
      ctx.renderSidebar("hamiltonian", "No Hamiltonian cycle found.");
    });
  }

  return { steps };
}

export async function reset(ctx) {
  await setup(ctx);
}
