import { openChannelWebsiteModal, openNewChannelModal, openNewWorkspaceModal, openSessionModal } from "../components/modal.js";
import { createStatusPill, formatCurrency, formatNumber, h } from "../lib/dom.js";
import { navigateTo } from "../lib/router.js";
import {
  can,
  convertLeadToTenant,
  drillIntoChannel,
  drillIntoTenant,
  drillIntoUser,
  getActiveContext,
  getState,
  getTenantTeams,
  loginSession,
  returnToWaterfallLevel,
  stopImpersonating,
  switchChannel,
  switchUser,
  switchWorkspace,
  toggleCrossTenantView,
  toggleGodMode,
  toggleTenantFlag,
  toggleUltimateMode,
  toggleWorkspaceSuspended,
  updateTenantCommercials
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

export function renderAdmin() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const canTenantAdmin = can("tenant:admin", snap);
  const canPlugins = can("plugins:write", snap);
  const isMaster = ctx.isUltimateMaster;
  const isMaint = ctx.isUltimateMaintenance;
  const pd = snap.platformData;

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Ultimate Master & Multi-Tenancy Console"),
      h("p", { class: "page-subtitle" }, "NewLifeCorp Supreme Platform Governance · SaaS billing, tenant onboarding, PostgreSQL RLS, and impersonation above all")
    ),
    h(
      "div",
      { class: "page-actions" },
      ctx.realUser.defaultRoleId === "ultimate_master" || isMaster
        ? h(
            "button",
            {
              type: "button",
              class: `btn ${isMaster ? "btn--primary" : "btn--subtle"}`,
              "aria-pressed": String(isMaster),
              onClick: () => {
                toggleUltimateMode();
                showToast(isMaster ? "Exited Ultimate Master elevation" : "Ultimate Master Mode ACTIVE — supreme platform control", { tone: "warn" });
              }
            },
            isMaster ? "Ultimate Master: ACTIVE" : "Elevate to Ultimate Master"
          )
        : h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle",
              onClick: () => {
                loginSession({ userId: "usr-master", workspaceId: ctx.workspace.id, roleId: "ultimate_master" });
                showToast("Signed in as Julian Vance (Ultimate Master · NewLifeCorp)", { tone: "warn" });
              }
            },
            "Sign In as Ultimate Master"
          ),
      h(
        "button",
        {
          type: "button",
          class: `btn ${ctx.isGodMode && !isMaster ? "btn--primary" : "btn--subtle"}`,
          "aria-pressed": String(ctx.isGodMode),
          onClick: () => {
            toggleGodMode();
            showToast(ctx.isGodMode ? "God Mode disabled" : "God Mode elevated", { tone: "warn" });
          }
        },
        ctx.isGodMode ? "God Mode: ON" : "Elevate to God Mode"
      ),
      h("a", { href: "/newlifecorp", class: "btn btn--subtle" }, "NewLifeCorp Portal →"),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--subtle",
          disabled: !canTenantAdmin,
          onClick: () => openNewWorkspaceModal()
        },
        "+ Provision Tenant"
      )
    )
  );

  // Cross-tenant & NewLifeCorp SaaS metrics
  const totalSaasMrr = snap.workspaces.reduce((s, w) => s + (w.subscriptionStatus === "Suspended" ? 0 : w.monthlyPriceUsd || 0), 0);
  const globalSettled = snap.ledgerEntries
    .filter((e) => e.status === "Settled")
    .reduce((s, e) => s + e.usdAmount, 0);
  const globalSubs = snap.workspaces.reduce((s, w) => s + w.newsletterSubscribers, 0);
  const globalStorageGb = snap.workspaces.reduce((s, w) => s + w.storageUsedGb, 0);

  const godStats = h(
    "section",
    { class: "grid-kpi", "aria-label": "Platform multi-tenant metrics" },
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "NewLifeCorp SaaS MRR"), h("div", { class: "kpi-value" }, isMaster ? formatCurrency(totalSaasMrr) : "Master Only"), h("span", { class: "mono-meta" }, `${snap.workspaces.filter((w) => w.subscriptionStatus !== "Suspended").length}/${snap.workspaces.length} Paying Tenants`)),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Cross-Tenant GMV (MTD)"), h("div", { class: "kpi-value" }, formatCurrency(globalSettled)), h("span", { class: "mono-meta" }, "Tenant creators revenue")),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Global Subscribers"), h("div", { class: "kpi-value" }, formatNumber(globalSubs)), h("span", { class: "mono-meta" }, `${pd.enterpriseLeads.length} NewLifeCorp Leads`)),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "R2 Media Pool Used"), h("div", { class: "kpi-value" }, `${(globalStorageGb / 1000).toFixed(2)} TB`), h("span", { class: "mono-meta" }, "Across all tenant prefixes"))
  );

  // 5-Tier Authority Chain Card + SaaS Master Leads Queue
  const masterGovernanceCard = h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header" },
      h("div", {},
        h("h2", { class: "card-title" }, "NewLifeCorp Master SaaS Sales & Onboarding Queue"),
        h("span", { class: "mono-meta" }, "Tier 0 ULTIMATE MASTER > Tier 1 GOD MODE > Tier 2 ADMIN > Tier 3 SPECIALISTS > Tier 4 GUEST VIEWER")
      ),
      createStatusPill(isMaster ? "ULTIMATE MASTER UNLOCKED" : "MASTER CREDENTIAL REQUIRED FOR BILLING", isMaster ? "ok" : "warn")
    ),
    h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "master-leads-cap" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { id: "master-leads-cap" }, "Incoming NewLifeCorp Registrations & Sales Deals"),
        h("thead", {},
          h("tr", {},
            h("th", { scope: "col" }, "Company"),
            h("th", { scope: "col" }, "Admin Contact"),
            h("th", { scope: "col" }, "Plan / MRR"),
            h("th", { scope: "col" }, "Channels"),
            h("th", { scope: "col" }, "Stage"),
            h("th", { scope: "col" }, "Master Control")
          )
        ),
        h("tbody", {},
          ...pd.enterpriseLeads.map((ld) =>
            h("tr", {},
              h("th", { scope: "row" }, h("div", {}, ld.companyName), h("div", { class: "mono-meta" }, ld.domain)),
              h("td", { dataset: { label: "Contact" } }, `${ld.contactName} (${ld.contactEmail})`),
              h("td", { dataset: { label: "Plan" }, class: "mono" }, `${ld.planName} · $${ld.monthlyPriceUsd}/mo`),
              h("td", { dataset: { label: "Channels" } }, h("span", { class: "mono-meta" }, (ld.channelsRequested ?? []).join(" · "))),
              h("td", { dataset: { label: "Stage" } }, createStatusPill(ld.status, ld.status === "Live Tenant" ? "ok" : "info")),
              h("td", { dataset: { label: "Action" } },
                h("button", {
                  type: "button",
                  class: ld.status === "Live Tenant" ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
                  disabled: !isMaster,
                  onClick: () => {
                    const wsId = convertLeadToTenant(ld.id);
                    if (wsId) showToast(`Master provisioned & opened ${ld.companyName}`, { tone: "ok" });
                  }
                }, ld.status === "Live Tenant" ? "Enter Tenant" : "Approve & Provision")
              )
            )
          )
        )
      )
    )
  );

  // God Mode Impersonation & RLS Control Strip
  const godControlCard = h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header" },
      h("h2", { class: "card-title" }, "PostgreSQL RLS Context & Impersonation Controls"),
      createStatusPill(ctx.tenantScoped ? `RLS: tenant_id = '${ctx.workspace.id}'` : "RLS BYPASS: GLOBAL ROLLUP", ctx.tenantScoped ? "ok" : "warn")
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;" },
      h(
        "pre",
        { style: "margin:0;padding:0.65rem 0.85rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);font-size:var(--text-xs);overflow-x:auto;flex:1 1 360px;" },
        h("code", {}, `SET LOCAL app.current_tenant_id = '${ctx.workspace.id}';\nSET LOCAL app.current_user_id = '${ctx.activeUser.id}';\nSET LOCAL app.role = '${ctx.role.id}'; -- god_bypass=${ctx.isGodMode && !ctx.tenantScoped}`)
      ),
      h(
        "div",
        { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
        ctx.isGodMode
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => toggleCrossTenantView()
              },
              ctx.tenantScoped ? "Enable Global Cross-Tenant View" : "Scope to Active Tenant"
            )
          : null,
        ctx.isImpersonating
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--primary btn--sm",
                onClick: () => stopImpersonating()
              },
              "Exit Impersonation"
            )
          : null,
        h(
          "button",
          {
            type: "button",
            class: "btn btn--subtle btn--sm",
            onClick: () => openSessionModal()
          },
          "Impersonate User / Role"
        )
      )
    )
  );

  // Tenant Workspaces Grid + Feature Flags
  const tenantsGrid = h(
    "section",
    { class: "grid-2", "aria-label": "Tenant workspaces and feature flags" },
    ...snap.workspaces.map((ws) => {
      const isActive = ws.id === ctx.workspace.id;
      const wsRev = snap.ledgerEntries
        .filter((l) => l.workspaceId === ws.id && l.status === "Settled")
        .reduce((s, l) => s + l.usdAmount, 0);
      const wsMembers = snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id)).length;
      const wsTeams = getTenantTeams(ws.id, snap);

      const flagDefs = [
        { key: "etapiSync", label: "TriliumNext ETAPI" },
        { key: "btcpayLightning", label: "BTCPay Lightning" },
        { key: "postizAutopublish", label: "Postiz Auto-Publish" },
        { key: "publicMediaKit", label: "Public Media Kit" },
        { key: "maintenanceMode", label: "Maintenance Lock" }
      ];

      return h(
        "article",
        { class: "card", style: isActive ? "border-color:var(--accent);" : "" },
        h(
          "div",
          { class: "card-header" },
          h(
            "div",
            {},
            h("h2", { class: "card-title" }, ws.name),
            h("span", { class: "mono-meta" }, `${ws.domain} · ${ws.region}`)
          ),
          isActive ? createStatusPill("Active Tenant", "ok") : h("span", { class: "badge" }, ws.plan)
        ),
        h(
          "div",
          { class: "kpi-foot" },
          h("span", { class: "mono" }, `MTD ${formatCurrency(wsRev)} · ${formatNumber(ws.newsletterSubscribers)} subs · ${wsMembers} seats`),
          h("span", { class: "mono-meta" }, `${ws.storageUsedGb}/${ws.storageQuotaGb} GB R2`)
        ),
        h(
          "div",
          { class: "filter-bar" },
          ...flagDefs.map((fl) => {
            const on = Boolean(ws.flags[fl.key]);
            return h(
              "button",
              {
                type: "button",
                class: "filter-pill",
                disabled: !(canTenantAdmin || canPlugins),
                "aria-pressed": String(on),
                onClick: () => {
                  toggleTenantFlag(ws.id, fl.key);
                  showToast(`${ws.name}: ${fl.label} ${on ? "disabled" : "enabled"}`, { tone: "info" });
                }
              },
              `${fl.label}: ${on ? "ON" : "OFF"}`
            );
          })
        ),
        h(
          "div",
          { style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
          h(
            "div",
            { style: "display:flex;justify-content:space-between;align-items:center;" },
            h("span", { class: "mono-meta" }, `CHANNELS & WEBSITES (${(ws.channels ?? []).length})`),
            canTenantAdmin
              ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => openNewChannelModal(ws.id) }, "+ Add Channel")
              : null
          ),
          h(
            "div",
            { style: "display:flex;flex-direction:column;gap:0.3rem;" },
            ...(ws.channels ?? []).map((ch) =>
              h(
                "div",
                { class: "feed-row", style: "padding-block:0.35rem;" },
                h("div", { class: "feed-row-main" },
                  h("strong", { style: "font-size:var(--text-xs);" }, `${ch.name} · ${ch.domain}`),
                  h("span", { class: "mono-meta" }, ch.capabilities.join(" · "))
                ),
                h("div", { style: "display:flex;gap:0.3rem;flex-shrink:0;" },
                  h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => openChannelWebsiteModal(ch.id) }, "Website"),
                  h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => { drillIntoChannel(ch.id, ws.id); navigateTo("command"); showToast(`Scoped Waterfall to ${ws.name} › ${ch.name}`, { tone: "info" }); } }, "Drill ›")
                )
              )
            )
          )
        ),
        h(
          "div",
          { style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
          h("span", { class: "mono-meta" }, `TEAMS & USERS (${wsTeams.length} Teams · ${wsMembers} Users)`),
          ...wsTeams.map((tm) =>
            h(
              "div",
              { style: "padding:0.45rem 0.6rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:0.25rem;" },
              h("div", { style: "display:flex;justify-content:space-between;align-items:center;" },
                h("strong", { style: "font-size:var(--text-xs);" }, tm.name),
                h("span", { class: "mono-meta" }, tm.channels.map((c) => c.name).join(", "))
              ),
              h("div", { style: "display:flex;flex-wrap:wrap;gap:0.25rem;" },
                ...tm.members.map(({ user, role: memberRole }) =>
                  h("button", {
                    type: "button",
                    class: "tag",
                    style: "cursor:pointer;",
                    onClick: () => {
                      drillIntoUser(user.id, ws.id);
                      navigateTo("command");
                      showToast(`Acting as ${user.name} [${memberRole.badge}]`, { tone: "warn" });
                    }
                  }, `${user.name} · ${memberRole.badge}`)
                )
              )
            )
          )
        ),
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.45rem;padding-top:0.35rem;border-top:1px solid var(--border-subtle);" },
          h("span", { class: "mono-meta" }, `Plan: ${ws.plan} ($${ws.monthlyPriceUsd || 0}/mo · ${wsMembers}/${ws.seatLimit || 25} seats) · ${ws.subscriptionStatus || "Active"}`),
          isMaster
            ? h(
                "div",
                { style: "display:flex;gap:0.3rem;flex-wrap:wrap;" },
                h(
                  "select",
                  {
                    class: "select",
                    "aria-label": `Change subscription plan for ${ws.name}`,
                    style: "max-inline-size:170px;",
                    onChange: (e) => {
                      const chosen = pd.saasPlans.find((p) => p.name === e.target.value);
                      updateTenantCommercials(ws.id, {
                        plan: e.target.value,
                        monthlyPriceUsd: chosen?.monthlyPriceUsd ?? ws.monthlyPriceUsd,
                        seatLimit: chosen?.seatLimit ?? ws.seatLimit
                      });
                      showToast(`Updated ${ws.name} plan to ${e.target.value}`, { tone: "ok" });
                    }
                  },
                  ...pd.saasPlans.map((p) => h("option", { value: p.name, selected: p.name === ws.plan }, `${p.name} ($${p.monthlyPriceUsd})`))
                ),
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--ghost btn--sm",
                    onClick: () => {
                      toggleWorkspaceSuspended(ws.id);
                      showToast(`Updated suspension state for ${ws.name}`, { tone: "warn" });
                    }
                  },
                  ws.subscriptionStatus === "Suspended" ? "Reactivate" : "Suspend"
                )
              )
            : null
        ),
        h(
          "div",
          { style: "display:flex;justify-content:space-between;align-items:center;padding-top:0.35rem;" },
          h("span", { class: "mono-meta" }, `Scenarios: ${ws.activeScenarios.join(", ")}`),
          h(
            "button",
            {
              type: "button",
              class: !ctx.isMasterPlatformScope && isActive ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
              disabled: !ctx.isMasterPlatformScope && isActive,
              onClick: () => {
                drillIntoTenant(ws.id);
                navigateTo("command");
                showToast(`Entered Tenant Workspace: ${ws.name}`, { tone: "ok" });
              }
            },
            !ctx.isMasterPlatformScope && isActive ? "Inside Tenant" : "Enter Tenant Workspace →"
          )
        )
      );
    })
  );

  // Full Multi-Tenant Audit Log Table
  const auditTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "audit-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "audit-caption" }, "Multi-Tenant Security & Action Audit Log"),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { scope: "col" }, "Timestamp"),
          h("th", { scope: "col" }, "Actor"),
          h("th", { scope: "col" }, "Role"),
          h("th", { scope: "col" }, "Tenant"),
          h("th", { scope: "col" }, "Action")
        )
      ),
      h(
        "tbody",
        {},
        ...(snap.auditLog ?? []).map((evt) =>
          h(
            "tr",
            {},
            h("th", { scope: "row", class: "mono" }, evt.time),
            h("td", { dataset: { label: "Actor" } }, evt.actor),
            h("td", { dataset: { label: "Role" } }, createStatusPill(evt.role, evt.tone)),
            h("td", { dataset: { label: "Tenant" }, class: "mono" }, evt.workspace),
            h("td", { dataset: { label: "Action" } }, evt.action)
          )
        )
      )
    )
  );

  return [header, godStats, masterGovernanceCard, godControlCard, tenantsGrid, auditTable];
}
