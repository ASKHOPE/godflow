import { PIPELINE_STAGES, SCENARIOS } from "../data/seed.js";
import { copyText } from "../lib/clipboard.js";
import { createScenarioBadge, createStatusPill, h } from "../lib/dom.js";
import {
  canEditScenario,
  cycleRepurposeStatus,
  getActiveContext,
  getState,
  movePipelineStage,
  toggleChecklistItem
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let activeItemId = null;

function installLightDismissFallback(dialog) {
  if ("closedBy" in HTMLDialogElement.prototype) return;
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (e) => {
    pressedOutside = outside(e);
  });
  dialog.addEventListener("pointerup", (e) => {
    if (pressedOutside && outside(e)) dialog.close();
  });
}

export function initDrawer() {
  const dialog = document.getElementById("pipeline-drawer");
  if (!dialog) return;
  installLightDismissFallback(dialog);
  dialog.addEventListener("close", () => {
    dialog.returnValue = "";
    activeItemId = null;
  });
}

export function refreshDrawerIfOpen() {
  const dialog = document.getElementById("pipeline-drawer");
  if (dialog?.open && activeItemId) {
    renderDrawerBody(activeItemId);
  }
}

export function openPipelineDrawer(itemId) {
  const dialog = document.getElementById("pipeline-drawer");
  if (!dialog) return;
  activeItemId = itemId;
  renderDrawerBody(itemId);
  if (!dialog.open) {
    dialog.showModal();
  }
}

function renderDrawerBody(itemId) {
  const container = document.getElementById("drawer-content");
  const dialog = document.getElementById("pipeline-drawer");
  if (!container || !dialog) return;

  const snap = getState();
  const item = snap.pipelineItems.find((p) => p.id === itemId);
  if (!item) {
    dialog.close();
    return;
  }

  const { workspace, role } = getActiveContext(snap);
  const canEdit = canEditScenario(item.scenario, snap);
  const owner = snap.users.find((u) => u.id === item.ownerUserId);

  const doneCount = item.checklist.filter((c) => c.done).length;
  const pct = item.checklist.length ? Math.round((doneCount / item.checklist.length) * 100) : 100;
  const attachedLinks = snap.shortLinks.filter((l) => item.affiliateSlugs.includes(l.slug));

  const header = h(
    "div",
    { class: "dialog-header" },
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:0.4rem;min-inline-size:0;" },
      h(
        "div",
        { style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.45rem;" },
        createScenarioBadge(item.scenario, SCENARIOS),
        h("span", { class: "mono-meta" }, `Note: ${item.triliumNoteId}`),
        h("span", { class: "mono-meta" }, `Owner: ${owner?.name ?? "Team"}`)
      ),
      h("h1", { id: "drawer-title", class: "dialog-title" }, item.title),
      h("span", { class: "mono-meta" }, `EmDash slug: /${item.emdashSlug} · ${item.toolLabel}`)
    ),
    h(
      "button",
      {
        type: "button",
        class: "icon-btn",
        "aria-label": "Close workflow drawer",
        onClick: () => dialog.close("close")
      },
      "✕"
    )
  );

  const rbacNotice = !canEdit
    ? h(
        "div",
        { class: "rbac-notice" },
        h("span", {}, `Read-only under role "${role.name}". Requires ${item.scenario} scenario write access or God Mode.`)
      )
    : null;

  const stageSection = h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header" },
      h("h2", { class: "card-title" }, "Workflow Stage"),
      h("span", { class: "mono-meta" }, `${doneCount}/${item.checklist.length} tasks`)
    ),
    h(
      "div",
      { class: "filter-bar" },
      ...PIPELINE_STAGES.map((st) =>
        h(
          "button",
          {
            type: "button",
            class: "filter-pill",
            disabled: !canEdit,
            "aria-pressed": String(item.stage === st.id),
            onClick: () => {
              if (!canEdit) return;
              movePipelineStage(item.id, st.id);
              showToast(`Moved to ${st.label}`, { tone: "info" });
            }
          },
          st.label
        )
      )
    ),
    h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${pct}%` } }))
  );

  const checklistSection = h(
    "section",
    { class: "card" },
    h("h2", { class: "card-title" }, "Production Checklist"),
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:0.4rem;" },
      ...item.checklist.map((chk) =>
        h(
          "label",
          { class: "checklist-item", dataset: { checked: String(chk.done) } },
          h("input", {
            type: "checkbox",
            checked: chk.done,
            disabled: !canEdit,
            onChange: () => toggleChecklistItem(item.id, chk.id)
          }),
          h("span", { style: "font-size:var(--text-sm);" }, chk.label)
        )
      )
    )
  );

  const repurposeSection = h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header" },
      h("h2", { class: "card-title" }, "Repurposing Matrix"),
      h("span", { class: "mono-meta" }, canEdit ? "Click status to advance" : "Read-only")
    ),
    h(
      "ul",
      { class: "feed-list" },
      ...item.repurposing.map((rep) => {
        const tone = rep.status === "Published" ? "ok" : rep.status === "In Progress" ? "info" : "warn";
        return h(
          "li",
          { class: "feed-row" },
          h(
            "div",
            { class: "feed-row-main" },
            h("strong", { style: "font-size:var(--text-sm);" }, rep.channel),
            h("span", { class: "mono-meta" }, rep.format)
          ),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--ghost btn--sm",
              disabled: !canEdit,
              "aria-label": `Cycle repurposing status for ${rep.channel}`,
              onClick: () => cycleRepurposeStatus(item.id, rep.id)
            },
            createStatusPill(rep.status, tone)
          )
        );
      })
    )
  );

  const affiliatesSection = h(
    "section",
    { class: "card" },
    h("h2", { class: "card-title" }, "Attached Affiliate /go Links"),
    attachedLinks.length
      ? h(
          "ul",
          { class: "feed-list" },
          ...attachedLinks.map((lnk) => {
            const shortUrl = `https://${workspace.shortDomain}/${lnk.slug}`;
            return h(
              "li",
              { class: "feed-row" },
              h(
                "div",
                { class: "feed-row-main" },
                h("span", { class: "mono", style: "font-size:var(--text-xs);font-weight:600;" }, `${workspace.shortDomain}/${lnk.slug}`),
                h("span", { class: "mono-meta truncate" }, lnk.destination)
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "btn btn--subtle btn--sm",
                  onClick: (e) => copyText(shortUrl, e.currentTarget, `Copied /${lnk.slug}`)
                },
                "Copy"
              )
            );
          })
        )
      : h("p", { class: "page-subtitle" }, "No /go links bound to this production yet.")
  );

  const footer = h(
    "div",
    { class: "dialog-footer" },
    h(
      "a",
      {
        href: `/studio?scenario=${item.scenario}`,
        class: "btn btn--subtle",
        onClick: () => dialog.close("studio")
      },
      "Open Workbench →"
    ),
    h(
      "button",
      {
        type: "button",
        class: "btn btn--primary",
        autofocus: true,
        onClick: () => dialog.close("done")
      },
      "Done"
    )
  );

  container.replaceChildren(
    header,
    ...(rbacNotice ? [rbacNotice] : []),
    stageSection,
    checklistSection,
    repurposeSection,
    affiliatesSection,
    footer
  );
}
