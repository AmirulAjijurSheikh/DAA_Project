import { clearTimer } from "./dom.js";
import { renderSidebar, addLog } from "./sidebar.js";
import { state } from "./state.js";

const DEFAULT_SPEED_MS = 700;

const algorithmRegistry = {
  complexity: null,
  mst: null,
  knapsack: null,
  activity: null,
  subarray: null,
  lcs: null,
  obst: null,
  hamiltonian: null,
  graphcoloring: null,
};

function normalizeSpeed(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SPEED_MS;
  }

  return Math.max(50, Math.round(numeric));
}

export function getSpeedMs() {
  const control = document.getElementById("speed-range");
  if (!control) {
    return DEFAULT_SPEED_MS;
  }

  return normalizeSpeed(control.value);
}

function resolveRunnerHandler() {
  const key = state.currentAlgo;
  if (!key) {
    return null;
  }

  return algorithmRegistry[key] || null;
}

function applyRunnerOutcome(outcome) {
  if (!outcome || typeof outcome !== "object") {
    return;
  }

  if (Array.isArray(outcome.steps)) {
    state.stepQueue = outcome.steps;
    state.stepIdx = 0;
  }

  if (Array.isArray(outcome.logs)) {
    for (const message of outcome.logs) {
      addLog(message);
    }
  }

  if (typeof outcome.resultHtml === "string") {
    renderSidebar(state.currentAlgo, outcome.resultHtml);
  }
}

function fallbackMissingRunner() {
  const algo = state.currentAlgo || "selected algorithm";
  renderSidebar(
    state.currentAlgo,
    '<div class="text-sm text-amber-700">Runner module is not available yet.</div>',
  );
  addLog(`No runner registered for ${algo}.`);
}

function initializeQueueIfNeeded() {
  if (state.stepQueue.length > 0 || state.stepIdx > 0) {
    return;
  }

  const handler = resolveRunnerHandler();
  if (!handler) {
    fallbackMissingRunner();
    return;
  }

  if (typeof handler === "function") {
    applyRunnerOutcome(handler({ state, addLog, renderSidebar }));
    return;
  }

  if (typeof handler.run === "function") {
    applyRunnerOutcome(handler.run({ state, addLog, renderSidebar }));
    return;
  }

  fallbackMissingRunner();
}

function runNextQueuedStep() {
  if (state.stepIdx >= state.stepQueue.length) {
    clearTimer(state);
    return false;
  }

  const step = state.stepQueue[state.stepIdx];
  state.stepIdx += 1;
  if (typeof step === "function") {
    step();
  }

  if (state.stepIdx >= state.stepQueue.length) {
    clearTimer(state);
  }

  return true;
}

export function runAlgo() {
  clearTimer(state);
  initializeQueueIfNeeded();

  if (state.stepQueue.length === 0 || state.stepIdx >= state.stepQueue.length) {
    return;
  }

  state.animTimer = window.setInterval(() => {
    runNextQueuedStep();
  }, getSpeedMs());
}

export function stepAlgo() {
  clearTimer(state);
  initializeQueueIfNeeded();
  runNextQueuedStep();
}

export function resetAlgo() {
  clearTimer(state);
  state.stepQueue = [];
  state.stepIdx = 0;
  state.logs = [];

  const handler = resolveRunnerHandler();
  if (handler && typeof handler === "object" && typeof handler.reset === "function") {
    handler.reset({ state, renderSidebar, addLog });
    return;
  }

  if (state.currentAlgo) {
    renderSidebar(state.currentAlgo);
  }
}

export function registerAlgoRunner(algo, handler) {
  if (!algo) {
    return;
  }

  algorithmRegistry[algo] = handler;
}

export function setAlgoRunnerRegistry(registry) {
  if (!registry || typeof registry !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(registry)) {
    algorithmRegistry[key] = value;
  }
}
