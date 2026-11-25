import { initDrawer, refreshDrawerIfOpen } from "./components/drawer.js";
import { renderLoginGate } from "./components/login-gate.js";
import { initModal, openQuickCaptureModal, openSessionModal } from "./components/modal.js";
import { initRightSidebar, renderRightSidebar, syncRightSidebarState } from "./components/right-sidebar.js";
import {
  initSidebar,
  syncRailPinState,
  syncSidebarActiveRoute,
  syncSidebarBadges
} from "./components/sidebar.js";
import { ROLES } from "./data/seed.js";
import { buildUserTreeOptgroups, buildWorkspaceScopeOptgroups } from "./lib/account-tree.js";
import { createStatusPill, h } from "./lib/dom.js";
import { navigateTo, parseRouteFromLocation } from "./lib/router.js";
import {
  can,
  canAccessRoute,
  commitSandboxToProduction,
  discardSandboxWorkingCopy,
  drillIntoTenant,
  getActiveContext,
  getScopedUsersAndRoles,
  getState,
  hydrateStateFromSqlite,
  resetSandboxWorkingCopy,
  returnToWaterfallLevel,
  signOutSession,
  stopImpersonating,
  subscribe,
  switchChannel,
  switchRole,
  switchUser,
  switchWorkspace,
  tickActiveWatchers,
  toggleCrossTenantView
} from "./lib/store.js";
import { initThemeController, syncThemeControls } from "./lib/theme.js";
import { showToast } from "./lib/toast.js";
import { renderAdmin } from "./views/admin.js";
import { renderAffiliates } from "./views/affiliates.js";
import { renderMegaCalendar, updateCalendarLiveTimers } from "./views/calendar.js";
import { renderCommandCenter } from "./views/command-center.js";
import { renderContentHub } from "./views/content-hub.js";
import { renderDistribution } from "./views/distribution.js";
import { renderEmulate } from "./views/emulate.js";
import { renderFinance } from "./views/finance.js";
import { renderPipeline } from "./views/pipeline.js";
import { renderSponsors } from "./views/sponsors.js";
import { renderStudio } from "./views/studio.js";
import { renderSubscriptions } from "./views/subscriptions.js";
import { renderSuite } from "./views/suite.js";
import { renderSystemHealth } from "./views/system-health.js";
import { renderTeam } from "./views/team.js";
import { renderNewLifeCorpPage, renderRegisterPage } from "./views/newlifecorp.js";

const VIEW_RENDERERS = {
  command: renderCommandCenter,
  subscriptions: renderSubscriptions,
  suite: renderSuite,
  emulate: renderEmulate,
  studio: renderStudio,
  calendar: renderMegaCalendar,
  pipeline: renderPipeline,
  hub: renderContentHub,
  distribution: renderDistribution,
  affiliates: renderAffiliates,
  sponsors: renderSponsors,
  finance: renderFinance,
  team: renderTeam,
  admin: renderAdmin,
  system: renderSystemHealth,
  newlifecorp: () => renderNewLifeCorpPage({ publicMode: false }),
  register: () => renderRegisterPage({ publicMode: false })
};

function renderConfidentialBlockedView(route, meta, ctx) {
  if (ctx.isMasterPlatformScope) {
    return [
      h(
        "section",
        { class: "card", style: "max-inline-size:680px;margin-block:1rem;" },
        h(
          "div",
          { class: "card-header" },
          h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, `${meta.title} — Select a Registered Tenant First`),
          createStatusPill("WATERFALL LEVEL 1 · PLATFORM", "warn")
        ),
        h(
          "p",
          { class: "page-subtitle" },
          `You are currently at Ultimate Master Platform scope. To prevent cluttering platform governance with studio controls, enter a registered company tenant first to unlock ${meta.title}.`
        ),
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;gap:0.5rem;padding-top:0.25rem;" },
          h("a", { href: "/", class: "btn btn--primary" }, "Open Registered Tenants →"),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle",
              onClick: () => {
                drillIntoTenant(ctx.workspace.id);
                showToast(`Entered Tenant Level 2: ${ctx.workspace.name}`, { tone: "ok" });
              }
            },
            `Quick Enter ${ctx.workspace.name}`
          )
        )
      )
    ];
  }

  return [
    h(
      "section",
      { class: "card", style: "max-inline-size:680px;margin-block:1rem;" },
      h(
        "div",
        { class: "card-header" },
        h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, `${meta.title} — Confidential / RBAC Isolated`),
        createStatusPill(ctx.role.badge, "warn")
      ),
      h(
        "p",
        { class: "page-subtitle" },
        `Active session "${ctx.activeUser.name}" (${ctx.role.name}) does not have clearance to view ${meta.title} or its confidential project records.`
      ),
      h(
        "p",
        { class: "mono-meta" },
        `Allowed routes for ${ctx.role.id}: ${ctx.role.allowedRoutes.join(", ")}`
      ),
      h(
        "div",
        { style: "display:flex;flex-wrap:wrap;gap:0.5rem;padding-top:0.25rem;" },
        h("a", { href: "/", class: "btn btn--primary" }, "Return to Authorized Home"),
        ctx.isImpersonating
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--subtle",
                onClick: () => {
                  stopImpersonating();
                  showToast(`Exited impersonation back to ${ctx.realUser.name}`, { tone: "ok" });
                }
              },
              `Exit Impersonation (${ctx.realUser.name})`
            )
          : null
      )
    )
  ];
}

