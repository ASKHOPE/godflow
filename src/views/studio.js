import { SCENARIOS } from "../data/seed.js";
import { createScenarioBadge, createStatusPill, h } from "../lib/dom.js";
import { parseRouteFromLocation } from "../lib/router.js";
import { canAccessTool, getActiveContext, getState } from "../lib/store.js";
import { renderModuleVersionGuard } from "../lib/workbench-helpers.js";
import { renderArticleStudio } from "../workbenches/article-studio.js";
import { renderMusicStudio } from "../workbenches/music-studio.js";
import { renderPodcastStudio } from "../workbenches/podcast-studio.js";
import { renderSocialStudio } from "../workbenches/social-studio.js";
import { renderStockStudio } from "../workbenches/stock-studio.js";
import { renderVideoStudio } from "../workbenches/video-studio.js";

const STUDIO_RENDERERS = {
  article: renderArticleStudio,
  social: renderSocialStudio,
  stock: renderStockStudio,
  video: renderVideoStudio,
  music: renderMusicStudio,
  podcast: renderPodcastStudio
};

let activeScenarioId = null;

export function renderStudio(fromNavigation = false) {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const isUnrestricted = ctx.isGodMode || ctx.role.id === "tenant_admin";

  const allowedScenarios = SCENARIOS.filter(
    (sc) => isUnrestricted || canAccessTool(`studio:${sc.id}`, snap)
  );

  if (fromNavigation) {
    const rawParamSc = parseRouteFromLocation().params.get("scenario");
    const paramSc = rawParamSc === "gaming" ? "stock" : rawParamSc;
    if (paramSc && allowedScenarios.some((s) => s.id === paramSc)) {
      activeScenarioId = paramSc;
    }
  }

  if (!activeScenarioId || !allowedScenarios.some((s) => s.id === activeScenarioId)) {
    activeScenarioId = allowedScenarios[0]?.id ?? null;
  }

  if (!activeScenarioId) {
    return [
      h(
        "section",
        { class: "card" },
        h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Workbenches — No Studio Clearance"),
        h("p", { class: "page-subtitle" }, `Role "${ctx.role.name}" does not include creative scenario workbench access.`)
      )
    ];
  }

  const currentMeta = SCENARIOS.find((s) => s.id === activeScenarioId) ?? allowedScenarios[0];

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, `${currentMeta.label} — Workbench`),
      h("p", { class: "page-subtitle" }, `${currentMeta.description} · Active Role: ${ctx.role.name}`)
    ),
    h(
      "div",
      { class: "page-actions" },
      createScenarioBadge(currentMeta.id, SCENARIOS),
      createStatusPill(isUnrestricted ? `All ${SCENARIOS.length} Studios Unlocked` : "Role-Isolated Studio", "ok")
    )
  );

  const switcher =
    allowedScenarios.length > 1
      ? h(
          "div",
          { class: "filter-bar", role: "group", "aria-label": "Switch Scenario Workbench" },
          ...allowedScenarios.map((sc) =>
            h(
              "button",
              {
                type: "button",
                class: "filter-pill",
                "aria-pressed": String(sc.id === activeScenarioId),
                onClick: () => {
                  activeScenarioId = sc.id;
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              },
              sc.label
            )
          )
        )
      : null;

  const studioBody = (STUDIO_RENDERERS[activeScenarioId] ?? renderArticleStudio)();
  const modGuard = renderModuleVersionGuard("mod-workbenches", "Scenario Workbenches & Research Desk");
  if (!modGuard.enabled) return modGuard.blockedNodes;

  const expStrip = modGuard.status?.track === "experimental"
    ? h(
        "div",
        { class: "card", style: "padding:0.55rem 0.9rem;border-color:var(--status-warn);background:var(--status-warn-bg);flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
        h("span", { style: "font-size:var(--text-xs);" }, "Experimental Features Unlocked: AI Outline Auto-Compiler · Dual-Deck Live Stream Matrix · 64-bit WebAudio DSP"),
        createStatusPill(`EXP v${modGuard.status.installedVersion}`, "warn")
      )
    : null;

  return [
    header,
    ...(modGuard.bannerNode ? [modGuard.bannerNode] : []),
    ...(expStrip ? [expStrip] : []),
    ...(switcher ? [switcher] : []),
    studioBody
  ];
}
