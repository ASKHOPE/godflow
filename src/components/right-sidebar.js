import { ROLES, SCENARIOS } from "../data/seed.js";
import { buildUserTreeOptgroups, buildWorkspaceScopeOptgroups } from "../lib/account-tree.js";
import { createScenarioBadge, createStatusPill, h } from "../lib/dom.js";
import { navigateTo } from "../lib/router.js";
import {
  addLiveChecklistItem,
  can,
  canAccessRoute,
  canEditScenario,
  discardSandboxWorkingCopy,
  drillIntoChannel,
  drillIntoTenant,
  getActiveContext,
  getLiveChecklist,
  getScopedUsersAndRoles,
  getState,
  getTenantSlice,
  removeLiveChecklistItem,
  returnToWaterfallLevel,
  signOutSession,
  stopImpersonating,
  switchChannel,
  switchRole,
  toggleLiveChecklistItem,
  switchUser,
  switchWorkspace,
  toggleCrossTenantView,
  toggleGodMode,
  toggleUltimateMode
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import { openChannelWebsiteModal, openSessionModal } from "./modal.js";

let rightPinned = false;
let rightHidden = false;
let activeRightTab = "session";

export function initRightSidebar() {
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;

    if (e.target.closest("#right-pin-btn")) {
      rightPinned = !rightPinned;
      rightHidden = false;
      syncRightSidebarState();
      return;
    }

    if (e.target.closest("#right-hide-btn")) {
      rightPinned = false;
      rightHidden = true;
      document.getElementById("right-rail")?.classList.remove("is-mobile-open");
      syncRightSidebarState();
      return;
    }

    if (e.target.closest("#topbar-right-toggle")) {
      if (window.matchMedia("(max-width: 960px)").matches) {
        const rr = document.getElementById("right-rail");
        const open = rr?.classList.toggle("is-mobile-open") ?? false;
        e.target.closest("#topbar-right-toggle")?.setAttribute("aria-expanded", String(open));
      } else {
        if (rightHidden) {
          rightHidden = false;
          rightPinned = true;
        } else {
          rightPinned = !rightPinned;
        }
        syncRightSidebarState();
      }
      return;
    }

    const collapsedTabBtn = e.target.closest("[data-right-quicktab]");
    if (collapsedTabBtn) {
      activeRightTab = collapsedTabBtn.dataset.rightQuicktab;
      rightHidden = false;
      rightPinned = true;
      syncRightSidebarState();
      renderRightSidebar();
    }
  });

  document.addEventListener("keydown", (e) => {
    const rr = document.getElementById("right-rail");
    if (e.key === "Escape" && rr?.classList.contains("is-mobile-open")) {
      rr.classList.remove("is-mobile-open");
      document.getElementById("topbar-right-toggle")?.setAttribute("aria-expanded", "false");
    }
  });
}

export function syncRightSidebarState() {
  const rr = document.getElementById("right-rail");
  const shell = document.querySelector(".app-shell");
  const pinBtn = document.getElementById("right-pin-btn");
  const topToggle = document.getElementById("topbar-right-toggle");

  rr?.classList.toggle("is-pinned", rightPinned && !rightHidden);
  rr?.classList.toggle("is-collapsed-off", rightHidden);
  shell?.classList.toggle("is-right-pinned", rightPinned && !rightHidden);
  shell?.classList.toggle("is-right-hidden", rightHidden);

  if (pinBtn) {
    pinBtn.setAttribute("aria-pressed", String(rightPinned && !rightHidden));
    pinBtn.setAttribute("aria-label", rightPinned ? "Unpin right context sidebar" : "Pin right context sidebar open");
  }
  if (topToggle) {
    topToggle.setAttribute("aria-pressed", String(rightPinned && !rightHidden));
  }
}

