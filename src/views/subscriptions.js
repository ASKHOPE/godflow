import { ROLES } from "../data/seed.js";
import { openChannelWebsiteModal, openInviteMemberModal, openNewChannelModal, openNewWorkspaceModal } from "../components/modal.js";
import { createStatusPill, formatCurrency, formatNumber, h } from "../lib/dom.js";
import { navigateTo } from "../lib/router.js";
import {
  assignUserTeamAndChannels,
  can,
  convertLeadToTenant,
  drillIntoChannel,
  drillIntoTenant,
  drillIntoUser,
  enterSandboxWorkingCopy,
  getActiveContext,
  getState,
  getTenantModuleStatus,
  getTenantTeams,
  toggleUserSuspended,
  toggleWorkspaceSuspended,
  updateMemberRole,
  updateTenantCommercials
} from "../lib/store.js";
import { formatPlanPrice } from "../lib/workbench-helpers.js";
import { showToast } from "../lib/toast.js";

let activeSubTab = "tenants"; // "tenants" | "users" | "leads"
let subSearch = "";
let userWsFilter = "all";

export function renderSubscriptions() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const pd = snap.platformData;
  const isMaster = ctx.isUltimateMaster;
  const canSuspend = can("tenants:suspend", snap);
  const canEditUsers = isMaster || ctx.isGodMode || ctx.role.id === "tenant_admin";

  const scopedWorkspaces = ctx.isPlatformOperator
    ? snap.workspaces
    : snap.workspaces.filter((w) => w.id === ctx.workspace.id);

  if (userWsFilter !== "all" && !scopedWorkspaces.some((w) => w.id === userWsFilter)) {
    userWsFilter = scopedWorkspaces[0]?.id ?? "all";
  }

  const allTenantUsers = snap.users.filter((u) => u.userScope !== "platform");
  const scopedUsers = allTenantUsers.filter((u) =>
    userWsFilter === "all"
      ? scopedWorkspaces.some((w) => u.workspaceIds.includes(w.id))
      : u.workspaceIds.includes(userWsFilter)
  );
  const platformUsers = snap.users.filter((u) => u.userScope === "platform");
  const tenantRoles = ROLES.filter((r) => r.scope === "tenant");
  const totalMrr = scopedWorkspaces.reduce(
    (s, w) => s + (w.subscriptionStatus === "Suspended" ? 0 : w.monthlyPriceUsd || 0),
    0
  );

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Manage Subscriptions — Tenants & Users"),
      h("p", { class: "page-subtitle" }, "Centralized SaaS subscriptions, tenant billing tiers, Channels → Teams → Users (with Roles), and seat lifecycle management")
    ),
    h(
      "div",
      { class: "page-actions" },
      isMaster ? h("button", { type: "button", class: "btn btn--primary", onClick: () => openNewWorkspaceModal() }, "+ Provision New Tenant") : null,
      canEditUsers ? h("button", { type: "button", class: "btn btn--subtle", onClick: () => openInviteMemberModal() }, "+ Invite Tenant User") : null,
      h("a", { href: "/suite", class: "btn btn--subtle" }, "Suite Modules (3 Tracks) →"),
      h("a", { href: "/emulate", class: "btn btn--ghost" }, "Emulate Sandbox →")
    )
  );

  const kpis = h(
    "section",
    { class: "grid-kpi", "aria-label": "Subscription and seat metrics" },
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Subscribed SaaS MRR"), createStatusPill(isMaster ? "MASTER BILLING" : "TENANT PLAN", "ok")), h("div", { class: "kpi-value" }, formatCurrency(totalMrr)), h("span", { class: "mono-meta" }, `${scopedWorkspaces.filter((w) => w.subscriptionStatus !== "Suspended").length}/${scopedWorkspaces.length} active plans`)),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Managed Tenants"), createStatusPill(`${scopedWorkspaces.reduce((s, w) => s + (w.channels?.length || 1), 0)} Channels`, "info")), h("div", { class: "kpi-value" }, String(scopedWorkspaces.length)), h("span", { class: "mono-meta" }, "PG17 isolated tenants")),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Tenant Seats Managed"), createStatusPill("TENANT SCOPED", "ok")), h("div", { class: "kpi-value" }, String(scopedUsers.length)), h("span", { class: "mono-meta" }, `${platformUsers.length} platform operators separated`)),
    h("article", { class: "card kpi-card" }, h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "NewLifeCorp Signups"), createStatusPill(`${(pd.enterpriseLeads ?? []).filter((l) => l.status !== "Live Tenant").length} Pending`, "warn")), h("div", { class: "kpi-value" }, String((pd.enterpriseLeads ?? []).length)), h("span", { class: "mono-meta" }, "From newlifecorp.io portal"))
  );

  const tabBar = h(
    "div",
    { class: "suite-tablist", role: "tablist", "aria-label": "Subscription management sections" },
    ...[
      { id: "tenants", label: `Tenants Management (${scopedWorkspaces.length})` },
      { id: "users", label: `User Management (${scopedUsers.length})` },
      ...(ctx.isPlatformOperator ? [{ id: "leads", label: `Public Registrations & Leads (${(pd.enterpriseLeads ?? []).length})` }] : [])
    ].map((t) =>
      h(
        "button",
        {
          type: "button",
          role: "tab",
          class: "suite-tab",
          "aria-selected": String(activeSubTab === t.id),
          onClick: () => {
            activeSubTab = t.id;
            window.dispatchEvent(new CustomEvent("godflow:rerender"));
          }
        },
        t.label
      )
    )
  );

  if (activeSubTab === "leads" && !ctx.isPlatformOperator) {
    activeSubTab = "tenants";
  }

  let bodyNodes = [];

  if (activeSubTab === "tenants") {
    const q = subSearch.trim().toLowerCase();
    const filteredTenants = scopedWorkspaces.filter(
      (ws) =>
        !q ||
        ws.name.toLowerCase().includes(q) ||
        ws.domain.toLowerCase().includes(q) ||
        (ws.plan || "").toLowerCase().includes(q)
    );

    const searchInput = h("input", {
      id: "sub-tenant-search",
      type: "search",
      class: "input",
      value: subSearch,
      placeholder: "Filter tenants by name, domain, plan...",
      style: "max-inline-size:320px;",
      onInput: (e) => {
        subSearch = e.target.value;
        const pos = e.target.selectionStart ?? subSearch.length;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
        queueMicrotask(() => {
          const el = document.getElementById("sub-tenant-search");
          if (el) {
            el.focus();
            el.setSelectionRange?.(pos, pos);
          }
        });
      }
    });

    bodyNodes = [
      h("section", { class: "card", style: "padding:0.75rem 1rem;" },
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;" },
          h("span", { class: "mono-meta" }, `Showing ${filteredTenants.length} of ${scopedWorkspaces.length} tenants with Channels → Teams → Users & Module subscriptions`),
          searchInput
        )
      ),
      h("div", { class: "grid-2" },
        ...filteredTenants.map((ws) => {
          const teams = getTenantTeams(ws.id, snap);
          const wsUsers = snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id));
          const isSuspended = ws.subscriptionStatus === "Suspended";
          const modStatuses = (pd.suiteModules ?? []).map((m) => getTenantModuleStatus(m.id, ws.id, snap));
          const expModCount = modStatuses.filter((m) => m?.enabled && m.track === "experimental").length;
          const curModCount = modStatuses.filter((m) => m?.enabled && m.track === "current").length;
          const ltsModCount = modStatuses.filter((m) => m?.enabled && m.track === "lts").length;

          const planSel = h(
            "select",
            {
              class: "select",
              "aria-label": `Subscription plan for ${ws.name}`,
              disabled: !canSuspend,
              onChange: (e) => {
                const chosen = pd.saasPlans.find((p) => p.name === e.target.value);
                updateTenantCommercials(ws.id, {
                  plan: e.target.value,
                  monthlyPriceUsd: chosen?.monthlyPriceUsd ?? ws.monthlyPriceUsd,
                  seatLimit: chosen?.seatLimit ?? ws.seatLimit
                });
                showToast(`Updated ${ws.name} plan → ${e.target.value}`, { tone: "ok" });
              }
            },
            ...pd.saasPlans.map((p) => h("option", { value: p.name, selected: p.name === ws.plan }, `${p.name} (${formatPlanPrice(p, { compact: true })})`))
          );

          return h(
            "article",
            { class: "card", style: isSuspended ? "border-color:var(--status-warn);" : "" },
            h("div", { class: "card-header" },
              h("div", {},
                h("h2", { class: "card-title" }, ws.name),
                h("span", { class: "mono-meta" }, `${ws.domain} · ${ws.ownerEmail || "owner@tenant"} · Renews ${ws.renewalDate || "2026-12-25"}`)
              ),
              createStatusPill(ws.subscriptionStatus || "Active", isSuspended ? "warn" : "ok")
            ),
            h("div", { class: "kpi-foot" },
              h("span", { class: "mono-meta" }, `Seats ${wsUsers.length}/${ws.seatLimit} · Storage ${ws.storageUsedGb}/${ws.storageQuotaGb} GB`),
              h("span", { class: "mono-meta" }, `Suite: ${expModCount} EXP · ${curModCount} CUR · ${ltsModCount} LTS`)
            ),
            h("div", { style: "display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;" },
              h("div", { style: "flex:1 1 200px;" }, planSel),
              canSuspend
                ? h("button", {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => {
                      toggleWorkspaceSuspended(ws.id);
                      showToast(`Toggled subscription suspension for ${ws.name}`, { tone: "warn" });
                    }
                  }, isSuspended ? "Reactivate" : "Suspend")
                : null
            ),
            h("div", { style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
              h("div", { style: "display:flex;justify-content:space-between;align-items:center;" },
                h("span", { class: "mono-meta" }, `1. CHANNELS (${(ws.channels ?? []).length})`),
                canEditUsers ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => openNewChannelModal(ws.id) }, "+ Channel") : null
              ),
              h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;" },
                ...(ws.channels ?? []).map((ch) =>
                  h("button", {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => openChannelWebsiteModal(ch.id)
                  }, `${ch.name} (${ch.domain})`)
                )
              )
            ),
            h("div", { style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
              h("span", { class: "mono-meta" }, `2. TEAMS → 3. USERS & ROLES (${teams.length} Teams · ${wsUsers.length} Users)`),
              ...teams.map((tm) =>
                h("div", { style: "padding:0.45rem 0.6rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:0.25rem;" },
                  h("div", { style: "display:flex;justify-content:space-between;align-items:center;" },
                    h("strong", { style: "font-size:var(--text-xs);" }, tm.name),
                    h("span", { class: "mono-meta" }, `${tm.leadUser ? `Lead: ${tm.leadUser.name} · ` : ""}${tm.channels.map((c) => c.name).join(" + ")}`)
                  ),
                  h("div", { style: "display:flex;flex-wrap:wrap;gap:0.25rem;" },
                    ...tm.members.map(({ user, role: mr, unit }) =>
                      h("button", {
                        type: "button",
                        class: "tag",
                        style: "cursor:pointer;",
                        onClick: () => {
                          enterSandboxWorkingCopy({ label: `Testing ${user.name}`, workspaceId: ws.id, userId: user.id, roleId: mr.id });
                          navigateTo("command");
                          showToast(`Emulating ${user.name} [${unit || mr.badge}] in Sandbox Copy`, { tone: "warn" });
                        }
                      }, `${user.name} · ${unit || mr.badge}`)
                    )
                  )
                )
              )
            ),
            h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;justify-content:flex-end;margin-top:auto;padding-top:0.3rem;" },
              h("a", { href: "/suite", class: "btn btn--ghost btn--sm" }, "Modules & Versions"),
              h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => {
                  enterSandboxWorkingCopy({ label: `Sandbox · ${ws.name}`, workspaceId: ws.id });
                  navigateTo("emulate");
                  showToast(`Opened ${ws.name} inside Emulate Sandbox`, { tone: "warn" });
                }
              }, "Test in Sandbox"),
              h("button", {
                type: "button",
                class: "btn btn--primary btn--sm",
                onClick: () => {
                  drillIntoTenant(ws.id);
                  navigateTo("command");
                  showToast(`Entered live tenant: ${ws.name}`, { tone: "ok" });
                }
              }, "Open Tenant →")
            )
          );
        })
      )
    ];
  } else if (activeSubTab === "users") {
    const wsFilterBar = h("section", { class: "card", style: "padding:0.75rem 1rem;" },
      h("div", { style: "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;" },
        h("div", { style: "display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;" },
          h("label", { class: "field-label", for: "sub-user-ws-filter" }, "Filter by Tenant"),
          h(
            "select",
            {
              id: "sub-user-ws-filter",
              class: "select",
              onChange: (e) => {
                userWsFilter = e.target.value;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            },
            ...(scopedWorkspaces.length > 1 ? [h("option", { value: "all", selected: userWsFilter === "all" }, "All Managed Tenants")] : []),
            ...scopedWorkspaces.map((w) => h("option", { value: w.id, selected: userWsFilter === w.id }, w.name))
          )
        ),
        canEditUsers ? h("button", { type: "button", class: "btn btn--primary btn--sm", onClick: () => openInviteMemberModal() }, "+ Invite User Seat") : null
      )
    );

    const userTable = h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "sub-users-cap" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { id: "sub-users-cap" }, `Tenant User Subscriptions (${scopedUsers.length} Users · Strict Tenant Roles Only)`),
        h("thead", {},
          h("tr", {},
            h("th", { scope: "col" }, "User"),
            h("th", { scope: "col" }, "Tenant & Team"),
            h("th", { scope: "col" }, "RBAC Role"),
            h("th", { scope: "col" }, "Seat Status"),
            h("th", { scope: "col" }, "Actions")
          )
        ),
        h("tbody", {},
          ...scopedUsers.map((u) => {
            const targetWsId = userWsFilter !== "all" ? userWsFilter : u.workspaceIds.find((id) => scopedWorkspaces.some((w) => w.id === id)) ?? scopedWorkspaces[0]?.id;
            const targetWs = snap.workspaces.find((w) => w.id === targetWsId);
            const wsTeams = targetWs?.teams ?? [];
            const currentTeam = wsTeams.find((t) => (t.memberIds ?? []).includes(u.id));

            const roleSel = h(
              "select",
              {
                class: "select",
                "aria-label": `Assign role for ${u.name}`,
                disabled: !canEditUsers,
                onChange: (e) => {
                  updateMemberRole(u.id, e.target.value);
                  showToast(`Updated ${u.name} role → ${e.target.value}`, { tone: "ok" });
                }
              },
              ...tenantRoles.map((r) => h("option", { value: r.id, selected: r.id === u.defaultRoleId }, `${r.name} [${r.badge}]`))
            );

            const teamSel = wsTeams.length
              ? h(
                  "select",
                  {
                    class: "select",
                    "aria-label": `Assign team for ${u.name}`,
                    disabled: !canEditUsers,
                    onChange: (e) => {
                      assignUserTeamAndChannels(targetWs.id, u.id, { teamId: e.target.value });
                      showToast(`Assigned ${u.name} to selected team`, { tone: "info" });
                    }
                  },
                  ...wsTeams.map((t) => h("option", { value: t.id, selected: currentTeam?.id === t.id }, t.name))
                )
              : h("span", { class: "mono-meta" }, targetWs?.name ?? "Default Team");

            return h("tr", {},
              h("th", { scope: "row" },
                h("div", {}, u.name),
                h("div", { class: "mono-meta" }, `${u.email} · ${u.title}`)
              ),
              h("td", { dataset: { label: "Team" } },
                h("div", { style: "display:flex;flex-direction:column;gap:0.25rem;" },
                  h("span", { class: "mono-meta" }, targetWs?.name ?? "No tenant"),
                  teamSel
                )
              ),
              h("td", { dataset: { label: "Role" } }, roleSel),
              h("td", { dataset: { label: "Status" } }, createStatusPill(u.suspended ? "Suspended" : "Active Seat", u.suspended ? "warn" : "ok")),
              h("td", { dataset: { label: "Actions" } },
                h("div", { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
                  h("button", {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => {
                      enterSandboxWorkingCopy({ label: `User Sandbox · ${u.name}`, workspaceId: targetWsId, userId: u.id, roleId: u.defaultRoleId });
                      navigateTo("command");
                      showToast(`Emulating ${u.name} in isolated Sandbox Copy`, { tone: "warn" });
                    }
                  }, "Emulate"),
                  canEditUsers
                    ? h("button", {
                        type: "button",
                        class: "btn btn--ghost btn--sm",
                        onClick: () => toggleUserSuspended(u.id)
                      }, u.suspended ? "Restore" : "Suspend")
                    : null
                )
              )
            );
          })
        )
      )
    );

    const platformNote = ctx.isPlatformOperator
      ? h("section", { class: "card", style: "background:var(--bg-subtle);" },
          h("div", { class: "card-header" },
            h("strong", { class: "card-title", style: "font-size:var(--text-sm);" }, "Platform Root Operators (Strictly Separated from Tenant Seats)"),
            createStatusPill("2 ACCOUNTS ONLY", "info")
          ),
          h("div", { style: "display:flex;flex-wrap:wrap;gap:0.45rem;" },
            ...platformUsers.map((pu) => h("span", { class: "tag" }, `${pu.name} (${pu.email}) · ${pu.defaultRoleId}`))
          )
        )
      : null;

    bodyNodes = [wsFilterBar, userTable, ...(platformNote ? [platformNote] : [])];
  } else {
    bodyNodes = [
      h(
        "section",
        { class: "card" },
        h("div", { class: "card-header" },
          h("h2", { class: "card-title" }, "NewLifeCorp Public Onboarding & Sales Pipeline"),
          createStatusPill(`${(pd.enterpriseLeads ?? []).length} Registrations`, "info")
        ),
        h(
          "div",
          { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "sub-leads-cap" },
          h(
            "table",
            { class: "data-table" },
            h("caption", { id: "sub-leads-cap" }, "Self-Serve Public Registrations from newlifecorp.io"),
            h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Company"), h("th", { scope: "col" }, "Owner"), h("th", { scope: "col" }, "Plan"), h("th", { scope: "col" }, "Status"), h("th", { scope: "col" }, "Action"))),
            h("tbody", {},
              ...(pd.enterpriseLeads ?? []).map((ld) =>
                h("tr", {},
                  h("th", { scope: "row" }, h("div", {}, ld.companyName), h("div", { class: "mono-meta" }, ld.domain)),
                  h("td", { dataset: { label: "Owner" } }, `${ld.contactName} (${ld.contactEmail})`),
                  h("td", { dataset: { label: "Plan" }, class: "mono" }, `${ld.planName} · ${ld.monthlyPriceUsd ? `$${ld.monthlyPriceUsd}/mo` : "Custom Quote"}`),
                  h("td", { dataset: { label: "Status" } }, createStatusPill(ld.status, ld.status === "Live Tenant" ? "ok" : "info")),
                  h("td", { dataset: { label: "Action" } },
                    isMaster
                      ? h("button", {
                          type: "button",
                          class: ld.status === "Live Tenant" ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
                          onClick: () => {
                            const id = convertLeadToTenant(ld.id);
                            if (id) {
                              navigateTo("command");
                              showToast(`Provisioned & entered ${ld.companyName}`, { tone: "ok" });
                            }
                          }
                        }, ld.status === "Live Tenant" ? "Open Tenant →" : "Approve & Provision")
                      : h("span", { class: "mono-meta" }, "Master required")
                  )
                )
              )
            )
          )
        )
      )
    ];
  }

  return [header, kpis, tabBar, ...bodyNodes];
}
