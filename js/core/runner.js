import { clearTimer, el, setTrustedHTML } from "./dom.js";
import { ALGO_ORDER } from "./config.js";
import { renderSidebar, addLog, createTrustedSidebarResult } from "./sidebar.js";
import { state } from "./state.js";

const DEFAULT_SPEED_MS = 700;
const SETUP_FAILURE_LOG_MESSAGE = "Unable to initialize this algorithm. Try selecting it again.";

const algorithmRegistry = Object.fromEntries(ALGO_ORDER.map((algo) => [algo, null]));

/**
 * @typedef {object} AlgorithmRunnerContext
 * @property {typeof state} state
 * @property {(message: unknown) => void} addLog
 * @property {(algo: string | null, resultValue?: unknown) => void} renderSidebar
 * @property {() => number} getSpeedMs
 * @property {(targetState: typeof state) => void} clearTimer
 * @property {(tagName: string, className?: string, text?: string) => HTMLElement} el
 * @property {(elementId: string, html: string) => void} setTrustedHTML
 * @property {() => boolean} isActive
 */

/**
 * @typedef {object} AlgorithmRunnerOutcome
 * @property {Array<(() => void)>} [steps]
 * @property {Array<unknown>} [logs]
 * @property {unknown} [resultText]
 * @property {unknown} [resultHtml]
 * @property {unknown} [trustedResult]
 */

/**
 * @typedef {(ctx: AlgorithmRunnerContext) => AlgorithmRunnerOutcome | void} AlgorithmRunHandler
 */

/**
 * @typedef {object} AlgorithmRunnerModule
 * @property {(ctx: AlgorithmRunnerContext) => Promise<void> | void} [setup]
 * @property {AlgorithmRunHandler} [run]
 * @property {(ctx: AlgorithmRunnerContext) => Promise<void> | void} [reset]
 * @property {(ctx: AlgorithmRunnerContext, actionNode: HTMLElement) => boolean | void} [action]
 */

/**
 * @typedef {AlgorithmRunHandler | AlgorithmRunnerModule | null} RegisteredRunner
 */

function isKnownAlgo(algo) {
  return Object.prototype.hasOwnProperty.call(algorithmRegistry, algo);
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function isFunction(value) {
  return typeof value === "function";
}

function isRunnerModule(value) {
  return isObject(value);
}

function hasModuleMethod(handler, methodName) {
  return isRunnerModule(handler) && isFunction(handler[methodName]);
}

function getRunHandler(handler) {
  if (isFunction(handler)) {
    return handler;
  }

  if (hasModuleMethod(handler, "run")) {
    return handler.run;
  }

  return null;
}

function getSetupHandler(handler) {
  return hasModuleMethod(handler, "setup") ? handler.setup : null;
}

function getResetHandler(handler) {
  return hasModuleMethod(handler, "reset") ? handler.reset : null;
}

function getActionHandler(handler) {
  return hasModuleMethod(handler, "action") ? handler.action : null;
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

function createGuardedMethod(method, shouldApply) {
  return (...args) => {
    if (!shouldApply()) {
      return undefined;
    }

    return method(...args);
  };
}

export function createAlgorithmContext(options = {}) {
  const shouldApply = isFunction(options.shouldApply) ? options.shouldApply : () => true;

  return {
    state,
    addLog: createGuardedMethod(addLog, shouldApply),
    renderSidebar: createGuardedMethod(renderSidebar, shouldApply),
    getSpeedMs,
    clearTimer,
    el,
    setTrustedHTML: createGuardedMethod(setTrustedHTML, shouldApply),
    isActive: shouldApply,
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
  const runHandler = getRunHandler(handler);
  if (!runHandler) {
    fallbackMissingRunner();
    return;
  }

  applyRunnerOutcome(runHandler(createAlgorithmContext()));
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
  invalidateSetupLifecycle();
  state.stepQueue = [];
  state.stepIdx = 0;
  state.logs = [];

  const handler = resolveRunnerHandler();
  const resetHandler = getResetHandler(handler);
  if (resetHandler) {
    resetHandler(createAlgorithmContext());
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

export function invalidateSetupLifecycle() {
  state.setupVersion += 1;
}

function isActiveSetup(algo, version) {
  return state.currentAlgo === algo && state.setupVersion === version;
}

export async function setupCurrentAlgo() {
  const setupAlgo = state.currentAlgo;
  if (!setupAlgo) {
    return false;
  }

  const handler = resolveRunnerHandler();
  const setupHandler = getSetupHandler(handler);
  if (!setupHandler) {
    return false;
  }

  invalidateSetupLifecycle();
  const setupVersion = state.setupVersion;
  const shouldApply = () => isActiveSetup(setupAlgo, setupVersion);

  try {
    await setupHandler(createAlgorithmContext({ shouldApply }));
    return shouldApply();
  } catch {
    if (!shouldApply()) {
      return false;
    }

    console.error(`[runner] setup failed for ${setupAlgo}`);
    renderSidebar(setupAlgo, createTrustedSidebarResult("setupError"));
    addLog(SETUP_FAILURE_LOG_MESSAGE);
    return false;
  }
}

export function dispatchAlgoAction(actionNode) {
  const handler = resolveRunnerHandler();
  const actionHandler = getActionHandler(handler);
  if (!actionHandler) {
    return false;
  }

  return actionHandler(createAlgorithmContext(), actionNode) === true;
}