function renderWaterfallBreadcrumb(snap, ctx) {
  const wfBar = document.getElementById("waterfall-breadcrumb");
  if (!wfBar) return;

  const isMasterSession =
    ctx.isPlatformOperator || ["ultimate_master", "ultimate_maintenance"].includes(ctx.realUser.defaultRoleId);
  if (!isMasterSession && !ctx.isImpersonating && !ctx.channelScoped) {
    wfBar.hidden = true;
    wfBar.replaceChildren();
    return;
  }

  if (!isMasterSession && !ctx.isPlatformOperator) {
    wfBar.hidden = true;
    wfBar.style.display = "none";
    wfBar.replaceChildren();
    return;
  }
  wfBar.hidden = false;
  wfBar.style.display = "";
  const items = [];

  if (isMasterSession) {
    const atPlatform = ctx.isMasterPlatformScope;
    items.push(
      h(
        "li",
        {},
        h(
          "a",
          {
            href: "/",
            class: "wf-breadcrumb-link",
            "aria-current": atPlatform ? "page" : undefined,
            onClick: (e) => {
              e.preventDefault();
              returnToWaterfallLevel("platform");
              navigateTo("command");
              showToast("Waterfall Level 1: Platform Master (All Tenants)", { tone: "info" });
            }
          },
          "1. Master Platform (NewLifeCorp)"
        )
      )
    );
  }

  if (!ctx.isMasterPlatformScope) {
    const atTenant = !ctx.activeChannel && !ctx.isImpersonating;
    items.push(
      h(
        "li",
        {},
        h(
          "a",
          {
            href: "/",
            class: "wf-breadcrumb-link",
            "aria-current": atTenant ? "page" : undefined,
            onClick: (e) => {
              e.preventDefault();
              if (ctx.isImpersonating || ctx.activeChannel) {
                returnToWaterfallLevel("tenant");
                navigateTo("command");
                showToast(`Waterfall Level 2: Tenant (${ctx.workspace.name})`, { tone: "info" });
              }
            }
          },
          `2. Tenant: ${ctx.workspace.name}`
        )
      )
    );
  }

  if (ctx.activeChannel && !ctx.isMasterPlatformScope) {
    const atChannel = !ctx.isImpersonating;
    items.push(
      h(
        "li",
        {},
        h(
          "a",
          {
            href: "/",
            class: "wf-breadcrumb-link",
            "aria-current": atChannel ? "page" : undefined,
            onClick: (e) => {
              e.preventDefault();
              if (ctx.isImpersonating) {
                returnToWaterfallLevel("channel");
                showToast(`Waterfall Level 3: Channel (${ctx.activeChannel.name})`, { tone: "info" });
              }
            }
          },
          `3. Channel: ${ctx.activeChannel.name} (${ctx.activeChannel.domain})`
        )
      )
    );
  }

  if (ctx.isImpersonating) {
    items.push(
      h(
        "li",
        {},
        h(
          "a",
          {
            href: "/",
            class: "wf-breadcrumb-link",
            "aria-current": "page",
            onClick: (e) => e.preventDefault()
          },
          `4. User: ${ctx.activeUser.name} (${ctx.role.badge})`
        )
      )
    );
  }

  wfBar.replaceChildren(
    h(
      "nav",
      { class: "wf-breadcrumb-nav", "aria-label": "Waterfall access breadcrumb" },
      h("ol", { class: "wf-breadcrumb-ol" }, ...items)
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;" },
      ctx.isMasterPlatformScope
        ? h("span", { class: "mono-meta" }, "Showing Platform & Registered Tenants Only")
        : isMasterSession
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => {
                  returnToWaterfallLevel("platform");
                  navigateTo("command");
                  showToast("Returned to Master Platform Root", { tone: "ok" });
                }
              },
              "← Back to Master Platform"
            )
          : null,
      ctx.isImpersonating
        ? h(
            "button",
            {
              type: "button",
              class: "btn btn--primary btn--sm",
              onClick: () => {
                returnToWaterfallLevel(isMasterSession ? "tenant" : "channel");
                showToast(`Returned to Tenant level (${ctx.workspace.name})`, { tone: "ok" });
              }
            },
            "← Up to Tenant"
          )
        : null
    )
  );
}

