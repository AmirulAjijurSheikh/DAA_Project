import { COMPLEXITY_META } from "./config.js";
import { setTrustedHTML } from "./dom.js";
import { state } from "./state.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStepLog() {
  const logNode = document.getElementById("step-log");
  if (!logNode) {
    return;
  }

  if (!Array.isArray(state.logs) || state.logs.length === 0) {
    logNode.innerHTML =
      '<div class="font-mono text-xs text-slate-500">Waiting to run...</div>';
    return;
  }

  logNode.innerHTML = state.logs
    .map((entry) => `<div class="text-xs text-slate-700">${escapeHtml(entry)}</div>`)
    .join("");
  logNode.scrollTop = logNode.scrollHeight;
}

export function renderSidebar(algo, resultHtml) {
  const complexity = COMPLEXITY_META[algo] || {
    time: "TBD",
    space: "TBD",
    category: "TBD",
  };

  const safeResultHtml =
    resultHtml ||
    '<div class="text-sm text-slate-500">Run the algorithm to see results.</div>';

  setTrustedHTML(
    "sidebar-content",
    `<section class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 class="text-sm font-semibold text-slate-800">Result</h3>
        <div class="mt-2">${safeResultHtml}</div>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 class="text-sm font-semibold text-slate-800">Complexity</h3>
        <dl class="mt-2 space-y-1 text-xs text-slate-700">
          <div class="flex justify-between gap-2"><dt class="font-medium text-slate-500">Time</dt><dd class="text-right">${escapeHtml(complexity.time)}</dd></div>
          <div class="flex justify-between gap-2"><dt class="font-medium text-slate-500">Space</dt><dd class="text-right">${escapeHtml(complexity.space)}</dd></div>
          <div class="flex justify-between gap-2"><dt class="font-medium text-slate-500">Category</dt><dd class="text-right">${escapeHtml(complexity.category)}</dd></div>
        </dl>
      </div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 class="text-sm font-semibold text-slate-800">Step Log</h3>
        <div id="step-log" class="mt-2 max-h-48 space-y-1 overflow-y-auto"></div>
      </div>
    </section>`,
  );

  renderStepLog();
}

export function addLog(message) {
  if (!Array.isArray(state.logs)) {
    state.logs = [];
  }

  state.logs.push(message == null ? "" : String(message));
  renderStepLog();
}
