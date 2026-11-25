import { ROLES } from "../data/seed.js";
import { createStatusPill, formatNumber, h } from "../lib/dom.js";
import {
  can,
  getActiveContext,
  getDbStatus,
  getState,
  getTenantSlice,
  hydrateStateFromSqlite,
  resetState,
  retryAllFailedJobs,
  retryFailedJob,
  runSyncPulse,
  toggleQueuePaused,
  toggleSuiteConfig,
  toggleSuitePlugin,
  updateSuiteConfigValue
} from "../lib/store.js";
import { applyScheme, getStoredScheme } from "../lib/theme.js";
import { showToast } from "../lib/toast.js";

export function renderSystemHealth() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const slice = getTenantSlice(snap);
  const canOperateInfra = can("system:write", snap);
  const canConfigurePlugins = can("plugins:write", snap);
  const storedScheme = getStoredScheme() ?? "system";
  const pd = snap.platformData;

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "System Health, Suite Plugins & Live Telemetry"),
      h("p", { class: "page-subtitle" }, "Plugins & suite configurations, API integrations, live active tenant users, PostgreSQL 17, Redis + BullMQ workers & R2 mesh")
    ),
    h(
      "div",
      { class: "page-actions" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => { runSyncPulse(); showToast("Health check passed across all infrastructure & integration nodes", { tone: "ok" }); } }, "Verify Services"),
      slice.failedJobs.length > 0
        ? h("button", { type: "button", class: "btn btn--primary", disabled: !canOperateInfra, onClick: () => { const count = retryAllFailedJobs(); showToast(`Retried and resolved ${count} failed BullMQ jobs`, { tone: "ok" }); } }, `Retry All Failed (${slice.failedJobs.length})`)
        : null
    )
  );

  const servicesGrid = h(
    "section",
    { class: "grid-kpi", "aria-label": "Core infrastructure services" },
    ...snap.infraServices.map((svc) =>
      h(
        "article",
        { class: "card kpi-card" },
        h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, svc.name), createStatusPill(svc.status, "ok")),
        h("div", { class: "kpi-value", style: "font-size:1.25rem;" }, svc.metric),
        h("span", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, svc.detail)
      )
    )
  );

  const queuesTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "queues-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "queues-caption" }, "BullMQ Worker Queues"),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Queue Name"), h("th", { scope: "col" }, "Active"), h("th", { scope: "col" }, "Waiting"), h("th", { scope: "col" }, "Completed (24h)"), h("th", { scope: "col" }, "Failed"), h("th", { scope: "col" }, "State"), h("th", { scope: "col" }, "Control"))),
      h(
        "tbody",
        {},
        ...snap.bullQueues.map((q) =>
          h(
            "tr",
            {},
            h("th", { scope: "row", class: "mono" }, q.name),
            h("td", { dataset: { label: "Active" }, class: "mono" }, String(q.active)),
            h("td", { dataset: { label: "Waiting" }, class: "mono" }, String(q.waiting)),
            h("td", { dataset: { label: "24h" }, class: "mono" }, formatNumber(q.completed24h)),
            h("td", { dataset: { label: "Failed" }, class: "mono" }, q.failed > 0 ? createStatusPill(String(q.failed), "err") : "0"),
            h("td", { dataset: { label: "State" } }, createStatusPill(q.paused ? "Paused" : "Running", q.paused ? "warn" : "ok")),
            h("td", { dataset: { label: "Control" } }, h("button", { type: "button", class: "btn btn--subtle btn--sm", disabled: !canOperateInfra, onClick: () => { toggleQueuePaused(q.id); showToast(`${q.name} ${q.paused ? "resumed" : "paused"}`, { tone: "info" }); } }, q.paused ? "Resume" : "Pause"))
          )
        )
      )
    )
  );

  const failedJobsPanel = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "failed-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "failed-caption" }, `Failed Jobs Dead-Letter Queue (${slice.failedJobs.length})`),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Job ID"), h("th", { scope: "col" }, "Queue"), h("th", { scope: "col" }, "Payload"), h("th", { scope: "col" }, "Error Excerpt"), h("th", { scope: "col" }, "Attempts"), h("th", { scope: "col" }, "Action"))),
      h(
        "tbody",
        {},
        ...(slice.failedJobs.length
          ? slice.failedJobs.map((job) =>
              h(
                "tr",
                {},
                h("th", { scope: "row", class: "mono" }, job.id),
                h("td", { dataset: { label: "Queue" }, class: "mono" }, job.queue),
                h("td", { dataset: { label: "Payload" } }, job.payload),
                h("td", { dataset: { label: "Error" }, style: "max-inline-size:320px;color:var(--status-err);font-size:var(--text-xs);" }, job.error),
                h("td", { dataset: { label: "Attempts" }, class: "mono" }, `${job.attempts} · ${job.failedAt}`),
                h("td", { dataset: { label: "Action" } }, h("button", { type: "button", class: "btn btn--primary btn--sm", disabled: !canOperateInfra, onClick: () => { retryFailedJob(job.id); showToast(`Retried & resolved ${job.id} (${job.queue})`, { tone: "ok" }); } }, "Retry Job"))
              )
            )
          : [h("tr", {}, h("td", { colspan: "6", style: "text-align:center;padding:1.25rem;" }, createStatusPill("Zero failed jobs in dead-letter queue", "ok")))])
      )
    )
  );

  const osIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const prefsCard = h(
    "section",
    { class: "card" },
    h("h2", { class: "card-title" }, "Appearance & Workspace Controls"),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;" },
      h(
        "div",
        { style: "display:flex;flex-direction:column;gap:0.35rem;" },
        h("span", { class: "field-label" }, "Color Scheme Preference"),
        h(
          "div",
          { class: "filter-bar", role: "group", "aria-label": "Select color scheme preference" },
          ...[
            { id: "system", label: `System (Currently ${osIsDark ? "dark" : "light"})` },
            { id: "dark", label: "Dark" },
            { id: "light", label: "Light" }
          ].map((opt) =>
            h(
              "button",
              {
                type: "button",
                class: "filter-pill",
                "aria-pressed": String(storedScheme === opt.id),
                onClick: () => {
                  applyScheme(opt.id === "system" ? null : opt.id);
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              },
              opt.label
            )
          )
        )
      ),
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => { resetState(); showToast("Restored initial GodFlow multi-tenant dataset", { tone: "info" }); } }, "Reset Demo Dataset")
    )
  );

  // Platform Plugins Grid
  const pluginsSection = h(
    "section",
    { class: "card", style: "gap:0.75rem;" },
    h("div", { class: "card-header" },
      h("h2", { class: "card-title" }, `Suite Plugins & Modules (${(pd.suitePlugins ?? []).filter((p) => p.enabled).length}/${(pd.suitePlugins ?? []).length} Active)`),
      createStatusPill(canConfigurePlugins ? "Master / Maintenance Controls Enabled" : "Read-Only Inspect", canConfigurePlugins ? "ok" : "info")
    ),
    h(
      "div",
      { class: "grid-3" },
      ...(pd.suitePlugins ?? []).map((plg) =>
        h(
          "article",
          { class: "card", style: `background:var(--bg-canvas);${plg.enabled ? "" : "opacity:0.75;"}` },
          h("div", { class: "card-header" },
            h("div", {},
              h("strong", { style: "font-size:var(--text-sm);" }, plg.name),
              h("div", { class: "mono-meta" }, `${plg.category} · ${plg.version}`)
            ),
            createStatusPill(plg.enabled ? "Enabled" : "Disabled", plg.enabled ? "ok" : "warn")
          ),
          h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, plg.description),
          h("div", { class: "mono-meta truncate" }, plg.endpoint),
          h("div", { class: "mono-meta" }, plg.configSummary),
          h("div", { class: "kpi-foot", style: "margin-top:auto;" },
            createStatusPill(plg.health, plg.health.includes("Degraded") || !plg.enabled ? "warn" : "ok"),
            h(
              "button",
              {
                type: "button",
                class: plg.enabled ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
                disabled: !canConfigurePlugins,
                onClick: () => {
                  toggleSuitePlugin(plg.id);
                  showToast(`${plg.name} ${plg.enabled ? "disabled" : "enabled"}`, { tone: "info" });
                }
              },
              plg.enabled ? "Disable" : "Enable"
            )
          )
        )
      )
    )
  );

  // Suite Configurations + Platform Integrations
  const suiteConfigPane = h(
    "section",
    { class: "card" },
    h("div", { class: "card-header" },
      h("h2", { class: "card-title" }, "Global Suite Configurations"),
      createStatusPill(canConfigurePlugins ? "Configurable" : "Locked", canConfigurePlugins ? "ok" : "warn")
    ),
    h(
      "ul",
      { class: "feed-list" },
      ...(pd.suiteConfigs ?? []).map((cfg) =>
        h(
          "li",
          { class: "feed-row" },
          h("div", { class: "feed-row-main" },
            h("strong", { style: "font-size:var(--text-xs);" }, cfg.label),
            h("span", { class: "mono-meta" }, cfg.detail)
          ),
          cfg.type === "toggle"
            ? h(
                "button",
                {
                  type: "button",
                  class: cfg.value ? "btn btn--primary btn--sm" : "btn btn--subtle btn--sm",
                  disabled: !canConfigurePlugins,
                  "aria-pressed": String(Boolean(cfg.value)),
                  onClick: () => {
                    toggleSuiteConfig(cfg.key);
                    showToast(`Updated ${cfg.label}`, { tone: "info" });
                  }
                },
                cfg.value ? "ON" : "OFF"
              )
            : h("input", {
                type: "number",
                class: "input input--mono",
                style: "max-inline-size:110px;",
                value: String(cfg.value),
                disabled: !canConfigurePlugins,
                "aria-label": cfg.label,
                onChange: (e) => {
                  updateSuiteConfigValue(cfg.key, Number(e.target.value) || 1024);
                  showToast(`Updated ${cfg.label} → ${e.target.value}`, { tone: "ok" });
                }
              })
        )
      )
    )
  );

  const integrationsPane = h(
    "section",
    { class: "card" },
    h("div", { class: "card-header" },
      h("h2", { class: "card-title" }, "Platform Integrations & Relays"),
      createStatusPill("Real-Time Bus", "ok")
    ),
    h(
      "ul",
      { class: "feed-list" },
      ...(pd.integrationsStatus ?? []).map((it) =>
        h(
          "li",
          { class: "feed-row" },
          h("div", { class: "feed-row-main" },
            h("strong", { style: "font-size:var(--text-xs);" }, it.name),
            h("span", { class: "mono-meta" }, `${it.latency} · ${it.syncedTenants} synced tenants`)
          ),
          createStatusPill(it.status, "ok")
        )
      )
    )
  );

  // Live Active Users Telemetry
  const liveWatchers = ctx.isPlatformOperator
    ? (snap.activeWatchers ?? [])
    : slice.activeWatchers;

  const liveUsersTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "live-users-cap" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "live-users-cap" }, `Live Users Telemetry (${liveWatchers.filter((w) => w.running).length} Live / ${liveWatchers.length} Tracked)`),
      h("thead", {},
        h("tr", {},
          h("th", { scope: "col" }, "User"),
          h("th", { scope: "col" }, "Role"),
          h("th", { scope: "col" }, "Tenant"),
          h("th", { scope: "col" }, "Channel"),
          h("th", { scope: "col" }, "Active Tool & Session"),
          h("th", { scope: "col" }, "State")
        )
      ),
      h("tbody", {},
        ...liveWatchers.map((w) => {
          const u = snap.users.find((x) => x.id === w.userId);
          const r = ROLES.find((x) => x.id === u?.defaultRoleId);
          const ws = snap.workspaces.find((x) => x.id === w.workspaceId);
          const ch = ws?.channels?.find((x) => x.id === w.channelId);
          const hrs = (w.todaySeconds / 3600).toFixed(2);
          return h(
            "tr",
            {},
            h("th", { scope: "row" }, h("div", {}, u?.name ?? w.userId), h("div", { class: "mono-meta" }, u?.email ?? "")),
            h("td", { dataset: { label: "Role" } }, createStatusPill(r?.badge ?? "USER", r?.tone ?? "info")),
            h("td", { dataset: { label: "Tenant" }, class: "mono" }, ws?.name ?? w.workspaceId),
            h("td", { dataset: { label: "Channel" } }, ch ? ch.name : "Primary"),
            h("td", { dataset: { label: "Tool" } }, h("div", { style: "font-size:var(--text-xs);" }, w.tool), h("div", { class: "mono-meta" }, `${w.taskTitle} (${hrs}h today)`)),
            h("td", { dataset: { label: "State" } }, createStatusPill(w.running ? "Live Now" : "Idle", w.running ? "ok" : "warn"))
          );
        })
      )
    )
  );

  const db = getDbStatus();
  const dbHealthCard = h(
    "section",
    { class: "card", style: "gap:0.65rem;" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "card-title" }, "Embedded SQLite Database Persistence"),
        h("span", { class: "mono-meta" }, `${db.engine} · ${db.dbPath} · Schema v${db.schemaVersion}`)
      ),
      createStatusPill(db.connected ? `SQLite Live · Seeds=${db.seedCount} · Saves=${db.saveCount}` : "Local Cache Mode", db.connected ? "ok" : "warn")
    ),
    db.counts
      ? h("div", { class: "grid-kpi" },
          h("div", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Tenants (DB Rows)"), h("div", { class: "kpi-value" }, String(db.counts.tenants))),
          h("div", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Channels (DB Rows)"), h("div", { class: "kpi-value" }, String(db.counts.channels))),
          h("div", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Tenant Users (DB Rows)"), h("div", { class: "kpi-value" }, String(db.counts.tenantUsers))),
          h("div", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Work Events (DB Rows)"), h("div", { class: "kpi-value" }, String(db.counts.workEvents)))
        )
      : null,
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;justify-content:space-between;" },
      h("span", { class: "mono-meta" }, db.updatedAt ? `Last written to SQLite: ${db.updatedAt}` : "Seeds once on first server startup; persisted across browser & server restarts."),
      h("button", {
        type: "button",
        class: "btn btn--subtle btn--sm",
        onClick: async () => {
          const ok = await hydrateStateFromSqlite();
          showToast(ok ? "Reloaded persistent state from SQLite database" : "Using browser local cache", { tone: ok ? "ok" : "info" });
        }
      }, "Reload from SQLite DB")
    )
  );

  return [header, dbHealthCard, servicesGrid, pluginsSection, h("div", { class: "split-pane" }, suiteConfigPane, integrationsPane), liveUsersTable, queuesTable, failedJobsPanel, prefsCard];
}