function syncTopbarSwitchers(snap) {
  const ctx = getActiveContext(snap);

  const isOperator =
    ctx.isPlatformOperator ||
    ["ultimate_master", "ultimate_maintenance"].includes(ctx.realUser?.defaultRoleId);

  const wsSel = document.getElementById("top-ws-select");
  if (wsSel) {
    if (wsSel.parentElement) wsSel.parentElement.style.display = isOperator ? "" : "none";
    const canMasterRoot =
      ctx.isPlatformOperator || ["ultimate_master", "ultimate_maintenance"].includes(ctx.realUser.defaultRoleId);
    const allowedWorkspaces = snap.workspaces.filter(
      (x) => ctx.isPlatformOperator || ctx.isGodMode || ctx.activeUser.workspaceIds.includes(x.id)
    );
    wsSel.replaceChildren(
      ...buildWorkspaceScopeOptgroups({
        snapshot: snap,
        workspaces: allowedWorkspaces,
        includePlatform: canMasterRoot,
        selectedValue: ctx.isMasterPlatformScope ? "__platform__" : ctx.workspace.id,
        platformLabel: "Master Platform (2 Accounts)"
      })
    );
  }

  const chSel = document.getElementById("top-channel-select");
  if (chSel) {
    const showCh = isOperator || (!ctx.isMasterPlatformScope && ctx.channels.length > 1);
    if (chSel.parentElement) chSel.parentElement.style.display = showCh ? "" : "none";
    if (ctx.isMasterPlatformScope) {
      chSel.replaceChildren(h("option", { value: "all", selected: true }, "Enter tenant first"));
      chSel.disabled = true;
    } else {
      const chOpts = [];
      if (ctx.channels.length > 1) {
        chOpts.push(
          h("option", { value: "all", selected: !ctx.activeChannel }, `All Channels (${ctx.channels.length})`)
        );
      }
      for (const ch of ctx.channels) {
        chOpts.push(
          h("option", { value: ch.id, selected: ctx.activeChannel?.id === ch.id }, `${ch.name} (${ch.domain})`)
        );
      }
      chSel.replaceChildren(...chOpts);
      chSel.disabled = false;
    }
  }

  const { scopedUsers, scopedRoles } = getScopedUsersAndRoles(snap);

  const usrSel = document.getElementById("top-user-select");
  if (usrSel) {
    if (usrSel.parentElement) usrSel.parentElement.style.display = isOperator ? "" : "none";
    usrSel.replaceChildren(
      ...buildUserTreeOptgroups({
        snapshot: snap,
        scopeWsId: ctx.isMasterPlatformScope ? "__platform__" : ctx.workspace.id,
        selectedUserId: ctx.activeUser.id,
        compositeValue: false
      })
    );
    usrSel.disabled = false;
  }

  const roleSel = document.getElementById("top-role-select");
  if (roleSel) {
    const showRole = isOperator || scopedRoles.length > 1;
    if (roleSel.parentElement) roleSel.parentElement.style.display = showRole ? "" : "none";
    roleSel.replaceChildren(
      ...scopedRoles.map((r) => h("option", { value: r.id, selected: r.id === ctx.role.id }, r.badge))
    );
    roleSel.disabled = scopedRoles.length <= 1;
  }

  const topLoginBtn = document.getElementById("top-login-btn");
  const topProfilePill = document.getElementById("top-profile-pill");
  const topLogoutBtn = document.getElementById("top-logout-btn");
  const isAuthed = Boolean(snap.session?.authenticated);
  if (topLoginBtn) topLoginBtn.style.display = isAuthed ? "none" : "";
  if (topProfilePill) {
    topProfilePill.style.display = isAuthed ? "inline-flex" : "none";
    if (isAuthed) topProfilePill.textContent = `${ctx.activeUser.initials || "U"} · ${ctx.activeUser.name}`;
  }
  if (topLogoutBtn) {
    topLogoutBtn.style.display = isAuthed ? "" : "none";
    if (!topLogoutBtn.dataset.boundLogout) {
      topLogoutBtn.dataset.boundLogout = "1";
      topLogoutBtn.addEventListener("click", () => {
        signOutSession({ toPublicHomepage: true });
        showToast("Signed out", { tone: "info" });
      });
    }
  }

  const quickCaptureBtn = document.getElementById("quick-capture-jump");
  if (quickCaptureBtn) {
    quickCaptureBtn.hidden = ctx.isMasterPlatformScope || !can("pipeline:write", snap);
  }

  const banner = document.getElementById("god-banner");
  if (banner) {
    if (ctx.isSandbox || ctx.isPlatformOperator || ctx.isGodMode || ctx.isImpersonating || !ctx.tenantScoped) {
      banner.hidden = false;
      banner.replaceChildren(
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;" },
          ctx.isSandbox ? createStatusPill(`SANDBOX WORKING COPY · ${ctx.sandboxChangesCount} EDITS`, "warn") : null,
          createStatusPill(
            ctx.isImpersonating
              ? "IMPERSONATING (RBAC ISOLATED)"
              : ctx.isUltimateMaster
                ? "ULTIMATE MASTER (NEWLIFECORP)"
                : ctx.isUltimateMaintenance
                  ? "ULTIMATE MAINTENANCE (SRE · PLUGINS)"
                  : "GOD MODE",
            ctx.isImpersonating || ctx.isUltimateMaster ? "warn" : "info"
          ),
          h(
            "span",
            {},
            ctx.isMasterPlatformScope
              ? `${ctx.role.badge} · ${snap.workspaces.length} Registered Tenants · Platform Users: 2 (Master & Maintenance)`
              : `Tenant: ${ctx.workspace.name} · Channel: ${ctx.activeChannel ? ctx.activeChannel.name : `All (${ctx.channels.length})`} · User: ${ctx.activeUser.name} · Role: ${ctx.role.name} · ${ctx.tenantScoped ? "Confidentiality Enforced" : "Global Cross-Tenant Rollup"}`
          )
        ),
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;gap:0.4rem;" },
          ctx.isSandbox
            ? [
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => {
                      resetSandboxWorkingCopy();
                      showToast("Reset Sandbox Working Copy to clean Production snapshot", { tone: "info" });
                    }
                  },
                  "Reset Copy"
                ),
                can("sandbox:commit", snap)
                  ? h(
                      "button",
                      {
                        type: "button",
                        class: "btn btn--subtle btn--sm",
                        onClick: () => {
                          commitSandboxToProduction();
                          showToast("Promoted Sandbox changes into Production", { tone: "ok" });
                        }
                      },
                      "Commit to Prod"
                    )
                  : null,
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--primary btn--sm",
                    onClick: () => {
                      discardSandboxWorkingCopy();
                      showToast("Exited Sandbox — Production restored untouched", { tone: "ok" });
                    }
                  },
                  "Discard & Exit Sandbox"
                )
              ]
            : null,
          ctx.isGodMode && !ctx.isMasterPlatformScope
            ? h(
                "button",
                { type: "button", class: "btn btn--subtle btn--sm", onClick: () => toggleCrossTenantView() },
                ctx.tenantScoped ? "View All Tenants" : "Scope to Active Tenant"
              )
            : null,
          ctx.isImpersonating && !ctx.isSandbox
            ? h(
                "button",
                { type: "button", class: "btn btn--primary btn--sm", onClick: () => stopImpersonating() },
                `Exit Impersonation (${ctx.realUser.name})`
              )
            : null,
          canAccessRoute("suite", snap) ? h("a", { href: "/suite", class: "btn btn--ghost btn--sm" }, "Suite →") : null,
          canAccessRoute("emulate", snap) ? h("a", { href: "/emulate", class: "btn btn--ghost btn--sm" }, "Emulate →") : null
        )
      );
    } else {
      banner.hidden = true;
      banner.replaceChildren();
    }
  }
}

