import { ROLES, SCENARIOS } from "../data/seed.js";
import { openPipelineDrawer } from "../components/drawer.js";
import { openChannelWebsiteModal, openMediaKitModal, openNewChannelModal, openNewWorkspaceModal } from "../components/modal.js";
import { createScenarioBadge, createSparkline, createStatusPill, formatCurrency, formatNumber, h } from "../lib/dom.js";
import { navigateTo } from "../lib/router.js";
import {
  addPipelineItem,
  can,
  canAccessRoute,
  canEditScenario,
  convertLeadToTenant,
  drillIntoChannel,
  drillIntoTenant,
  drillIntoUser,
  enterSandboxWorkingCopy,
  getDerivedMetrics,
  getState,
  getTenantModuleStatus,
  getTenantSlice,
  getTenantTeams,
  runSyncPulse,
  switchChannel,
  toggleSuiteConfig,
  toggleSuitePlugin,
  toggleWorkspaceSuspended
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let masterTenantFilter = "All";
let masterTenantQuery = "";

function renderMasterTenantsHome(snap, ctx) {
  const pd = snap.platformData;
  const isMaster = ctx.isUltimateMaster;
  const canPlugins = can("plugins:write", snap);
  const totalMrr = snap.workspaces.reduce((s, w) => s + (w.subscriptionStatus === "Suspended" ? 0 : w.monthlyPriceUsd || 0), 0);
  const totalChannels = snap.workspaces.reduce((s, w) => s + (w.channels?.length || 1), 0);
  const pendingLeads = pd.enterpriseLeads.filter((l) => l.status !== "Live Tenant").length;
  const tenantUsersCount = snap.users.filter((u) => u.userScope !== "platform").length;
  const platformUsersCount = snap.users.filter((u) => u.userScope === "platform").length;
  const enabledPlugins = (pd.suitePlugins ?? []).filter((p) => p.enabled).length;
  const liveWatchers = (snap.activeWatchers ?? []).filter((w) => w.running);

  const filteredTenants = snap.workspaces.filter((ws) => {
    const q = masterTenantQuery.trim().toLowerCase();
    const matchText = !q || ws.name.toLowerCase().includes(q) || ws.domain.toLowerCase().includes(q) || (ws.plan || "").toLowerCase().includes(q);
    if (!matchText) return false;
    if (masterTenantFilter === "Active") return ws.subscriptionStatus !== "Suspended";
    if (masterTenantFilter === "Suspended") return ws.subscriptionStatus === "Suspended";
    if (masterTenantFilter === "Multi-Channel") return (ws.channels?.length ?? 0) > 1;
    return true;
  });

  const searchIn = h("input", {
    id: "master-tenant-search",
    type: "search",
    class: "input",
    value: masterTenantQuery,
    placeholder: "Search registered companies, domains, plans...",
    "aria-label": "Filter registered tenants",
    style: "max-inline-size:320px;",
    onInput: (e) => {
      masterTenantQuery = e.target.value;
      const pos = e.target.selectionStart ?? masterTenantQuery.length;
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
      queueMicrotask(() => {
        const el = document.getElementById("master-tenant-search");
        if (el) {
          el.focus();
          el.setSelectionRange?.(pos, pos);
        }
      });
    }
  });

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, isMaster ? "Ultimate Master — Tenants, Plugins & Platform Suite" : "Ultimate Maintenance — Suite Plugins, Configs & Live Operations"),
      h("p", { class: "page-subtitle" }, `Waterfall Level 1 (Master Platform · ${platformUsersCount} Platform Users: Ultimate Master & Ultimate Maintenance) · Manage tenants → channels → teams → role-badged users`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h("a", { href: "/subscriptions", class: "btn btn--primary" }, "Manage Subscriptions"),
      h("a", { href: "/suite", class: "btn btn--subtle" }, "Suite (3 Versions)"),
      h("a", { href: "/emulate", class: "btn btn--subtle" }, "Emulate Sandbox"),
      isMaster ? h("a", { href: "/newlifecorp", class: "btn btn--ghost" }, "NewLifeCorp Portal →") : null
    )
  );

  const kpis = h(
    "section",
    { class: "grid-kpi", "aria-label": "Platform commercial and system metrics" },
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, isMaster ? "Active SaaS MRR" : "Suite Uptime / Plugins"), createStatusPill(isMaster ? "NEWLIFECORP" : `${enabledPlugins} PLUGINS`, isMaster ? "warn" : "ok")), h("div", { class: "kpi-value" }, isMaster ? formatCurrency(totalMrr) : `${enabledPlugins}/${(pd.suitePlugins ?? []).length}`), h("span", { class: "mono-meta" }, isMaster ? `${snap.workspaces.filter((w) => w.subscriptionStatus !== "Suspended").length}/${snap.workspaces.length} active plans` : "Active integration modules")),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Registered Tenants"), createStatusPill(`${totalChannels} Channels`, "ok")), h("div", { class: "kpi-value" }, String(snap.workspaces.length)), h("span", { class: "mono-meta" }, `${tenantUsersCount} respective tenant users`)),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Live Connected Users"), createStatusPill("LIVE TELEMETRY", "ok")), h("div", { class: "kpi-value" }, String(liveWatchers.length)), h("span", { class: "mono-meta" }, "Active streams & editing sessions")),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, isMaster ? "Public Signups / Leads" : "Dead-Letter Queue"), createStatusPill(isMaster ? `${pendingLeads} Pending` : `${snap.failedJobs.length} Failed`, (isMaster ? pendingLeads : snap.failedJobs.length) > 0 ? "warn" : "ok")), h("div", { class: "kpi-value" }, isMaster ? String(pd.enterpriseLeads.length) : String(snap.failedJobs.length)), h("span", { class: "mono-meta" }, isMaster ? "From newlifecorp.io portal" : "Recoverable via /system"))
  );

  // Suite Plugins, Configurations & Live Users Panel visible to Master & Maintenance
  const opsOverviewPanel = h(
    "section",
    { class: "split-pane" },
    h(
      "article",
      { class: "card", style: "gap:0.65rem;" },
      h("div", { class: "card-header" },
        h("h2", { class: "card-title" }, "Suite Plugins & Core Configurations"),
        h("a", { href: "/system", class: "btn btn--ghost btn--sm" }, "Full Health & Queues →")
      ),
      h(
        "div",
        { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.45rem;" },
        ...(pd.suitePlugins ?? []).map((plg) =>
          h(
            "div",
            { class: "feed-row", style: "background:var(--bg-canvas);padding:0.5rem 0.65rem;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);" },
            h("div", { class: "feed-row-main" },
              h("strong", { style: "font-size:var(--text-xs);" }, plg.name),
              h("span", { class: "mono-meta" }, `${plg.version} · ${plg.health}`)
            ),
            h("button", {
              type: "button",
              class: plg.enabled ? "btn btn--primary btn--sm" : "btn btn--subtle btn--sm",
              disabled: !canPlugins,
              onClick: () => {
                toggleSuitePlugin(plg.id);
                showToast(`${plg.name} ${plg.enabled ? "disabled" : "enabled"}`, { tone: "info" });
              }
            }, plg.enabled ? "ON" : "OFF")
          )
        )
      ),
      h(
        "div",
        { class: "filter-bar", style: "padding-top:0.25rem;" },
        ...(pd.suiteConfigs ?? []).filter((c) => c.type === "toggle").map((cfg) =>
          h("button", {
            type: "button",
            class: "filter-pill",
            disabled: !canPlugins,
            "aria-pressed": String(Boolean(cfg.value)),
            onClick: () => {
              toggleSuiteConfig(cfg.key);
              showToast(`${cfg.label}: ${cfg.value ? "OFF" : "ON"}`, { tone: "info" });
            }
          }, `${cfg.label}: ${cfg.value ? "ON" : "OFF"}`)
        )
      )
    ),
    h(
      "article",
      { class: "card", style: "gap:0.65rem;" },
      h("div", { class: "card-header" },
        h("h2", { class: "card-title" }, `Live Users & Integrations (${liveWatchers.length} Running)`),
        createStatusPill("Real-Time Telemetry", "ok")
      ),
      h(
        "ul",
        { class: "feed-list" },
        ...liveWatchers.slice(0, 5).map((w) => {
          const u = snap.users.find((x) => x.id === w.userId);
          const r = ROLES.find((x) => x.id === u?.defaultRoleId);
          const ws = snap.workspaces.find((x) => x.id === w.workspaceId);
          const hrs = (w.todaySeconds / 3600).toFixed(1);
          return h("li", { class: "feed-row" },
            h("div", { class: "feed-row-main" },
              h("strong", { style: "font-size:var(--text-xs);" }, `${u?.name ?? w.userId} · ${ws?.domain ?? w.workspaceId}`),
              h("span", { class: "mono-meta" }, `${w.tool} · ${hrs}h today`)
            ),
            createStatusPill(r?.badge ?? "ACTIVE", "ok")
          );
        })
      ),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;padding-top:0.25rem;" },
        ...(pd.integrationsStatus ?? []).map((it) => h("span", { class: "tag" }, `${it.name}: ${it.status} (${it.latency})`))
      )
    )
  );

  const filterRow = h(
    "section",
    { class: "card", style: "padding:0.75rem 1rem;" },
    h(
      "search",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;" },
      h(
        "div",
        { class: "filter-bar", role: "group", "aria-label": "Filter tenants by status" },
        ...["All", "Active", "Multi-Channel", "Suspended"].map((f) =>
          h(
            "button",
            {
              type: "button",
              class: "filter-pill",
              "aria-pressed": String(masterTenantFilter === f),
              onClick: () => {
                masterTenantFilter = f;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            },
            f
          )
        )
      ),
      searchIn
    )
  );

  const tenantsGrid = h(
    "section",
    { style: "display:flex;flex-direction:column;gap:0.75rem;" },
    h("div", { class: "card-header" },
      h("h2", { class: "section-heading" }, `Registered Company Tenants: Channels → Teams → Users (${filteredTenants.length})`),
      h("span", { class: "mono-meta" }, "Respective channels, teams, and role-assigned users per tenant")
    ),
    h(
      "div",
      { class: "grid-2" },
      ...filteredTenants.map((ws) => {
        const tenantTeams = getTenantTeams(ws.id, snap);
        const wsUsers = snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id));
        const wsRev = snap.ledgerEntries.filter((l) => l.workspaceId === ws.id && l.status === "Settled").reduce((s, l) => s + l.usdAmount, 0);
        const isSuspended = ws.subscriptionStatus === "Suspended";
        return h(
          "article",
          { class: "card", style: isSuspended ? "border-color:var(--status-warn);" : "" },
          h("div", { class: "card-header" },
            h("div", {},
              h("h3", { class: "card-title", style: "font-size:var(--text-base);" }, ws.name),
              h("span", { class: "mono-meta" }, `${ws.domain} · ${ws.plan} ($${ws.monthlyPriceUsd || 0}/mo)`)
            ),
            createStatusPill(ws.subscriptionStatus || "Active", isSuspended ? "warn" : "ok")
          ),
          h("div", { class: "kpi-foot" },
            h("span", { class: "mono-meta" }, `${(ws.channels ?? []).length} channels · ${tenantTeams.length} teams · ${wsUsers.length} users · MTD ${formatCurrency(wsRev)}`),
            h("span", { class: "mono-meta" }, `${ws.storageUsedGb}/${ws.storageQuotaGb} GB`)
          ),
          /* 1. Tenant Channels */
          h("div", { style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
            h("span", { class: "mono-meta" }, `1. CHANNELS (${(ws.channels ?? []).length})`),
            h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;" },
              ...(ws.channels ?? []).map((ch) =>
                h("button", {
                  type: "button",
                  class: "btn btn--subtle btn--sm",
                  onClick: () => {
                    drillIntoChannel(ch.id, ws.id);
                    showToast(`Waterfall Level 3: ${ws.name} › ${ch.name}`, { tone: "info" });
                  }
                }, `› ${ch.name} (${ch.domain})`)
              ),
              isMaster ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => openNewChannelModal(ws.id) }, "+ Channel") : null
            )
          ),
          /* 2. Tenant Teams -> 3. Users with Roles */
          h("div", { style: "display:flex;flex-direction:column;gap:0.45rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
            h("span", { class: "mono-meta" }, `2. TEAMS & 3. USERS WITH ROLES (${tenantTeams.length} Teams · ${wsUsers.length} Users)`),
            ...tenantTeams.map((tm) =>
              h("div", { style: "padding:0.5rem 0.65rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:0.35rem;" },
                h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:0.4rem;" },
                  h("strong", { style: "font-size:var(--text-xs);" }, tm.name),
                  h("span", { class: "mono-meta" }, `${tm.leadUser ? `Lead: ${tm.leadUser.name} · ` : ""}${tm.channels.map((c) => c.name).join(" + ")}`)
                ),
                h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;" },
                  ...tm.members.map(({ user, role: memberRole, unit }) =>
                    h("button", {
                      type: "button",
                      class: "tag",
                      style: "cursor:pointer;",
                      title: `${user.title} · ${unit} (${memberRole.name}) — Click to enter user scope`,
                      onClick: () => {
                        drillIntoUser(user.id, ws.id);
                        showToast(`Waterfall Level 4: ${user.name} (${unit}) in ${ws.name}`, { tone: "warn" });
                      }
                    }, `${user.name} · ${unit === "Team Lead" ? "LEAD" : unit || memberRole.badge}`)
                  )
                )
              )
            )
          ),
          h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.45rem;margin-top:auto;padding-top:0.45rem;border-top:1px solid var(--border-subtle);" },
            h("div", { style: "display:flex;gap:0.35rem;" },
              ws.channels?.[0] ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => openChannelWebsiteModal(ws.channels[0].id) }, "Website") : null,
              isMaster ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => { toggleWorkspaceSuspended(ws.id); showToast(`${ws.name} ${isSuspended ? "reactivated" : "suspended"}`, { tone: "warn" }); } }, isSuspended ? "Reactivate" : "Suspend") : null
            ),
            h("button", {
              type: "button",
              class: "btn btn--primary btn--sm",
              onClick: () => {
                drillIntoTenant(ws.id);
                showToast(`Entered Tenant Level 2: ${ws.name}`, { tone: "ok" });
              }
            }, "Enter Tenant Workspace →")
          )
        );
      })
    )
  );

  const leadsPanel = isMaster
    ? h(
        "section",
        { class: "card", style: "gap:0.75rem;" },
        h("div", { class: "card-header" },
          h("h2", { class: "card-title" }, "Incoming NewLifeCorp Public Registrations & Leads"),
          h("a", { href: "/newlifecorp", class: "btn btn--ghost btn--sm" }, "Open Public Portal →")
        ),
        h(
          "ul",
          { class: "feed-list" },
          ...pd.enterpriseLeads.map((ld) =>
            h("li", { class: "feed-row", style: "flex-wrap:wrap;gap:0.5rem;" },
              h("div", { class: "feed-row-main" },
                h("strong", { style: "font-size:var(--text-sm);" }, `${ld.companyName} (${ld.domain})`),
                h("span", { class: "mono-meta" }, `${ld.contactName} · ${ld.planName} ($${ld.monthlyPriceUsd}/mo) · ${(ld.channelsRequested ?? []).join(" + ")}`)
              ),
              h("div", { style: "display:flex;align-items:center;gap:0.45rem;" },
                createStatusPill(ld.status, ld.status === "Live Tenant" ? "ok" : "info"),
                h("button", {
                  type: "button",
                  class: ld.status === "Live Tenant" ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
                  onClick: () => {
                    const wsId = convertLeadToTenant(ld.id);
                    if (wsId) showToast(ld.status === "Live Tenant" ? `Entered ${ld.companyName}` : `Provisioned ${ld.companyName}`, { tone: "ok" });
                  }
                }, ld.status === "Live Tenant" ? "Enter Tenant →" : "Approve & Provision")
              )
            )
          )
        )
      )
    : null;

  return [header, kpis, opsOverviewPanel, filterRow, tenantsGrid, ...(leadsPanel ? [leadsPanel] : [])];
}

