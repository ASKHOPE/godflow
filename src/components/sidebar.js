import { canAccessRoute, canAccessTool, getActiveContext, getDerivedMetrics, getTenantSlice } from "../lib/store.js";

let leftPinned = false;

export function initSidebar() {
  const getRail = () => document.getElementById("nav-rail");
  const getMobileBtn = () => document.getElementById("mobile-menu-btn");

  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;

    if (e.target.closest("#rail-pin-btn")) {
      leftPinned = !leftPinned;
      syncRailPinState();
      return;
    }

    if (e.target.closest("#mobile-menu-btn")) {
      const rail = getRail();
      const mobileBtn = getMobileBtn();
      const isOpen = rail?.classList.toggle("is-mobile-open") ?? false;
      mobileBtn?.setAttribute("aria-expanded", String(isOpen));
      return;
    }

    if (e.target.closest("#nav-rail a.rail-item")) {
      const rail = getRail();
      if (rail?.classList.contains("is-mobile-open")) {
        rail.classList.remove("is-mobile-open");
        getMobileBtn()?.setAttribute("aria-expanded", "false");
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    const rail = getRail();
    if (e.key === "Escape" && rail?.classList.contains("is-mobile-open")) {
      rail.classList.remove("is-mobile-open");
      const mobileBtn = getMobileBtn();
      mobileBtn?.setAttribute("aria-expanded", "false");
      mobileBtn?.focus();
    }
  });
}

export function syncRailPinState() {
  const rail = document.getElementById("nav-rail");
  const shell = document.querySelector(".app-shell");
  const pinBtn = document.getElementById("rail-pin-btn");
  rail?.classList.toggle("is-pinned", leftPinned);
  shell?.classList.toggle("is-rail-pinned", leftPinned);
  if (pinBtn) {
    pinBtn.setAttribute("aria-pressed", String(leftPinned));
    pinBtn.setAttribute(
      "aria-label",
      leftPinned ? "Unpin left navigation rail" : "Pin left navigation rail open"
    );
  }
}