export function renderRightSidebar() {
  const container = document.getElementById("right-rail-body");
  if (!container) return;

  const snap = getState();
  const ctx = getActiveContext(snap);
  const slice = getTenantSlice(snap);
  const canAudit = ctx.isGodMode || can("tenant:admin", snap);
  const canFlows = ctx.role.id !== "guest_viewer" && ctx.role.scenarios.length > 0;

  const availableTabs = [
    { id: "session", label: "Session" },
    ...(canFlows ? [{ id: "flows", label: ctx.isGodMode || ctx.role.id === "tenant_admin" ? "6 Flows" : "My Flow" }] : []),
    ...(canAudit ? [{ id: "audit", label: "Audit" }] : [])
  ];

  if (!availableTabs.some((t) => t.id === activeRightTab)) {
    activeRightTab = "session";
  }

  const tabBar = h(
    "div",
    { class: "right-rail-tabs", role: "tablist", "aria-label": "Right sidebar panels", style: `grid-template-columns: repeat(${availableTabs.length}, 1fr);` },
    ...availableTabs.map((t) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          class: "right-rail-tab",
          "aria-selected": String(activeRightTab === t.id),
          onClick: () => {
            activeRightTab = t.id;
            renderRightSidebar();
          }
        },
        t.label
      )
    )
  );

  let panelNodes = [];

  if (activeRightTab === "session") {
    const canElevateMaster = ctx.realUser.defaultRoleId === "ultimate_master" || ctx.isUltimateMaster;
    const canElevateGod = !ctx.isMasterPlatformScope && ["god_mode", "ultimate_master"].includes(ctx.realUser.defaultRoleId);
    const canMaster = ctx.isPlatformOperator || ["ultimate_master", "ultimate_maintenance"].includes(ctx.realUser.defaultRoleId);
    const { scopedUsers, scopedRoles } = getScopedUsersAndRoles(snap);
    const allowedWsList = snap.workspaces.filter(
      (w) => ctx.isPlatformOperator || ctx.isGodMode || ctx.activeUser.workspaceIds.includes(w.id)
    );
    const wsSel = h(
      "select",
      {
        id: "rs-ws-select",
        class: "select",
        onChange: (e) => {
          if (e.target.value === "__platform__") {
            returnToWaterfallLevel("platform");
            navigateTo("command");
            showToast("Returned to Master Platform", { tone: "info" });
          } else {
            drillIntoTenant(e.target.value);
            showToast("Entered tenant workspace", { tone: "info" });
          }
        }
      },
      ...buildWorkspaceScopeOptgroups({
        snapshot: snap,
        workspaces: allowedWsList,
        includePlatform: canMaster,
        selectedValue: ctx.isMasterPlatformScope ? "__platform__" : ctx.workspace.id,
        platformLabel: "Master Platform (2 Accounts)"
      })
    );

    const chSel = h(
      "select",
      {
        id: "rs-ch-select",
        class: "select",
        disabled: ctx.isMasterPlatformScope || ctx.channels.length <= 1,
        onChange: (e) => {
          drillIntoChannel(e.target.value);
          showToast("Channel scope updated", { tone: "info" });
        }
      },
      ...(ctx.isMasterPlatformScope
        ? [h("option", { value: "all", selected: true }, "Enter a tenant to scope channels")]
        : [
            ...(ctx.channels.length > 1
              ? [h("option", { value: "all", selected: !ctx.activeChannel }, `All Channels (${ctx.channels.length})`)]
              : []),
            ...ctx.channels.map((c) => h("option", { value: c.id, selected: ctx.activeChannel?.id === c.id }, `${c.name} (${c.domain})`))
          ])
    );

    const usrSel = h(
      "select",
      {
        id: "rs-user-select",
        class: "select",
        disabled: scopedUsers.length <= 1,
        onChange: (e) => {
          switchUser(e.target.value);
          showToast("Session user switched", { tone: "info" });
        }
      },
      ...(!ctx.isUltimateMaster && !ctx.isUltimateMaintenance && !ctx.isGodMode && ctx.role.id !== "tenant_admin"
        ? [h("optgroup", { label: `Tenant: ${ctx.workspace.name}` }, h("option", { value: ctx.activeUser.id, selected: true }, `${ctx.activeUser.name} — ${ctx.activeUser.title}`))]
        : buildUserTreeOptgroups({
            snapshot: snap,
            scopeWsId: ctx.isMasterPlatformScope ? "__platform__" : ctx.workspace.id,
            selectedUserId: ctx.activeUser.id,
            compositeValue: false
          }))
    );

    const roleSel = h(
      "select",
      {
        id: "rs-role-select",
        class: "select",
        disabled: scopedRoles.length <= 1,
        onChange: (e) => {
          switchRole(e.target.value);
          showToast("Role switched", { tone: "info" });
        }
      },
      ...scopedRoles.map((r) => h("option", { value: r.id, selected: r.id === ctx.role.id }, r.name))
    );

    panelNodes = [
      h(
        "section",
        { class: "card", style: "padding:0.75rem;gap:0.55rem;" },
        h(
          "div",
          { class: "card-header" },
          h("span", { class: "mono-meta" }, ctx.isImpersonating ? "IMPERSONATING" : "ACTIVE SESSION"),
          createStatusPill(ctx.isUltimateMaster ? "ULTIMATE MASTER" : ctx.isGodMode ? "GOD MODE" : ctx.role.badge, ctx.isUltimateMaster ? "warn" : ctx.isGodMode ? "info" : ctx.role.tone)
        ),
        h(
          "div",
          { style: "display:flex;align-items:center;gap:0.55rem;" },
          h("span", { class: "creator-avatar", style: "margin:0;" }, ctx.activeUser.initials),
          h("div", { style: "min-inline-size:0;" }, h("div", { style: "font-size:var(--text-sm);font-weight:600;" }, ctx.activeUser.name), h("div", { class: "mono-meta truncate" }, ctx.activeUser.email))
        ),
        ctx.isImpersonating
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--primary btn--sm",
                onClick: () => {
                  stopImpersonating();
                  showToast("Restored primary owner session", { tone: "ok" });
                }
              },
              `Exit Impersonation (${ctx.realUser.name})`
            )
          : null,
        h(
          "div",
          { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
          h("button", { type: "button", class: "btn btn--subtle btn--sm", style: "flex:1;", onClick: () => openSessionModal() }, "Switch"),
          h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => signOutSession({ toPublicHomepage: true }) }, "Homepage"),
          h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => signOutSession({ toPublicHomepage: false }) }, "Lock")
        ),
        ctx.isSandbox
          ? h(
              "div",
              { style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.35rem;border-top:1px solid var(--border-subtle);" },
              createStatusPill(`SANDBOX COPY (${ctx.sandboxChangesCount} edits)`, "warn"),
              h(
                "div",
                { style: "display:flex;gap:0.35rem;" },
                canAccessRoute("emulate", snap)
                  ? h("a", { href: "/emulate", class: "btn btn--subtle btn--sm", style: "flex:1;" }, "Emulate Desk")
                  : null,
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--primary btn--sm",
                    onClick: () => {
                      discardSandboxWorkingCopy();
                      showToast("Exited Sandbox Working Copy — Production restored", { tone: "ok" });
                    }
                  },
                  "Exit Sandbox"
                )
              )
            )
          : null
      ),

      h(
        "section",
        { class: "card", style: "padding:0.75rem;gap:0.6rem;" },
        h("div", { class: "card-header" },
          h("span", { class: "mono-meta" }, "WATERFALL SCOPE"),
          createStatusPill(`L${ctx.waterfallLevel === "platform" ? 1 : ctx.waterfallLevel === "tenant" ? 2 : ctx.waterfallLevel === "channel" ? 3 : 4} · ${ctx.waterfallLevel.toUpperCase()}`, ctx.isMasterPlatformScope ? "warn" : "ok")
        ),
        canMaster && !ctx.isMasterPlatformScope
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => {
                  returnToWaterfallLevel("platform");
                  navigateTo("command");
                  showToast("Stepped up to Master Platform Root", { tone: "info" });
                }
              },
              "← Back to Master Platform"
            )
          : null,
        h("div", { class: "field" }, h("label", { class: "field-label", for: "rs-ws-select" }, "Tenant Workspace"), wsSel),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "rs-ch-select" }, "Channel Scope"), chSel),
        !ctx.isMasterPlatformScope && ctx.channels.length
          ? h(
              "div",
              { style: "display:flex;flex-wrap:wrap;gap:0.35rem;" },
              ...ctx.channels.map((ch) =>
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--ghost btn--sm",
                    onClick: () => openChannelWebsiteModal(ch.id)
                  },
                  `${ch.name} Site`
                )
              )
            )
          : null,
        h("div", { class: "field" }, h("label", { class: "field-label", for: "rs-user-select" }, "Impersonate / Switch User"), usrSel),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "rs-role-select" }, "RBAC Role Override"), roleSel)
      ),

      h(
        "section",
        { class: "card", style: "padding:0.75rem;gap:0.55rem;" },
        h(
          "div",
          { class: "card-header" },
          h("span", { class: "card-title", style: "font-size:var(--text-xs);" }, "RBAC Scope & Confidentiality"),
          h(
            "div",
            { style: "display:flex;gap:0.3rem;flex-wrap:wrap;" },
            canElevateMaster
              ? h(
                  "button",
                  {
                    type: "button",
                    class: `btn btn--sm ${ctx.isUltimateMaster ? "btn--primary" : "btn--subtle"}`,
                    "aria-pressed": String(ctx.isUltimateMaster),
                    onClick: () => {
                      toggleUltimateMode();
                      showToast(ctx.isUltimateMaster ? "Exited Ultimate Master" : "Activated Ultimate Master", { tone: "warn" });
                    }
                  },
                  ctx.isUltimateMaster ? "MASTER ON" : "Master"
                )
              : null,
            canElevateGod
              ? h(
                  "button",
                  {
                    type: "button",
                    class: `btn btn--sm ${ctx.isGodMode && !ctx.isUltimateMaster ? "btn--primary" : "btn--subtle"}`,
                    "aria-pressed": String(ctx.isGodMode),
                    onClick: () => {
                      toggleGodMode();
                      showToast(ctx.isGodMode ? "God Mode disabled" : "God Mode activated", { tone: "warn" });
                    }
                  },
                  ctx.isGodMode ? "GOD ON" : "God Mode"
                )
              : null
          )
        ),
        canAccessRoute("newlifecorp", snap)
          ? h("a", { href: "/newlifecorp", class: "btn btn--ghost btn--sm" }, "NewLifeCorp SaaS Site →")
          : null,
        ctx.isGodMode
          ? h(
              "label",
              { class: "checklist-item" },
              h("input", { type: "checkbox", checked: snap.session.crossTenantView, onChange: () => toggleCrossTenantView() }),
              h("span", { style: "font-size:var(--text-xs);" }, "Cross-Tenant Global Rollup")
            )
          : null,
        h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, ctx.role.summary),
        h("div", { class: "mono-meta" }, `Visible Routes (${ctx.role.allowedRoutes.length}): ${ctx.role.allowedRoutes.join(", ")}`),
        h("div", { class: "filter-bar" }, ...ctx.role.permissions.map((perm) => h("span", { class: "badge mono", style: "font-size:0.66rem;" }, perm)))
      )
    ];
  } else if (activeRightTab === "flows") {
    const visibleScenarios = SCENARIOS.filter((sc) => ctx.isGodMode || ctx.role.id === "tenant_admin" || ctx.role.scenarios.includes(sc.id));
    const liveChecklist = getLiveChecklist();
    const doneCount = liveChecklist.filter((i) => i.done).length;
    const allGo = liveChecklist.length > 0 && doneCount === liveChecklist.length;
    const newItemIn = h("input", {
      class: "input",
      type: "text",
      placeholder: "Add pre-live check...",
      "aria-label": "Add pre-live checklist item"
    });

    const checklistCard = h(
      "section",
      { class: "card", style: "padding:0.65rem 0.75rem;gap:0.45rem;" },
      h("div", { class: "card-header" },
        h("strong", { style: "font-size:var(--text-xs);" }, "Pre-Live Go / No-Go Checklist"),
        createStatusPill(allGo ? "ALL GO" : `${doneCount}/${liveChecklist.length} Ready`, allGo ? "ok" : "warn")
      ),
      h("ul", { class: "feed-list" },
        ...liveChecklist.map((it) =>
          h("li", { class: "feed-row", style: "padding:0.3rem 0.4rem;" },
            h("label", { style: "display:flex;align-items:center;gap:0.4rem;font-size:var(--text-xs);cursor:pointer;flex:1;" },
              h("input", {
                type: "checkbox",
                checked: Boolean(it.done),
                onChange: () => toggleLiveChecklistItem(it.id)
              }),
              h("span", { style: it.done ? "text-decoration:line-through;opacity:0.7;" : "" }, it.label)
            ),
            h("button", {
              type: "button",
              class: "btn btn--ghost btn--sm",
              "aria-label": `Remove ${it.label}`,
              onClick: () => removeLiveChecklistItem(it.id)
            }, "×")
          )
        )
      ),
      h("form", {
        style: "display:flex;gap:0.35rem;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!newItemIn.value.trim()) return;
          addLiveChecklistItem(newItemIn.value.trim());
          newItemIn.value = "";
        }
      },
        newItemIn,
        h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Add")
      )
    );

    panelNodes = [
      checklistCard,
      h(
        "div",
        { style: "display:flex;flex-direction:column;gap:0.5rem;" },
        h("span", { class: "mono-meta" }, `ISOLATED WORKFLOWS · ${ctx.workspace.name}`),
        ...visibleScenarios.map((sc) => {
          const count = slice.pipelineItems.filter((p) => p.scenario === sc.id).length;
          const lead = snap.users.find((u) => u.defaultRoleId === sc.leadRole);
          const watcher = slice.activeWatchers.find((w) => w.userId === lead?.id);
          const writable = canEditScenario(sc.id, snap);

          return h(
            "article",
            { class: "card", style: "padding:0.65rem 0.75rem;gap:0.35rem;" },
            h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:0.35rem;" }, createScenarioBadge(sc.id, SCENARIOS), createStatusPill(writable ? "Write" : "Read", writable ? "ok" : "warn")),
            h("strong", { style: "font-size:var(--text-xs);" }, sc.label),
            h("div", { class: "mono-meta" }, `Lead: ${lead?.name ?? "Unassigned"} · ${count} active${watcher ? ` · ${(watcher.todaySeconds / 3600).toFixed(1)}h` : ""}`),
            h(
              "div",
              { style: "display:flex;justify-content:space-between;align-items:center;" },
              canAccessRoute("studio", snap)
                ? h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => navigateTo("studio", { scenario: sc.id }) }, "Workbench")
                : null,
              h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => navigateTo("pipeline", { scenario: sc.id }) }, "Pipeline →")
            )
          );
        })
      )
    ];
  } else {
    const liveChecklist = getLiveChecklist();
    const doneCount = liveChecklist.filter((i) => i.done).length;
    const allGo = liveChecklist.length > 0 && doneCount === liveChecklist.length;
    const newItemIn = h("input", {
      class: "input",
      type: "text",
      placeholder: "Add pre-live check...",
      "aria-label": "Add pre-live checklist item"
    });

    const checklistCard = h(
      "section",
      { class: "card", style: "padding:0.65rem 0.75rem;gap:0.45rem;" },
      h("div", { class: "card-header" },
        h("strong", { style: "font-size:var(--text-xs);" }, "Pre-Live Go / No-Go Checklist"),
        createStatusPill(allGo ? "ALL GO" : `${doneCount}/${liveChecklist.length} Ready`, allGo ? "ok" : "warn")
      ),
      h("ul", { class: "feed-list" },
        ...liveChecklist.map((it) =>
          h("li", { class: "feed-row", style: "padding:0.3rem 0.4rem;" },
            h("label", { style: "display:flex;align-items:center;gap:0.4rem;font-size:var(--text-xs);cursor:pointer;flex:1;" },
              h("input", {
                type: "checkbox",
                checked: Boolean(it.done),
                onChange: () => toggleLiveChecklistItem(it.id)
              }),
              h("span", { style: it.done ? "text-decoration:line-through;opacity:0.7;" : "" }, it.label)
            ),
            h("button", {
              type: "button",
              class: "btn btn--ghost btn--sm",
              "aria-label": `Remove ${it.label}`,
              onClick: () => removeLiveChecklistItem(it.id)
            }, "×")
          )
        )
      ),
      h("form", {
        style: "display:flex;gap:0.35rem;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!newItemIn.value.trim()) return;
          addLiveChecklistItem(newItemIn.value.trim());
          newItemIn.value = "";
        }
      },
        newItemIn,
        h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Add")
      )
    );

    panelNodes = [
      checklistCard,
      h(
        "div",
        { style: "display:flex;flex-direction:column;gap:0.5rem;" },
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;" }, h("span", { class: "mono-meta" }, "RBAC & TENANT AUDIT"), h("a", { href: "/admin", class: "btn btn--ghost btn--sm" }, "Admin →")),
        h(
          "ul",
          { class: "feed-list" },
          ...(snap.auditLog ?? []).slice(0, 12).map((evt) =>
            h(
              "li",
              { class: "feed-row", style: "flex-direction:column;align-items:flex-start;gap:0.2rem;" },
              h("div", { style: "display:flex;justify-content:space-between;inline-size:100%;" }, h("span", { class: "mono-meta" }, `${evt.time} · ${evt.actor}`), createStatusPill(evt.role, evt.tone)),
              h("span", { style: "font-size:var(--text-xs);" }, evt.action)
            )
          )
        )
      )
    ];
  }

  container.replaceChildren(tabBar, ...panelNodes);
}