export function renderCommandCenter() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, channels, activeChannel, activeUser, role, isGodMode, isMasterPlatformScope } = slice.ctx;

  if (isMasterPlatformScope) {
    return renderMasterTenantsHome(snap, slice.ctx);
  }
  const metrics = getDerivedMetrics(snap);
  const canCapture = can("pipeline:write", snap);
  const canFinance = isGodMode || can("finance:read", snap);
  const allChannels = snap.workspaces.flatMap((w) => w.channels ?? []);

  // External Guest / Sponsor Viewer Portal (strictly confidential isolation)
  if (role.id === "guest_viewer") {
    return [
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          { class: "page-title-group" },
          h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, `${workspace.name} — External Partner Portal`),
          h("p", { class: "page-subtitle" }, `Signed in as ${activeUser.name} (${activeUser.title}) · Internal studio projects, workflows, and financial ledgers are strictly confidential`)
        ),
        h(
          "div",
          { class: "page-actions" },
          h("button", { type: "button", class: "btn btn--primary", onClick: () => openMediaKitModal() }, "Open Public Media Kit")
        )
      ),
      h(
        "section",
        { class: "grid-2" },
        h(
          "article",
          { class: "card" },
          h("div", { class: "card-header" }, h("h2", { class: "card-title" }, "Your Assigned Collaboration Deliverables"), createStatusPill("Partner Scoped", "ok")),
          ...(slice.sponsors.length
            ? slice.sponsors.map((sp) =>
                h(
                  "div",
                  { class: "feed-row", style: "flex-direction:column;align-items:flex-start;gap:0.3rem;" },
                  h("strong", {}, `${sp.company} — ${sp.stage}`),
                  h("span", { style: "font-size:var(--text-sm);" }, sp.deliverables),
                  h("span", { class: "mono-meta" }, `Tracking slug: ${workspace.shortDomain}/${sp.affiliateSlug} · Due ${sp.dueDate}`)
                )
              )
            : [h("p", { class: "page-subtitle" }, "No external deliverables assigned to this guest session.")])
        ),
        h(
          "article",
          { class: "card" },
          h("div", { class: "card-header" }, h("h2", { class: "card-title" }, "Assigned /go Tracking Links"), createStatusPill("Confidentiality Active", "info")),
          ...(slice.shortLinks.length
            ? slice.shortLinks.map((lnk) =>
                h(
                  "div",
                  { class: "feed-row" },
                  h("span", { class: "mono" }, `${workspace.shortDomain}/${lnk.slug}`),
                  h("span", { class: "mono-meta" }, `${formatNumber(lnk.clicks)} clicks (${lnk.convRate}% CTR)`)
                )
              )
            : [h("p", { class: "page-subtitle" }, "No shared affiliate links scoped to your partner account.")])
        )
      )
    ];
  }

  const primaryScen = role.scenarios?.[0];
  const primaryScenObj = SCENARIOS.find((s) => s.id === primaryScen);
  const workbenchLabel =
    role.scenarios?.length === 1 && primaryScenObj
      ? `Open ${primaryScenObj.short} Editor & Sources →`
      : "Open Creator Studios";
  const workbenchHref = role.scenarios?.length === 1 && primaryScen ? `/studio?scenario=${primaryScen}` : "/studio";

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, `${workspace.name} — Command Center`),
      h("p", { class: "page-subtitle" }, `Signed in as ${activeUser.name} (${role.name}) · Channel: ${activeChannel ? `${activeChannel.name} (${activeChannel.domain})` : `All (${channels.length})`} · Scoped workflows only`)
    ),
    h(
      "div",
      { class: "page-actions" },
      canAccessRoute("studio", snap) ? h("a", { href: workbenchHref, class: "btn btn--primary" }, workbenchLabel) : null,
      canAccessRoute("hub", snap) ? h("a", { href: "/hub", class: "btn btn--subtle" }, "Content Organizer (Tree/Calendar)") : null,
      canAccessRoute("pipeline", snap) ? h("a", { href: "/pipeline", class: "btn btn--subtle" }, "Pipeline Board") : null,
      isGodMode || role.id === "tenant_admin"
        ? h("button", { type: "button", class: "btn btn--subtle", onClick: () => { runSyncPulse(); showToast("Sync pulse complete — PostgreSQL RLS, Redis, R2 & ETAPI nominal", { tone: "ok" }); } }, "Run Sync Pulse")
        : null
    )
  );

  const myWatcher = slice.activeWatchers.find((w) => w.userId === activeUser.id);
  const myHours = myWatcher ? `${(myWatcher.todaySeconds / 3600).toFixed(1)}h` : `${(slice.activeWatchers.reduce((s, w) => s + w.todaySeconds, 0) / 3600).toFixed(1)}h`;

  const kpis = canFinance
    ? h(
        "section",
        { class: "grid-kpi", "aria-label": "Key performance indicators" },
        h(
          "article",
          { class: "card kpi-card" },
          h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Monthly Revenue (MTD)"), createStatusPill("+14.2%", "ok")),
          h("div", { class: "kpi-value" }, formatCurrency(metrics.monthlyRevenueUsd)),
          h("div", { class: "kpi-foot" }, h("span", {}, `Sponsors ${formatCurrency(metrics.sponsorSettledUsd)} · Affil ${formatCurrency(metrics.affiliateRevenueUsd)} · Tips ${formatCurrency(metrics.donationsRevenueUsd)}`), createSparkline([12400, 13900, 14200, 15800, 16900, metrics.monthlyRevenueUsd], "Monthly revenue trend"))
        ),
        h(
          "article",
          { class: "card kpi-card" },
          h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Total Affiliate Clicks"), createStatusPill("+22.8%", "info")),
          h("div", { class: "kpi-value" }, formatNumber(metrics.totalAffiliateClicks)),
          h("div", { class: "kpi-foot" }, h("span", {}, `${slice.shortLinks.filter((l) => l.active).length} active /go slugs · ${workspace.shortDomain}`), createSparkline([14200, 16100, 18400, 20100, 22300, metrics.totalAffiliateClicks], "Affiliate clicks trend"))
        ),
        h(
          "article",
          { class: "card kpi-card" },
          h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Newsletter Subscribers"), createStatusPill(`+${formatNumber(workspace.newsletterDeltaMonth)} mo`, "ok")),
          h("div", { class: "kpi-value" }, formatNumber(workspace.newsletterSubscribers)),
          h("div", { class: "kpi-foot" }, h("span", {}, `${workspace.newsletterOpenRate}% avg open rate · Listmonk`), createSparkline([34100, 35200, 36000, 37100, 37900, workspace.newsletterSubscribers], "Subscriber growth"))
        ),
        h(
          "article",
          { class: "card kpi-card" },
          h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Pending Deliverables"), createStatusPill(metrics.pendingDeliverables > 0 ? "Active Queue" : "All Clear", metrics.pendingDeliverables > 0 ? "warn" : "ok")),
          h("div", { class: "kpi-value" }, String(metrics.pendingDeliverables)),
          h("div", { class: "kpi-foot" }, h("span", {}, `Across ${slice.pipelineItems.length} scoped pipeline items`), h("a", { href: "/pipeline", class: "btn btn--ghost btn--sm" }, "Review →"))
        )
      )
    : h(
        "section",
        { class: "grid-kpi", "aria-label": "Scoped role performance indicators" },
        h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Authorized Scenarios"), h("div", { class: "kpi-value" }, String(role.scenarios.length || "Ops")), h("span", { class: "mono-meta" }, role.scenarios.join(", ") || "Read/Ops scoped")),
        h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "My Tracked Hours Today"), h("div", { class: "kpi-value" }, myHours), h("a", { href: "/calendar", class: "btn btn--ghost btn--sm" }, "Mega Calendar →")),
        h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Scoped Pipeline Items"), h("div", { class: "kpi-value" }, String(slice.pipelineItems.length)), h("span", { class: "mono-meta" }, "Other projects confidential")),
        h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Pending My Deliverables"), h("div", { class: "kpi-value" }, String(metrics.pendingDeliverables)), h("span", { class: "mono-meta" }, "Checklist tasks remaining"))
      );

  const allowedScenarios = SCENARIOS.filter((s) => canEditScenario(s.id, snap));
  const capTitle = h("input", {
    id: "qc-title",
    class: "input",
    type: "text",
    required: true,
    disabled: !canCapture,
    placeholder: canCapture ? "Capture idea or task into your authorized scenario..." : "Read-only role"
  });
  const capScenario = h("select", { id: "qc-scenario", class: "select", disabled: !canCapture }, ...(allowedScenarios.length ? allowedScenarios : SCENARIOS).map((s) => h("option", { value: s.id }, s.label)));
  const capStage = h("select", { id: "qc-stage", class: "select", disabled: !canCapture }, h("option", { value: "capture" }, "Capture (Trilium)"), h("option", { value: "produce" }, "Produce (OBS/Resolve)"), h("option", { value: "hub" }, "Hub (EmDash/RSS)"));
  const capReady = h("input", { id: "qc-ready", type: "checkbox", disabled: !canCapture });

  const quickCapture = canCapture
    ? h(
        "section",
        { class: "card", "aria-labelledby": "qc-heading" },
        h("div", { class: "card-header" }, h("h2", { id: "qc-heading", class: "card-title" }, "Quick Capture → TriliumNext ETAPI"), h("span", { class: "mono-meta" }, `Scoped to ${workspace.name}`)),
        h(
          "form",
          {
            class: "quick-capture-form",
            onSubmit: (e) => {
              e.preventDefault();
              const title = capTitle.value.trim();
              if (!title) return;
              addPipelineItem({ title, scenario: capScenario.value, stage: capStage.value, publishReady: capReady.checked });
              capTitle.value = "";
              capReady.checked = false;
              showToast(`Captured "${title}" into ${workspace.name}`, { tone: "ok" });
            }
          },
          h("div", { class: "field" }, h("label", { class: "field-label", for: "qc-title" }, "Idea / Note Title"), capTitle),
          h("div", { class: "field" }, h("label", { class: "field-label", for: "qc-scenario" }, "Scenario"), capScenario),
          h("div", { class: "field" }, h("label", { class: "field-label", for: "qc-stage" }, "Initial Stage"), capStage),
          h("label", { class: "checklist-item", style: "min-block-size:36px;" }, capReady, h("span", { class: "mono", style: "font-size:var(--text-xs);" }, "#publish-ready")),
          h("button", { type: "submit", class: "btn btn--primary" }, "Capture Note")
        )
      )
    : null;

  const workflowsGrid = h(
    "section",
    { style: "display:flex;flex-direction:column;gap:0.75rem;" },
    h("div", { class: "card-header" }, h("h2", { class: "section-heading" }, `Authorized Workflows (${slice.workflowsToday.length})`), h("span", { class: "mono-meta" }, "Confidential isolation enforced")),
    h(
      "div",
      { class: "grid-3" },
      ...(slice.workflowsToday.length
        ? slice.workflowsToday.map((wf) => {
            const owner = snap.users.find((u) => u.id === wf.ownerUserId);
            const ch = allChannels.find((c) => c.id === wf.channelId);
            return h(
              "article",
              { class: "card" },
              h("div", { class: "card-header" },
                h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;" },
                  createScenarioBadge(wf.scenario, SCENARIOS),
                  ch ? h("span", { class: "tag" }, ch.name) : null
                ),
                createStatusPill(wf.status, wf.statusTone)
              ),
              h("h3", { class: "card-title", style: "font-size:var(--text-sm);line-height:1.35;" }, wf.title),
              h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, wf.meta),
              h("div", { class: "mono-meta" }, `Lead: ${owner?.name ?? "Studio"} · ${wf.schedule}`),
              h(
                "div",
                { class: "kpi-foot", style: "margin-top:auto;padding-top:0.25rem;" },
                h(
                  "div",
                  { style: "display:flex;gap:0.35rem;margin-inline-start:auto;" },
                  canAccessRoute("studio", snap) ? h("button", { type: "button", class: "btn btn--primary btn--sm", onClick: () => navigateTo("studio", { scenario: wf.scenario }) }, "Workbench") : null,
                  h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => openPipelineDrawer(wf.pipelineId) }, "Inspect")
                )
              )
            );
          })
        : [h("div", { class: "card" }, h("p", { class: "page-subtitle" }, "No active production workflows scoped to this role."))])
    )
  );

  const channelStrip = channels.length
    ? h(
        "section",
        { style: "display:flex;flex-direction:column;gap:0.65rem;" },
        h(
          "div",
          { class: "card-header" },
          h("h2", { class: "section-heading" }, `Active Tenant Channels & Owned Websites (${channels.length})`),
          channels.length > 1 && activeChannel
            ? h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => switchChannel("all") }, "Show All Channels")
            : null
        ),
        h(
          "div",
          { class: "grid-2" },
          ...channels.map((ch) => {
            const isSelected = activeChannel?.id === ch.id;
            return h(
              "article",
              { class: "card", style: isSelected ? "border-color:var(--accent);background:var(--accent-soft);" : "" },
              h(
                "div",
                { class: "card-header" },
                h("div", { style: "display:flex;flex-direction:column;gap:0.15rem;" },
                  h("strong", { style: "font-size:var(--text-base);" }, ch.name),
                  h("span", { class: "mono-meta", style: "color:var(--accent);" }, `${ch.domain} · ${ch.shortDomain}`)
                ),
                createStatusPill(`${formatNumber(ch.subscribers)} subs`, ch.tone || "info")
              ),
              h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, ch.tagline),
              h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;" }, ...ch.capabilities.map((cap) => h("span", { class: "tag" }, cap))),
              h(
                "div",
                { class: "kpi-foot", style: "margin-top:auto;padding-top:0.25rem;" },
                h("span", { class: "mono-meta" }, `${ch.socialHandles.slice(0, 2).join(" · ")}`),
                h(
                  "div",
                  { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
                  h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => openChannelWebsiteModal(ch.id) }, "Website Preview"),
                  channels.length > 1
                    ? h(
                        "button",
                        {
                          type: "button",
                          class: isSelected ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm",
                          onClick: () => {
                            switchChannel(isSelected ? "all" : ch.id);
                            showToast(isSelected ? "Showing all channels" : `Scoped OS to ${ch.name}`, { tone: "info" });
                          }
                        },
                        isSelected ? "Scoped ✓" : "Filter Channel"
                      )
                    : null
                )
              )
            );
          })
        )
      )
    : null;

  const automationQueue = h(
    "aside",
    { class: "card", "aria-labelledby": "aq-heading" },
    h("div", { class: "card-header" }, h("h2", { id: "aq-heading", class: "card-title" }, "Scoped Activity & Queue"), canAccessRoute("system", snap) ? h("a", { href: "/system", class: "btn btn--ghost btn--sm" }, "Infra Details →") : null),
    h(
      "ul",
      { class: "feed-list" },
      ...(slice.automationEvents.length
        ? slice.automationEvents.map((evt) =>
            h(
              "li",
              { class: "feed-row" },
              h("div", { class: "feed-row-main" }, h("span", { class: "mono", style: "font-size:0.72rem;font-weight:600;" }, evt.source), h("span", { style: "font-size:var(--text-xs);color:var(--text-secondary);" }, evt.job)),
              h("div", { style: "display:flex;align-items:center;gap:0.5rem;flex-shrink:0;" }, createStatusPill(evt.status, evt.tone), h("span", { class: "mono-meta" }, evt.time))
            )
          )
        : [h("li", { class: "feed-row" }, h("span", { class: "page-subtitle" }, "No recent events for your scoped scenarios."))])
    )
  );

  const suiteModules = snap.platformData?.suiteModules ?? [];
  const suiteStrip = suiteModules.length && role.id !== "guest_viewer"
    ? h(
        "section",
        { class: "card", style: "padding:0.7rem 1rem;gap:0.45rem;" },
        h(
          "div",
          { class: "card-header" },
          h("span", { class: "mono-meta" }, `SUBSCRIBED SUITE MODULES & RELEASE TRACKS (${workspace.name})`),
          canAccessRoute("suite", snap) ? h("a", { href: "/suite", class: "btn btn--ghost btn--sm" }, "Configure Suite →") : null
        ),
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;gap:0.4rem;" },
          ...suiteModules.map((m) => {
            const st = getTenantModuleStatus(m.id, workspace.id, snap);
            if (!st) return null;
            const shortName = m.name.split("&")[0].trim();
            return createStatusPill(
              st.enabled ? `${shortName} · v${st.installedVersion} (${st.track.toUpperCase()})` : `${shortName} · UNASSIGNED`,
              st.enabled ? st.tone : "warn"
            );
          })
        )
      )
    : null;

  return [header, ...(suiteStrip ? [suiteStrip] : []), ...(channelStrip ? [channelStrip] : []), kpis, ...(quickCapture ? [quickCapture] : []), h("div", { class: "split-pane" }, workflowsGrid, automationQueue)];
}
