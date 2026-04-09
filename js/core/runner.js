import { clearTimer, el, setTrustedHTML } from "./dom.js";
import { ALGO_ORDER } from "./config.js";
import { renderSidebar, addLog, createTrustedSidebarResult } from "./sidebar.js";
import { state } from "./state.js";

const DEFAULT_SPEED_MS = 700;

const algorithmRegistry = Object.fromEntries(ALGO_ORDER.map((algo) => [algo, null]));

function isKnownAlgo(algo) {
  return Object.prototype.hasOwnProperty.call(algorithmRegistry, algo);
}

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

export function createAlgorithmContext() {
  return {
    state,
    addLog,
    renderSidebar,
    getSpeedMs,
    clearTimer,
    el,
    setTrustedHTML,
  };
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

  if (Object.prototype.hasOwnProperty.call(outcome, "trustedResult")) {
    renderSidebar(state.currentAlgo, outcome.trustedResult);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(outcome, "resultText")) {
    renderSidebar(state.currentAlgo, outcome.resultText);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(outcome, "resultHtml")) {
    renderSidebar(state.currentAlgo, outcome.resultHtml);
  }
}

function fallbackMissingRunner() {
  const algo = state.currentAlgo || "selected algorithm";
  renderSidebar(state.currentAlgo, createTrustedSidebarResult("missingRunner"));
  addLog(`No runner registered for ${algo}.`);
}

function initializeQueueIfNeeded() {
  if (state.stepQueue.length > 0 && state.stepIdx < state.stepQueue.length) {
    return;
  }

  state.stepQueue = [];
  state.stepIdx = 0;

  const handler = resolveRunnerHandler();
  if (!handler) {
    fallbackMissingRunner();
    return;
  }

  if (typeof handler === "function") {
    applyRunnerOutcome(handler(createAlgorithmContext()));
    return;
  }

  if (typeof handler.run === "function") {
    applyRunnerOutcome(handler.run(createAlgorithmContext()));
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
    handler.reset(createAlgorithmContext());
    return;
  }

  if (state.currentAlgo) {
    renderSidebar(state.currentAlgo);
  }
}

export function registerAlgoRunner(algo, handler) {
  if (!algo || !isKnownAlgo(algo)) {
    return;
  }

  algorithmRegistry[algo] = handler;
}

export function setAlgoRunnerRegistry(registry) {
  if (!registry || typeof registry !== "object") {
    return;
  }

  for (const key of ALGO_ORDER) {
    if (Object.prototype.hasOwnProperty.call(registry, key)) {
      algorithmRegistry[key] = registry[key];
    }
  }
}

export async function setupCurrentAlgo() {
  const handler = resolveRunnerHandler();
  if (!handler || typeof handler !== "object" || typeof handler.setup !== "function") {
    return;
  }

  await handler.setup(createAlgorithmContext());
}

export function dispatchAlgoAction(actionNode) {
  const handler = resolveRunnerHandler();
  if (!handler || typeof handler !== "object" || typeof handler.action !== "function") {
    return false;
  }

  return handler.action(createAlgorithmContext(), actionNode) === true;
}