export function syncSidebarActiveRoute(routeId, title) {
  const scParam = routeId === "studio" ? new URLSearchParams(window.location.search).get("scenario") : null;
  let highlightedStudio = false;
  for (const link of document.querySelectorAll(".rail-item[data-route]")) {
    const linkSc = link.dataset.studioScenario;
    if (linkSc) {
      const match = routeId === "studio" && (scParam ? linkSc === scParam : !highlightedStudio && !link.closest("li")?.hidden);
      if (match) {
        highlightedStudio = true;
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
      continue;
    }
    if (link.dataset.route === routeId) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
  const crumb = document.getElementById("topbar-module-name");
  if (crumb) crumb.textContent = title;
  document.title = `${title} | GodFlow OS`;
}

export function syncSidebarBadges(snapshot) {
  const slice = getTenantSlice(snapshot);
  const metrics = getDerivedMetrics(snapshot);
  const { workspace, activeChannel, activeUser, role, isUltimateMaster, isGodMode, isMasterPlatformScope, isSandbox } = getActiveContext(snapshot);

  const homeLabel = document.getElementById("rail-home-label");
  if (homeLabel) {
    homeLabel.textContent = isMasterPlatformScope ? "Platform Home" : "Command Center";
  }

  const tenantsBadge = document.getElementById("badge-tenants-count");
  if (tenantsBadge) tenantsBadge.textContent = String(snapshot.workspaces.length);

  const suiteBadge = document.getElementById("badge-suite-track");
  if (suiteBadge) {
    const mods = snapshot.platformData?.suiteModules ?? [];
    const expCount = mods.filter((m) => workspace?.suiteSubscriptions?.[m.id]?.track === "experimental").length;
    suiteBadge.textContent = expCount > 0 ? `${expCount} EXP` : "3 VER";
    suiteBadge.className = `rail-badge ${expCount > 0 ? "rail-badge--warn" : "rail-badge--god"}`;
  }

  const sandboxBadge = document.getElementById("badge-sandbox-state");
  if (sandboxBadge) {
    sandboxBadge.textContent = isSandbox ? "SANDBOX" : "PROD";
    sandboxBadge.className = `rail-badge ${isSandbox ? "rail-badge--warn" : ""}`;
  }

  // Strict RBAC & Waterfall menu isolation: hide unauthorized/out-of-scope routes, creator editors, and empty groups
  const { role: activeRole, isGodMode: activeGodMode, workspace: activeWs } = getActiveContext(snapshot);
  const wsScenarios = activeWs?.activeScenarios ?? [];
  const canSeeAllStudios = activeGodMode || activeRole.id === "tenant_admin" || (activeRole.scenarios?.length ?? 0) > 1;
  for (const link of document.querySelectorAll(".rail-item[data-route]")) {
    const li = link.closest("li");
    if (!li) continue;
    const routeAllowed = canAccessRoute(link.dataset.route, snapshot);
    if (!routeAllowed) {
      li.hidden = true;
      continue;
    }
    const scId = link.dataset.studioScenario;
    if (link.dataset.platformOnly === "true") {
      const { isPlatformOperator } = getActiveContext(snapshot);
      li.hidden = !isPlatformOperator;
    } else if (scId) {
      const enabledInTenant = !wsScenarios.length || wsScenarios.includes(scId);
      const roleAllowed = activeGodMode || activeRole.id === "tenant_admin" || canAccessTool(`studio:${scId}`, snapshot);
      li.hidden = !(enabledInTenant && roleAllowed);
    } else if (link.dataset.studioAll === "true") {
      li.hidden = !canSeeAllStudios;
    } else {
      li.hidden = false;
    }
  }
  for (const grp of document.querySelectorAll(".rail-group")) {
    const hasVisible = [...grp.querySelectorAll("li")].some((li) => !li.hidden);
    grp.hidden = !hasVisible;
    grp.style.display = hasVisible ? "" : "none";
  }
  for (const group of document.querySelectorAll(".rail-group")) {
    const items = [...group.querySelectorAll("li")];
    group.hidden = items.length > 0 && items.every((li) => li.hidden);
  }

  const pipeBadge = document.getElementById("badge-pipeline");
  if (pipeBadge) pipeBadge.textContent = String(slice.pipelineItems.length);

  const jobsBadge = document.getElementById("badge-failed-jobs");
  if (jobsBadge) {
    jobsBadge.textContent = String(metrics.failedJobCount);
    jobsBadge.classList.toggle("rail-badge--warn", metrics.failedJobCount > 0);
  }

  const teamBadge = document.getElementById("badge-team-count");
  if (teamBadge) teamBadge.textContent = String(slice.teamMembers.length);

  const godBadge = document.getElementById("badge-god-state");
  if (godBadge) {
    godBadge.textContent = isUltimateMaster ? "MASTER" : isGodMode ? "GOD" : role.tier.toUpperCase();
    godBadge.className = `rail-badge ${isUltimateMaster || isGodMode ? "rail-badge--god" : ""}`;
  }

  const watcherBadge = document.getElementById("badge-active-watchers");
  if (watcherBadge) {
    const activeCount = slice.activeWatchers.filter((w) => w.running).length;
    watcherBadge.textContent = snapshot.watcherConfig?.enabled ? `${activeCount} LIVE` : "PAUSED";
  }

  const brandTag = document.getElementById("rail-workspace-tag");
  if (brandTag) brandTag.textContent = isMasterPlatformScope ? "newlifecorp.io" : activeChannel ? activeChannel.domain : workspace.domain;

  const avatar = document.getElementById("rail-user-avatar");
  if (avatar) avatar.textContent = activeUser.initials;

  const userName = document.getElementById("rail-user-name");
  if (userName) userName.textContent = activeUser.name;

  const userRole = document.getElementById("rail-user-role");
  if (userRole) userRole.textContent = `${role.badge} · ${isMasterPlatformScope ? "platform" : activeChannel ? activeChannel.slug : workspace.slug}`;

  const crumbRoot = document.getElementById("topbar-tenant-domain");
  if (crumbRoot) {
    crumbRoot.textContent = isMasterPlatformScope
      ? "NewLifeCorp · Master Platform"
      : activeChannel
        ? `${workspace.domain} / ${activeChannel.name}`
        : workspace.domain;
  }

  const infraPill = document.getElementById("topbar-infra-pill");
  if (infraPill) {
    infraPill.hidden = !canAccessRoute("system", snapshot);
    infraPill.className = `status-pill ${metrics.failedJobCount > 0 ? "status-pill--warn" : "status-pill--ok"}`;
    const labelSpan = infraPill.querySelector("span:last-child");
    if (labelSpan) {
      labelSpan.textContent =
        metrics.failedJobCount > 0
          ? `BullMQ: ${metrics.failedJobCount} Failed`
          : "ETAPI + BullMQ Live";
    }
  }
}
