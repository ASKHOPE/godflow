import { PIPELINE_STAGES, SCENARIOS } from "../data/seed.js";
import { openPipelineDrawer } from "../components/drawer.js";
import { openQuickCaptureModal } from "../components/modal.js";
import { createScenarioBadge, createStatusPill, h } from "../lib/dom.js";
import { parseRouteFromLocation } from "../lib/router.js";
import { can, canEditScenario, getState, getTenantSlice, movePipelineStage } from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let activeScenarioFilter = "all";
let searchTerm = "";

export function renderPipeline(fromNavigation = false) {
  if (fromNavigation) {
    const { params } = parseRouteFromLocation();
    const paramScen = params.get("scenario");
    if (paramScen && (paramScen === "all" || SCENARIOS.some((s) => s.id === paramScen))) {
      activeScenarioFilter = paramScen;
    }
  }

  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, role } = slice.ctx;
  const canCreate = can("pipeline:write", snap);

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Production Pipeline"),
      h("p", { class: "page-subtitle" }, `Content & Broadcast Flow Tracker (${workspace.name}) · Active RBAC: ${role.name}`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary",
          disabled: !canCreate,
          onClick: () => openQuickCaptureModal()
        },
        "+ New Production Card"
      )
    )
  );

  const allowedScenarios =
    slice.ctx.isGodMode || role.id === "tenant_admin"
      ? SCENARIOS
      : SCENARIOS.filter((s) => role.scenarios.includes(s.id));

  if (activeScenarioFilter !== "all" && !allowedScenarios.some((s) => s.id === activeScenarioFilter)) {
    activeScenarioFilter = "all";
  }

  const countsByScenario = Object.groupBy(slice.pipelineItems, (i) => i.scenario);
  const filterOptions = [
    ...(allowedScenarios.length > 1 ? [{ id: "all", label: "All", count: slice.pipelineItems.length }] : []),
    ...allowedScenarios.map((s) => ({
      id: s.id,
      label: s.label,
      count: (countsByScenario[s.id] ?? []).length
    }))
  ];

  const searchInput = h("input", {
    id: "pipe-search",
    class: "input",
    type: "search",
    value: searchTerm,
    placeholder: "Search productions, slugs, or Trilium notes...",
    style: "max-inline-size:280px;",
    onInput: (e) => {
      searchTerm = e.target.value;
      updateBoardOnly();
    }
  });

  const controls = h(
    "div",
    { class: "card", style: "gap:0.75rem;" },
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;" },
      h(
        "div",
        { class: "filter-bar", role: "group", "aria-label": "Filter by production scenario" },
        ...filterOptions.map((opt) =>
          h(
            "button",
            {
              type: "button",
              class: "filter-pill",
              "aria-pressed": String(activeScenarioFilter === opt.id),
              onClick: () => {
                activeScenarioFilter = opt.id;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            },
            opt.label,
            h("span", { class: "mono-meta" }, String(opt.count))
          )
        )
      ),
      h(
        "search",
        {},
        h("label", { class: "visually-hidden", for: "pipe-search" }, "Search pipeline cards"),
        searchInput
      )
    )
  );

  const boardContainer = h("section", { class: "kanban-board", "aria-label": "Production workflow columns" });

  function buildBoard() {
    const latest = getState();
    const latestSlice = getTenantSlice(latest);
    const q = searchTerm.trim().toLowerCase();
    const filtered = latestSlice.pipelineItems.filter((item) => {
      const matchScenario = activeScenarioFilter === "all" || item.scenario === activeScenarioFilter;
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.emdashSlug.toLowerCase().includes(q) ||
        item.triliumNoteId.toLowerCase().includes(q);
      return matchScenario && matchQuery;
    });

    const grouped = Object.groupBy(filtered, (item) => item.stage);

    const cols = PIPELINE_STAGES.map((stage, stageIdx) => {
      const items = grouped[stage.id] ?? [];
      const nextStage = PIPELINE_STAGES[stageIdx + 1];

      return h(
        "div",
        { class: "kanban-col" },
        h(
          "div",
          { class: "kanban-col-head" },
          h("div", {}, h("h2", { class: "kanban-col-title" }, stage.label), h("div", { class: "kanban-col-sub" }, stage.subtitle)),
          h("span", { class: "badge mono" }, String(items.length))
        ),
        h(
          "div",
          { class: "kanban-list" },
          ...(items.length
            ? items.map((item) => {
                const done = item.checklist.filter((c) => c.done).length;
                const total = item.checklist.length || 1;
                const pct = Math.round((done / total) * 100);
                const publishedRep = item.repurposing.filter((r) => r.status === "Published").length;
                const editable = canEditScenario(item.scenario, latest);

                return h(
                  "article",
                  { class: "pipeline-card" },
                  h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:0.4rem;" }, createScenarioBadge(item.scenario, SCENARIOS), h("span", { class: "mono-meta" }, item.dueDate)),
                  h(
                    "button",
                    {
                      type: "button",
                      style: "border:0;background:none;padding:0;text-align:start;color:inherit;cursor:pointer;font-family:inherit;",
                      onClick: () => openPipelineDrawer(item.id)
                    },
                    h("h3", { class: "pipeline-card-title" }, item.title)
                  ),
                  h("div", { class: "mono-meta truncate" }, item.toolLabel),
                  h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${pct}%` } })),
                  h("div", { class: "pipeline-card-meta" }, h("span", {}, `${done}/${total} checks · ${publishedRep}/${item.repurposing.length} clips`), h("span", {}, `${item.affiliateSlugs.length} /go`)),
                  h(
                    "div",
                    { style: "display:flex;justify-content:space-between;align-items:center;gap:0.4rem;padding-top:0.2rem;" },
                    h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => openPipelineDrawer(item.id) }, "Details"),
                    nextStage
                      ? editable
                        ? h(
                            "button",
                            {
                              type: "button",
                              class: "btn btn--ghost btn--sm",
                              "aria-label": `Advance ${item.title} to ${nextStage.label}`,
                              onClick: () => {
                                movePipelineStage(item.id, nextStage.id);
                                showToast(`Moved to ${nextStage.label}`, { tone: "info" });
                              }
                            },
                            `${nextStage.label} →`
                          )
                        : createStatusPill("Read-Only", "warn")
                      : h("span", { class: "status-pill status-pill--ok" }, "Live")
                  )
                );
              })
            : [h("p", { class: "page-subtitle", style: "padding:0.75rem 0.25rem;" }, "No items in this stage.")])
        )
      );
    });

    boardContainer.replaceChildren(...cols);
  }

  function updateBoardOnly() {
    buildBoard();
  }

  buildBoard();
  return [header, controls, boardContainer];
}