function syncAuthShellAndRender({ fromNavigation = false } = {}) {
  const snap = getState();
  const appShell = document.getElementById("app-shell");
  const loginRoot = document.getElementById("login-gate-root");
  const publicRoot = document.getElementById("public-site-root");
  const { route, meta } = parseRouteFromLocation();

  if (!snap.session.authenticated) {
    if (appShell) appShell.hidden = true;
    const isRegisterRoute = route === "register";
    const showPublicPortal = isRegisterRoute || route === "newlifecorp" || snap.session.authView !== "login";
    document.documentElement.dataset.godflowAuth = showPublicPortal ? "public" : "login";

    if (showPublicPortal && publicRoot) {
      if (loginRoot) loginRoot.hidden = true;
      publicRoot.hidden = false;
      publicRoot.replaceChildren(
        isRegisterRoute ? renderRegisterPage({ publicMode: true }) : renderNewLifeCorpPage({ publicMode: true })
      );
      document.title = isRegisterRoute
        ? "Register Company & Configure Suite — NewLifeCorp"
        : "NewLifeCorp — Ultimate Multi-Tenant Creator Cloud";
      return;
    }
    if (publicRoot) publicRoot.hidden = true;
    if (loginRoot) {
      loginRoot.hidden = false;
      renderLoginGate();
    }
    return;
  }

  document.documentElement.dataset.godflowAuth = "app";
  if (loginRoot) loginRoot.hidden = true;
  if (publicRoot) publicRoot.hidden = true;
  if (appShell) appShell.hidden = false;

  const main = document.getElementById("workspace-main");
  if (!main) return;

  const ctx = getActiveContext(snap);
  syncSidebarActiveRoute(route, meta.title);
  syncSidebarBadges(snap);
  syncTopbarSwitchers(snap);
  renderWaterfallBreadcrumb(snap, ctx);
  renderRightSidebar();

  if (!canAccessRoute(route, snap)) {
    main.replaceChildren(...renderConfidentialBlockedView(route, meta, ctx));
    return;
  }

  const renderer = VIEW_RENDERERS[route] ?? renderCommandCenter;
  const nodes = renderer(fromNavigation);
  main.replaceChildren(...(Array.isArray(nodes) ? nodes : [nodes]));
}

