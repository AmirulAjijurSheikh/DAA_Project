import { getCanvasContext, parseInteger, setupAlgoShell } from "./shared.js";

const INPUTS_FALLBACK = `
  <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
    <label class="block">
      <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Number of Sensor Readings (n)</span>
      <input id="cx-n" type="number" min="2" max="60" value="10" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500">
    </label>
    <div class="text-xs text-slate-500">Higher n exaggerates O(n^2) growth.</div>
  </div>
`;

const VIZ_HTML = `
  <div class="space-y-2">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sensor Data Complexity Chart</div>
    <canvas id="complexity-canvas" class="w-full rounded-md border border-slate-200 bg-white" height="260"></canvas>
  </div>
`;

function drawSeries(ns, o1, on, onlogn, on2) {
  const chart = getCanvasContext("complexity-canvas", 260);
  if (!chart) {
    return;
  }

  const { ctx, width: w, height: h } = chart;
  const pad = { t: 18, r: 18, b: 34, l: 42 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const maxY = Math.max(...on2, 1);
  const scaleX = (idx) => (ns.length <= 1 ? pad.l : pad.l + (idx / (ns.length - 1)) * cw);
  const scaleY = (value) => pad.t + ch - (value / maxY) * ch;

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e2e8f0";

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + (ch / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + cw, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "11px JetBrains Mono";
    ctx.fillText(String(Math.round(maxY - (maxY / 4) * i)), 4, y + 4);
  }

  const series = [
    { data: o1, color: "#14b8a6", label: "O(1)" },
    { data: on, color: "#eab308", label: "O(n)" },
    { data: onlogn, color: "#6366f1", label: "O(n log n)" },
    { data: on2, color: "#ef4444", label: "O(n^2)" },
  ];

  for (const item of series) {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    item.data.forEach((value, index) => {
      const x = scaleX(index);
      const y = scaleY(value);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.fillStyle = item.color;
    ctx.font = "11px JetBrains Mono";
    ctx.fillText(item.label, w - pad.r - 74, scaleY(item.data[item.data.length - 1]) + 4);
  }

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + ch);
  ctx.lineTo(pad.l + cw, pad.t + ch);
  ctx.stroke();

  const stride = Math.max(1, Math.floor(ns.length / 6));
  for (let i = 0; i < ns.length; i += stride) {
    ctx.fillStyle = "#64748b";
    ctx.font = "10px JetBrains Mono";
    ctx.fillText(String(ns[i]), scaleX(i) - 4, h - 8);
  }
}

export async function setup(ctx) {
  await setupAlgoShell(ctx, "complexity", INPUTS_FALLBACK, VIZ_HTML);
}

export function run(ctx) {
  const nInput = document.getElementById("cx-n");
  const n = Math.max(2, Math.min(60, parseInteger(nInput?.value, 10)));
  const temps = Array.from({ length: n }, () => Number((20 + Math.random() * 15).toFixed(1)));
  const press = Array.from({ length: n }, () => Number((1000 + Math.random() * 50).toFixed(1)));
  const ns = Array.from({ length: n }, (_, i) => i + 1);
  const o1 = ns.map(() => 1);
  const on = ns.map((x) => x);
  const on2 = ns.map((x) => x * x);
  const onlogn = ns.map((x) => Number((x * Math.log2(x + 1)).toFixed(1)));

  return {
    steps: [
      () => {
        ctx.addLog(`n = ${n} sensor readings generated`);
        ctx.addLog(`Temp range: ${Math.min(...temps).toFixed(1)}C to ${Math.max(...temps).toFixed(1)}C`);
        ctx.addLog(`Pressure range: ${Math.min(...press).toFixed(1)} to ${Math.max(...press).toFixed(1)} Pa`);
        drawSeries(ns, o1, on, onlogn, on2);
        ctx.renderSidebar("complexity", `Sensor readings: ${n} | Max temp: ${Math.max(...temps).toFixed(1)}C`);
        ctx.addLog(`O(1): constant, 1 operation`);
        ctx.addLog(`O(n): linear, ${n} operations`);
        ctx.addLog(`O(n log n): ${onlogn[n - 1]} operations`);
        ctx.addLog(`O(n^2): quadratic, ${n * n} operations`);
      },
    ],
  };
}

export async function reset(ctx) {
  await setup(ctx);
}
