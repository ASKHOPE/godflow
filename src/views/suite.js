import { createStatusPill, h } from "../lib/dom.js";
import { navigateTo } from "../lib/router.js";
import {
  can,
  enterSandboxWorkingCopy,
  getActiveContext,
  getState,
  getTenantModuleStatus,
  promoteModuleVersion,
  releaseNextModuleVersion,
  rolloutModuleUpgradeToAllTenants,
  setTenantAllModulesTrack,
  setTenantModuleTrack,
  toggleModuleGlobalEnabled,
  toggleSuiteConfig,
  toggleSuitePlugin,
  toggleTenantModuleAutoUpgrade,
  toggleTenantModuleEnabled,
  updateSuiteConfigValue,
  updateSuiteModuleConfig
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let activeSuiteTab = "catalog"; // "catalog" | "tenants" | "config"
let selectedTenantId = "all";
let releaseNotesDraft = {};

export function renderSuite() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const pd = snap.platformData;
  const modules = pd.suiteModules ?? [];
  const canManageSuite = can("suite:write", snap);
  const canManageTenantSubs = canManageSuite || ctx.isGodMode || ctx.role.id === "tenant_admin";
  const visibleTenants = ctx.isPlatformOperator
    ? snap.workspaces
    : snap.workspaces.filter((w) => w.id === ctx.workspace.id);

  if (selectedTenantId !== "all" && !visibleTenants.some((w) => w.id === selectedTenantId)) {
    selectedTenantId = visibleTenants[0]?.id ?? "all";
  }

  let pendingUpgrades = 0;
  let expCount = 0;
  let curCount = 0;
  let ltsCount = 0;
  for (const ws of visibleTenants) {
    for (const mod of modules) {
      const st = getTenantModuleStatus(mod.id, ws.id, snap);
      if (!st || !st.enabled) continue;
      if (st.track === "experimental") expCount += 1;
      else if (st.track === "lts") ltsCount += 1;
      else curCount += 1;
      if (st.upgradeAvailable) pendingUpgrades += 1;
    }
  }

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Suite — 3-Version Modules & Tenant Rollouts"),
      h("p", { class: "page-subtitle" }, "Assign modules per tenant requirement, ship updates across Experimental / Current (Subscribed) / LTS (Stable), and propagate site-wide live.")
    ),
    h(
      "div",
      { class: "page-actions" },
      !ctx.isSandbox
        ? h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle",
              onClick: () => {
                enterSandboxWorkingCopy({ label: "Suite Rollout Sandbox", workspaceId: ctx.workspace.id });
                showToast("Entered Sandbox Working Copy — test module upgrades without affecting production!", { tone: "warn" });
              }
            },
            "Test Upgrades in Sandbox Copy"
          )
        : createStatusPill(`SANDBOX COPY (${ctx.sandboxChangesCount} edits)`, "warn"),
      h("a", { href: "/subscriptions", class: "btn btn--subtle" }, "Manage Subscriptions →")
    )
  );

  const kpis = h(
    "section",
    { class: "grid-kpi", "aria-label": "Suite release metrics" },
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Suite Modules"), createStatusPill("3 VERSION TRACKS", "info")), h("div", { class: "kpi-value" }, String(modules.length)), h("span", { class: "mono-meta" }, `${modules.filter((m) => m.enabledGlobally !== false).length} globally active`)),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "New Experimental Installs"), createStatusPill("EXP", "warn")), h("div", { class: "kpi-value" }, String(expCount)), h("span", { class: "mono-meta" }, "Cutting-edge beta features")),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Current (Subscribed) Installs"), createStatusPill("CURRENT", "ok")), h("div", { class: "kpi-value" }, String(curCount)), h("span", { class: "mono-meta" }, `${pendingUpgrades} pending rollout updates`)),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "LTS (Stable) Installs"), createStatusPill("LTS STABLE", "info")), h("div", { class: "kpi-value" }, String(ltsCount)), h("span", { class: "mono-meta" }, "Long-term frozen releases"))
  );

  const tabBar = h(
    "div",
    { class: "suite-tablist", role: "tablist", "aria-label": "Suite management views" },
    ...[
      { id: "catalog", label: `1. Modules & 3 Release Tracks (${modules.length})` },
      { id: "tenants", label: `2. Assign to Tenants (${visibleTenants.length})` },
      { id: "config", label: "3. Global Plugins & Configs" }
    ].map((t) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          class: "suite-tab",
          "aria-selected": String(activeSuiteTab === t.id),
          onClick: () => {
            activeSuiteTab = t.id;
            window.dispatchEvent(new CustomEvent("godflow:rerender"));
          }
        },
        t.label
      )
    )
  );

  let tabBody = [];

  if (activeSuiteTab === "catalog") {
    tabBody = modules.map((mod) => {
      const subStatuses = visibleTenants.map((ws) => getTenantModuleStatus(mod.id, ws.id, snap));
      const pendingTenants = subStatuses.filter((s) => s?.enabled && s.upgradeAvailable).length;
      const trackCounts = {
        experimental: subStatuses.filter((s) => s?.enabled && s.track === "experimental").length,
        current: subStatuses.filter((s) => s?.enabled && s.track === "current").length,
        lts: subStatuses.filter((s) => s?.enabled && s.track === "lts").length
      };

      const globalSwitch = h("input", {
        type: "checkbox",
        switch: true,
        id: `mod-global-${mod.id}`,
        checked: mod.enabledGlobally !== false,
        disabled: !canManageSuite,
        onChange: () => {
          toggleModuleGlobalEnabled(mod.id);
          showToast(`${mod.name} ${mod.enabledGlobally !== false ? "disabled" : "enabled"} globally across site`, { tone: "warn" });
        }
      });

      const noteIn = h("input", {
        type: "text",
        class: "input",
        value: releaseNotesDraft[mod.id] || "",
        placeholder: "Optional release feature note before pushing update...",
        disabled: !canManageSuite,
        style: "max-inline-size:320px;",
        onInput: (e) => {
          releaseNotesDraft[mod.id] = e.target.value;
        }
      });

      return h(
        "article",
        { class: "card", style: mod.enabledGlobally === false ? "opacity:0.78;border-color:var(--status-warn);" : "" },
        h(
          "div",
          { class: "card-header" },
          h(
            "div",
            {},
            h("div", { style: "display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;" },
              h("h2", { class: "card-title", style: "font-size:var(--text-base);" }, mod.name),
              h("span", { class: "badge" }, mod.category),
              createStatusPill(mod.enabledGlobally !== false ? "ACTIVE" : "DISABLED GLOBALLY", mod.enabledGlobally !== false ? "ok" : "warn")
            ),
            h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, `${mod.description} · Propagates to routes: ${mod.affectedRoutes.map((r) => `/${r}`).join(", ")}`)
          ),
          h(
            "label",
            { class: "switch-label", for: `mod-global-${mod.id}` },
            h("span", { class: "mono-meta" }, "Global"),
            globalSwitch
          )
        ),
        h(
          "div",
          { class: "grid-3" },
          ...["experimental", "current", "lts"].map((trackKey) => {
            const meta = mod.versions[trackKey];
            const tone = trackKey === "experimental" ? "warn" : trackKey === "lts" ? "info" : "ok";
            return h(
              "div",
              { class: "card", style: `background:var(--bg-canvas);padding:0.8rem;gap:0.5rem;border-color:${trackKey === "experimental" ? "var(--status-warn)" : trackKey === "current" ? "var(--status-ok)" : "var(--border-control)"};` },
              h("div", { class: "card-header" },
                createStatusPill(meta.label, tone),
                h("strong", { class: "mono", style: "font-size:var(--text-xs);" }, `v${meta.version}`)
              ),
              h("span", { class: "mono-meta" }, `Released ${meta.releasedAt} · ${trackCounts[trackKey]} subscribed tenant(s)`),
              h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, meta.summary),
              h("ul", { style: "margin:0;padding-inline-start:1rem;font-size:0.72rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.15rem;" },
                ...(meta.features ?? []).map((f) => h("li", {}, f))
              ),
              canManageSuite
                ? h(
                    "div",
                    { style: "display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:auto;padding-top:0.35rem;" },
                    h(
                      "button",
                      {
                        type: "button",
                        class: "btn btn--subtle btn--sm",
                        onClick: () => {
                          const res = releaseNextModuleVersion(mod.id, trackKey, (releaseNotesDraft[mod.id] || "").trim());
                          releaseNotesDraft[mod.id] = "";
                          if (res) showToast(`Shipped ${mod.name} ${trackKey} v${res.version} (auto-upgraded ${res.upgradedTenants} tenants)`, { tone: "ok" });
                        }
                      },
                      `+ Push ${trackKey === "experimental" ? "Exp" : trackKey === "current" ? "Current" : "LTS"} Update`
                    ),
                    trackKey === "experimental"
                      ? h(
                          "button",
                          {
                            type: "button",
                            class: "btn btn--ghost btn--sm",
                            onClick: () => {
                              const res = promoteModuleVersion(mod.id, "experimental", "current");
                              if (res) showToast(`Promoted Experimental → Current v${res.version}`, { tone: "ok" });
                            }
                          },
                          "Promote → Current"
                        )
                      : trackKey === "current"
                        ? h(
                            "button",
                            {
                              type: "button",
                              class: "btn btn--ghost btn--sm",
                              onClick: () => {
                                const res = promoteModuleVersion(mod.id, "current", "lts");
                                if (res) showToast(`Promoted Current → LTS v${res.version}`, { tone: "ok" });
                              }
                            },
                            "Promote → LTS"
                          )
                        : null
                  )
                : null
            );
          })
        ),
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.65rem;padding-top:0.35rem;border-top:1px solid var(--border-subtle);" },
          h("div", { style: "display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;" },
            noteIn,
            h("span", { class: "mono-meta" }, pendingTenants > 0 ? `${pendingTenants} tenant(s) awaiting manual upgrade` : "All auto-upgrade tenants synced")
          ),
          h(
            "div",
            { style: "display:flex;gap:0.4rem;flex-wrap:wrap;" },
            canManageSuite
              ? h(
                  "button",
                  {
                    type: "button",
                    class: pendingTenants > 0 ? "btn btn--primary btn--sm" : "btn btn--subtle btn--sm",
                    onClick: () => {
                      const n = rolloutModuleUpgradeToAllTenants(mod.id, "all");
                      showToast(`Upgraded ${n} pending tenant subscription(s) for ${mod.name}`, { tone: "ok" });
                    }
                  },
                  pendingTenants > 0 ? `Upgrade ${pendingTenants} Pending Tenants Now` : "Verify Rollout Sync"
                )
              : null,
            h(
              "button",
              {
                type: "button",
                class: "btn btn--ghost btn--sm",
                onClick: () => {
                  activeSuiteTab = "tenants";
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              },
              "Assign Per-Tenant Versions →"
            )
          )
        )
      );
    });
  } else if (activeSuiteTab === "tenants") {
    const shownTenants = selectedTenantId === "all" ? visibleTenants : visibleTenants.filter((w) => w.id === selectedTenantId);

    const filterCard = h(
      "section",
      { class: "card", style: "padding:0.85rem 1rem;" },
      h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;" },
        h("div", { style: "display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;" },
          h("label", { class: "field-label", for: "suite-ws-filter" }, "Filter Tenant"),
          h(
            "select",
            {
              id: "suite-ws-filter",
              class: "select",
              onChange: (e) => {
                selectedTenantId = e.target.value;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            },
            ...(visibleTenants.length > 1 ? [h("option", { value: "all", selected: selectedTenantId === "all" }, `All Tenants (${visibleTenants.length})`)] : []),
            ...visibleTenants.map((w) => h("option", { value: w.id, selected: selectedTenantId === w.id }, `${w.name} (${w.plan})`))
          )
        ),
        shownTenants.length === 1 && canManageTenantSubs
          ? h(
              "div",
              { style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;" },
              h("span", { class: "mono-meta" }, "Bulk Set Release Track:"),
              ...["experimental", "current", "lts"].map((tr) =>
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => {
                      setTenantAllModulesTrack(shownTenants[0].id, tr);
                      showToast(`Updated all modules for ${shownTenants[0].name} → ${tr.toUpperCase()}`, { tone: "ok" });
                    }
                  },
                  tr === "experimental" ? "All Experimental" : tr === "current" ? "All Current" : "All LTS Stable"
                )
              )
            )
          : null
      )
    );

    const tenantCards = shownTenants.map((ws) =>
      h(
        "section",
        { class: "card", style: "gap:0.85rem;" },
        h("div", { class: "card-header" },
          h("div", {},
            h("h2", { class: "card-title" }, `${ws.name} — Module Assignments & Version Tracks`),
            h("span", { class: "mono-meta" }, `${ws.domain} · ${ws.plan} · Changes upgrade this tenant's Studio, Calendar, Hub & Growth tools live`)
          ),
          canManageTenantSubs
            ? h(
                "div",
                { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
                h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => { setTenantAllModulesTrack(ws.id, "lts"); showToast(`${ws.name} pinned to LTS Stable`, { tone: "info" }); } }, "Pin All LTS"),
                h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => { setTenantAllModulesTrack(ws.id, "current"); showToast(`${ws.name} pinned to Current Subscribed`, { tone: "ok" }); } }, "Pin All Current"),
                h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { setTenantAllModulesTrack(ws.id, "experimental"); showToast(`${ws.name} opted into New Experimental`, { tone: "warn" }); } }, "Opt-In Experimental")
              )
            : null
        ),
        h(
          "div",
          { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": `suite-cap-${ws.id}` },
          h(
            "table",
            { class: "data-table" },
            h("caption", { id: `suite-cap-${ws.id}` }, `${ws.name} Subscribed Suite Modules`),
            h("thead", {},
              h("tr", {},
                h("th", { scope: "col" }, "Module"),
                h("th", { scope: "col" }, "Assigned"),
                h("th", { scope: "col" }, "Release Track"),
                h("th", { scope: "col" }, "Running Version"),
                h("th", { scope: "col" }, "Auto-Upgrade"),
                h("th", { scope: "col" }, "Live Routes")
              )
            ),
            h("tbody", {},
              ...modules.map((mod) => {
                const st = getTenantModuleStatus(mod.id, ws.id, snap);
                const assignChk = h("input", {
                  type: "checkbox",
                  switch: true,
                  "aria-label": `Assign ${mod.name} to ${ws.name}`,
                  checked: st.tenantEnabled,
                  disabled: !canManageTenantSubs,
                  onChange: () => {
                    toggleTenantModuleEnabled(ws.id, mod.id);
                    showToast(`${ws.name}: ${mod.name} ${st.tenantEnabled ? "removed" : "assigned"}`, { tone: "info" });
                  }
                });

                const trackSel = h(
                  "select",
                  {
                    class: "select",
                    "aria-label": `Release track for ${mod.name} on ${ws.name}`,
                    disabled: !canManageTenantSubs || !st.tenantEnabled,
                    onChange: (e) => {
                      setTenantModuleTrack(ws.id, mod.id, e.target.value);
                      const nextVer = mod.versions?.[e.target.value]?.version;
                      showToast(`${ws.name} upgraded ${mod.name} → ${e.target.value.toUpperCase()} (v${nextVer})`, { tone: "ok" });
                    }
                  },
                  h("option", { value: "experimental", selected: st.track === "experimental" }, `New Experimental (v${mod.versions.experimental.version})`),
                  h("option", { value: "current", selected: st.track === "current" }, `Current Subscribed (v${mod.versions.current.version})`),
                  h("option", { value: "lts", selected: st.track === "lts" }, `LTS Stable (v${mod.versions.lts.version})`)
                );

                const autoChk = h("input", {
                  type: "checkbox",
                  switch: true,
                  "aria-label": `Auto upgrade ${mod.name} on ${ws.name}`,
                  checked: st.autoUpgrade,
                  disabled: !canManageTenantSubs || !st.tenantEnabled,
                  onChange: () => {
                    toggleTenantModuleAutoUpgrade(ws.id, mod.id);
                  }
                });

                return h(
                  "tr",
                  {},
                  h("th", { scope: "row" },
                    h("div", {}, mod.name),
                    h("span", { class: "mono-meta" }, mod.category)
                  ),
                  h("td", { dataset: { label: "Assigned" } }, assignChk),
                  h("td", { dataset: { label: "Track" } }, trackSel),
                  h("td", { dataset: { label: "Version" } },
                    h("div", { style: "display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;" },
                      createStatusPill(st.enabled ? `v${st.installedVersion}` : "UNASSIGNED", st.enabled ? st.tone : "warn"),
                      st.upgradeAvailable && st.enabled
                        ? h("button", {
                            type: "button",
                            class: "btn btn--primary btn--sm",
                            onClick: () => {
                              setTenantModuleTrack(ws.id, mod.id, st.track);
                              showToast(`Upgraded ${mod.name} on ${ws.name} → v${st.availableVersion}`, { tone: "ok" });
                            }
                          }, `Upgrade → v${st.availableVersion}`)
                        : null
                    )
                  ),
                  h("td", { dataset: { label: "Auto-Upgrade" } }, autoChk),
                  h("td", { dataset: { label: "Routes" }, class: "mono-meta" }, mod.affectedRoutes.map((r) => `/${r}`).join(", "))
                );
              })
            )
          )
        )
      )
    );

    tabBody = [filterCard, ...tenantCards];
  } else {
    // Config & Plugins
    tabBody = [
      h(
        "section",
        { class: "split-pane" },
        h(
          "article",
          { class: "card", style: "gap:0.75rem;" },
          h("div", { class: "card-header" },
            h("h2", { class: "card-title" }, "Per-Module Runtime Configurations"),
            createStatusPill("Live Propagation", "info")
          ),
          ...modules.map((mod) =>
            h("div", { style: "padding:0.65rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:0.45rem;" },
              h("div", { style: "display:flex;justify-content:space-between;align-items:center;" },
                h("strong", { style: "font-size:var(--text-xs);" }, mod.name),
                h("span", { class: "mono-meta" }, mod.category)
              ),
              h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;" },
                ...Object.entries(mod.config ?? {}).map(([cfgKey, cfgVal]) =>
                  typeof cfgVal === "boolean"
                    ? h("button", {
                        type: "button",
                        class: "filter-pill",
                        "aria-pressed": String(cfgVal),
                        disabled: !canManageSuite,
                        onClick: () => {
                          updateSuiteModuleConfig(mod.id, cfgKey, !cfgVal);
                          showToast(`${mod.name}: ${cfgKey} = ${!cfgVal}`, { tone: "info" });
                        }
                      }, `${cfgKey}: ${cfgVal ? "ON" : "OFF"}`)
                    : h("label", { style: "display:inline-flex;align-items:center;gap:0.35rem;font-size:var(--text-xs);" },
                        h("span", { class: "mono-meta" }, `${cfgKey}:`),
                        h("input", {
                          type: typeof cfgVal === "number" ? "number" : "text",
                          class: "input",
                          value: String(cfgVal),
                          disabled: !canManageSuite,
                          style: "max-inline-size:110px;",
                          onChange: (e) => {
                            const next = typeof cfgVal === "number" ? Number(e.target.value) : e.target.value;
                            updateSuiteModuleConfig(mod.id, cfgKey, next);
                          }
                        })
                      )
                )
              )
            )
          )
        ),
        h(
          "article",
          { class: "card", style: "gap:0.75rem;" },
          h("div", { class: "card-header" },
            h("h2", { class: "card-title" }, "Core Platform Plugins & Global Policies"),
            h("a", { href: "/system", class: "btn btn--ghost btn--sm" }, "System Telemetry →")
          ),
          ...(pd.suitePlugins ?? []).map((plg) =>
            h("div", { class: "feed-row" },
              h("div", { class: "feed-row-main" },
                h("strong", { style: "font-size:var(--text-xs);" }, `${plg.name} (${plg.version})`),
                h("span", { class: "mono-meta" }, `${plg.health} · ${plg.configSummary}`)
              ),
              h("button", {
                type: "button",
                class: plg.enabled ? "btn btn--primary btn--sm" : "btn btn--subtle btn--sm",
                disabled: !canManageSuite,
                onClick: () => toggleSuitePlugin(plg.id)
              }, plg.enabled ? "ON" : "OFF")
            )
          ),
          h("div", { class: "filter-bar", style: "padding-top:0.25rem;" },
            ...(pd.suiteConfigs ?? []).map((cfg) =>
              cfg.type === "toggle"
                ? h("button", {
                    type: "button",
                    class: "filter-pill",
                    "aria-pressed": String(Boolean(cfg.value)),
                    disabled: !canManageSuite,
                    onClick: () => toggleSuiteConfig(cfg.key)
                  }, `${cfg.label}: ${cfg.value ? "ON" : "OFF"}`)
                : h("label", { style: "display:inline-flex;align-items:center;gap:0.4rem;" },
                    h("span", { class: "mono-meta" }, `${cfg.label}:`),
                    h("input", {
                      type: "number",
                      class: "input",
                      value: String(cfg.value),
                      disabled: !canManageSuite,
                      style: "max-inline-size:100px;",
                      onChange: (e) => updateSuiteConfigValue(cfg.key, Number(e.target.value) || 1024)
                    })
                  )
            )
          )
        )
      )
    ];
  }

  return [header, kpis, tabBar, ...tabBody];
}