function bootstrapOnce() {
  if (window.__GODFLOW_BOOTED__) return;
  window.__GODFLOW_BOOTED__ = true;

  initThemeController();
  initSidebar();
  initRightSidebar();
  initDrawer();
  initModal();

  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest("#quick-capture-jump")) {
      openQuickCaptureModal();
    } else if (e.target.closest("#top-homepage-btn")) {
      signOutSession({ toPublicHomepage: true });
      navigateTo("command");
      showToast("Returned to Public NewLifeCorp Homepage", { tone: "info" });
    } else if (e.target.closest("#top-login-btn") || e.target.closest("#rail-session-btn")) {
      openSessionModal();
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (t.id === "top-ws-select") {
      if (t.value === "__platform__") {
        returnToWaterfallLevel("platform");
        navigateTo("command");
        showToast("Returned to Master Platform (Registered Tenants)", { tone: "info" });
      } else {
        drillIntoTenant(t.value);
        showToast("Entered tenant workspace (Waterfall Level 2)", { tone: "info" });
      }
    } else if (t.id === "top-channel-select") {
      switchChannel(t.value);
      showToast("Switched active channel", { tone: "info" });
    } else if (t.id === "top-user-select") {
      switchUser(t.value);
      showToast("Switched active user", { tone: "info" });
    } else if (t.id === "top-role-select") {
      switchRole(t.value);
      showToast("Switched active RBAC role", { tone: "info" });
    }
  });

  window.addEventListener("godflow:rerender", () => {
    syncAuthShellAndRender({ fromNavigation: false });
  });

  subscribe((snapshot) => {
    syncSidebarBadges(snapshot);
    refreshDrawerIfOpen();
    syncAuthShellAndRender({ fromNavigation: false });
  });

  document.addEventListener("astro:after-swap", () => {
    syncRailPinState();
    syncRightSidebarState();
  });

  document.addEventListener("astro:page-load", () => {
    syncRailPinState();
    syncRightSidebarState();
    syncThemeControls();
    syncAuthShellAndRender({ fromNavigation: true });
  });

  setInterval(() => {
    if (tickActiveWatchers()) {
      updateCalendarLiveTimers();
    }
  }, 1000);
}

bootstrapOnce();
syncRailPinState();
syncRightSidebarState();
syncAuthShellAndRender({ fromNavigation: true });
void hydrateStateFromSqlite();
