const PARTIAL_CACHE = new Map();

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function parseNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function parseInteger(value, fallback) {
  const numeric = parseInt(String(value), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export async function loadInputPartial(slug, fallbackHtml = "") {
  if (PARTIAL_CACHE.has(slug)) {
    return PARTIAL_CACHE.get(slug);
  }

  try {
    const response = await fetch(`partials/inputs/${slug}.html`, { cache: "no-store" });
    if (response.ok) {
      const html = await response.text();
      PARTIAL_CACHE.set(slug, html);
      return html;
    }
  } catch {
    // Ignore and use fallback template.
  }

  PARTIAL_CACHE.set(slug, fallbackHtml);
  return fallbackHtml;
}

export async function setupAlgoShell(ctx, slug, fallbackInputsHtml, vizHtml) {
  const inputsHtml = await loadInputPartial(slug, fallbackInputsHtml);
  if (!ctx.isActive()) {
    return false;
  }

  ctx.setTrustedHTML("algo-inputs", inputsHtml);
  ctx.setTrustedHTML("viz-content", vizHtml);
  ctx.renderSidebar(slug);
  return ctx.isActive();
}

export function getCanvasContext(canvasId, height = 300) {
  const canvas = document.getElementById(canvasId);
  if (!(canvas instanceof HTMLCanvasElement)) {
    return null;
  }

  const parentWidth = canvas.parentElement?.clientWidth || canvas.clientWidth || 1;
  canvas.width = Math.max(1, parentWidth);
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  return { canvas, ctx: context, width: canvas.width, height: canvas.height };
}

export function resetRunnerState(ctx) {
  ctx.state.stepQueue = [];
  ctx.state.stepIdx = 0;
  ctx.state.logs = [];
  ctx.clearTimer(ctx.state);
}
