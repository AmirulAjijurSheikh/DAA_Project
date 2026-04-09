import { COMPLEXITY_META } from "./config.js";
import { setTrustedHTML } from "./dom.js";
import { state } from "./state.js";

const TRUSTED_RESULT_BRAND = Symbol("trustedSidebarResult");

const TRUSTED_RESULT_TEMPLATES = Object.freeze({
  missingRunner:
    '<div class="text-sm text-amber-700">Runner module is not available yet.</div>',
  setupError:
    '<div class="text-sm text-rose-700">Unable to initialize this algorithm right now. Please try again.</div>',
});

const DEFAULT_RESULT_TEXT = "Run the algorithm to see results.";

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

export function createTrustedSidebarResult(templateKey) {
  if (
    typeof templateKey !== "string" ||
    !(templateKey in TRUSTED_RESULT_TEMPLATES)
  ) {
    throw new Error(`Unknown trusted sidebar result template: ${templateKey}`);
  }

  return Object.freeze({
    [TRUSTED_RESULT_BRAND]: true,
    html: TRUSTED_RESULT_TEMPLATES[templateKey],
  });
}

function isTrustedSidebarResult(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value[TRUSTED_RESULT_BRAND] === true &&
      typeof value.html === "string",
  );
}

function resolveResultText(resultValue) {
  if (resultValue == null) {
    return DEFAULT_RESULT_TEXT;
  }

  return String(resultValue);
}

function renderResultContent(resultValue) {
  const resultNode = document.getElementById("result-content");
  if (!resultNode) {
    return;
  }

  if (isTrustedSidebarResult(resultValue)) {
    resultNode.innerHTML = resultValue.html;
    return;
  }

  const paragraph = document.createElement("p");
  paragraph.className = "text-sm text-slate-700";
  paragraph.textContent = resolveResultText(resultValue);
  resultNode.replaceChildren(paragraph);
}

export function renderSidebar(algo, resultValue) {
  const complexity = COMPLEXITY_META[algo] || {
    time: "TBD",
    space: "TBD",
    category: "TBD",
  };

  setTrustedHTML(
    "sidebar-content",
    `<section class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 class="text-sm font-semibold text-slate-800">Result</h3>
        <div id="result-content" class="mt-2"></div>
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

  renderResultContent(resultValue);
  renderStepLog();
}

export function addLog(message) {
  if (!Array.isArray(state.logs)) {
    state.logs = [];
  }

  state.logs.push(message == null ? "" : String(message));
  renderStepLog();
}
