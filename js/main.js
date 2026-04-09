import { ALGO_META } from "./core/config.js";
import { clearTimer, setText } from "./core/dom.js";
import {
  dispatchAlgoAction,
  invalidateSetupLifecycle,
  resetAlgo,
  runAlgo,
  setAlgoRunnerRegistry,
  setupCurrentAlgo,
  stepAlgo,
} from "./core/runner.js";
import { renderSidebar } from "./core/sidebar.js";
import { state } from "./core/state.js";
import * as complexity from "./algorithms/complexity.js";
import * as mst from "./algorithms/mst.js";
import * as knapsack from "./algorithms/knapsack.js";
import * as activity from "./algorithms/activity.js";
import * as subarray from "./algorithms/subarray.js";
import * as lcs from "./algorithms/lcs.js";
import * as obst from "./algorithms/obst.js";
import * as hamiltonian from "./algorithms/hamiltonian.js";
import * as graphcoloring from "./algorithms/graphcoloring.js";

const RUNNER_CONTROLS_BOUND = "__daaRunnerControlsBound";
const CLICK_ONLY_ACTIONS = new Set(["run", "step", "reset"]);
const CLICK_OR_CHANGE_ACTIONS = new Set(["mst-switch-case", "gc-switch-preset"]);

const delegatedActionTickByNode = new WeakMap();
let delegatedActionTick = 0;
let delegatedActionTickScheduled = false;

function getDelegatedActionTick() {
  if (!delegatedActionTickScheduled) {
    delegatedActionTickScheduled = true;
    queueMicrotask(() => {
      delegatedActionTick += 1;
      delegatedActionTickScheduled = false;
    });
  }

  return delegatedActionTick;
}

function isDuplicateDelegatedAction(actionNode, action) {
  const tick = getDelegatedActionTick();
  const previous = delegatedActionTickByNode.get(actionNode);
  if (previous && previous.action === action && previous.tick === tick) {
    return true;
  }

  delegatedActionTickByNode.set(actionNode, { action, tick });
  return false;
}

function allowsDelegatedEvent(action, eventType) {
  if (CLICK_ONLY_ACTIONS.has(action)) {
    return eventType === "click";
  }

  if (CLICK_OR_CHANGE_ACTIONS.has(action)) {
    return eventType === "click" || eventType === "change";
  }

  return eventType === "click";
}

function normalizeAlgoSlug(slug) {
  if (!slug) {
    return null;
  }

  const normalized = String(slug).trim().toLowerCase();
  return normalized || null;
}

function parseAlgoFromPath(pathLike) {
  if (!pathLike) {
    return null;
  }

  try {
    const url = new URL(String(pathLike), window.location.href);
    const queryAlgo = normalizeAlgoSlug(url.searchParams.get("algo"));
    if (queryAlgo) {
      return queryAlgo;
    }

    const hashMatch = url.hash.match(/#\/algo\/([^/?#]+)/i);
    if (hashMatch) {
      return normalizeAlgoSlug(hashMatch[1]);
    }

    const pathMatch = url.pathname.match(/\/algo\/([^/?#]+)/i);
    if (pathMatch) {
      return normalizeAlgoSlug(pathMatch[1]);
    }
  } catch {
    return null;
  }

  return null;
}

function resolveAlgoSlug(evt, algoPage) {
  const detail = evt?.detail ?? {};
  const requestConfig = detail.requestConfig ?? {};
  const pathInfo = detail.pathInfo ?? {};
  const triggerElt = detail.elt;

  return (
    parseAlgoFromPath(requestConfig.path) ||
    parseAlgoFromPath(pathInfo.requestPath) ||
    parseAlgoFromPath(detail.xhr?.responseURL) ||
    normalizeAlgoSlug(triggerElt?.dataset?.algo) ||
    normalizeAlgoSlug(algoPage?.dataset?.algo) ||
    parseAlgoFromPath(window.location.hash)
  );
}

function setBadgeColor(meta) {
  const badge = document.getElementById("algo-tag-badge");
  if (!badge) {
    return;
  }

  badge.style.backgroundColor = "";
  badge.style.color = "";

  if (!meta?.color) {
    return;
  }

  badge.style.backgroundColor = `${meta.color}1a`;
  badge.style.color = meta.color;
}

function resetTransientState() {
  clearTimer(state);
  invalidateSetupLifecycle();
  state.stepQueue = [];
  state.stepIdx = 0;
  state.logs = [];
  state.mstTC = 0;
  state.gcPreset = 0;
}

function resolveKnownAlgoSlug(slug) {
  const normalizedSlug = normalizeAlgoSlug(slug);
  return normalizedSlug && ALGO_META[normalizedSlug] ? normalizedSlug : null;
}

function initHomePage() {
  resetTransientState();
  state.currentAlgo = null;
}

function initAlgorithmPage(algoPage, slug) {
  resetTransientState();

  const resolvedSlug = resolveKnownAlgoSlug(slug);
  state.currentAlgo = resolvedSlug;
  algoPage.dataset.algo = resolvedSlug || "";

  const meta = resolvedSlug ? ALGO_META[resolvedSlug] : null;
  setText("algo-title", meta?.title || "Algorithm");
  setText("algo-tag-badge", meta?.tag || "");
  setBadgeColor(meta);

  if (resolvedSlug) {
    renderSidebar(resolvedSlug);
    void setupCurrentAlgo();
  }
}

function initPageFromApp(app, evt) {
  const homePage = app.querySelector("#home-page[data-page='home']");
  if (homePage) {
    initHomePage();
    return;
  }

  const algoPage = app.querySelector("#algo-page[data-page='algorithm']");
  if (!algoPage) {
    return;
  }

  const slug = resolveAlgoSlug(evt, algoPage);
  initAlgorithmPage(algoPage, slug);
}

function onAfterSwap(evt) {
  const target = evt?.detail?.target;
  if (!(target instanceof HTMLElement) || target.id !== "app") {
    return;
  }

  initPageFromApp(target, evt);
}

function onDelegatedAction(evt) {
  const eventType = evt.type;
  if (eventType !== "click" && eventType !== "change") {
    return;
  }

  const target = evt.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionNode = target.closest("[data-action]");
  if (!(actionNode instanceof HTMLElement)) {
    return;
  }

  const algoPage = actionNode.closest("#algo-page[data-page='algorithm']");
  if (!algoPage) {
    return;
  }

  const action = actionNode.dataset.action;
  if (!action || !allowsDelegatedEvent(action, eventType)) {
    return;
  }

  if (CLICK_OR_CHANGE_ACTIONS.has(action) && isDuplicateDelegatedAction(actionNode, action)) {
    return;
  }

  if (eventType === "click") {
    evt.preventDefault();
  }

  if (!CLICK_ONLY_ACTIONS.has(action)) {
    const handled = dispatchAlgoAction(actionNode);
    if (handled) {
      return;
    }
    return;
  }

  if (action === "run") {
    runAlgo();
    return;
  }

  if (action === "step") {
    stepAlgo();
    return;
  }

  resetAlgo();
}

setAlgoRunnerRegistry({
  complexity,
  mst,
  knapsack,
  activity,
  subarray,
  lcs,
  obst,
  hamiltonian,
  graphcoloring,
});

document.body.addEventListener("htmx:afterSwap", onAfterSwap);

if (!window[RUNNER_CONTROLS_BOUND]) {
  document.body.addEventListener("click", onDelegatedAction);
  document.body.addEventListener("change", onDelegatedAction);
  window[RUNNER_CONTROLS_BOUND] = true;
}

const appRoot = document.getElementById("app");
if (appRoot) {
  initPageFromApp(appRoot, null);
}
