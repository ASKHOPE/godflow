import { ROLES } from "../data/seed.js";
import { createStatusPill, h } from "./dom.js";
import { getTenantTeams } from "./store.js";

/**
 * Parses composite dropdown option values formatted as:
 *   - "<scopeWsId>::<userId>"
 *   - "<scopeWsId>::<channelId>::<userId>"
 * while gracefully falling back to plain userId strings.
 */
export function parseCompositeAccountValue(rawVal, fallbackWsId = "__platform__") {
  const val = String(rawVal || "");
  if (val.includes("::")) {
    const parts = val.split("::");
    if (parts.length >= 3) {
      return { wsId: parts[0] || fallbackWsId, channelId: parts[1] || null, userId: parts[2] };
    }
    return { wsId: parts[0] || fallbackWsId, channelId: null, userId: parts[1] };
  }
  return { wsId: fallbackWsId, channelId: null, userId: val };
}

/**
 * Builds `<optgroup>` elements for Scope/Workspace `<select>` controls:
 *   - Optgroup 1: Platform (2 Accounts)
 *   - Optgroup 2: Tenants (all workspaces visible to operator)
 */
export function buildWorkspaceScopeOptgroups({
  snapshot,
  workspaces = null,
  includePlatform = true,
  selectedValue = "__platform__",
  platformLabel = "Master Platform (2 Operators)"
}) {
  const wsList = workspaces ?? snapshot.workspaces ?? [];
  const groups = [];

  if (includePlatform) {
    const platCount = (snapshot.users ?? []).filter((u) => u.userScope === "platform").length;
    groups.push(
      h(
        "optgroup",
        { label: `Platform (${platCount} Accounts)` },
        h(
          "option",
          { value: "__platform__", selected: selectedValue === "__platform__" },
          platformLabel
        )
      )
    );
  }

  if (wsList.length) {
    groups.push(
      h(
        "optgroup",
        { label: `Tenants & Channels (${wsList.length} Tenants)` },
        ...wsList.flatMap((ws, idx) => {
          const isLastWs = idx === wsList.length - 1;
          const branch = isLastWs ? "└─" : "├─";
          const wsUsersCount = (snapshot.users ?? []).filter(
            (u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id)
          ).length;
          const channels = ws.channels ?? [];
          const wsOpt = h(
            "option",
            { value: ws.id, selected: selectedValue === ws.id },
            `${branch} ${ws.name} (${channels.length} ch · ${wsUsersCount} users · ${ws.domain})`
          );
          const chOpts = channels.map((ch, cIdx) => {
            const chVal = `${ws.id}::${ch.id}`;
            const chBranch = cIdx === channels.length - 1 ? "└─" : "├─";
            const prefix = isLastWs ? "   " : "│  ";
            return h(
              "option",
              { value: chVal, selected: selectedValue === chVal },
              `${prefix}${chBranch} Channel: ${ch.name} (${ch.domain})`
            );
          });
          return [wsOpt, ...chOpts];
        })
      )
    );
  }

  return groups;
}

const ROLE_HIERARCHY_RANK = {
  ultimate_master: 0,
  ultimate_maintenance: 1,
  god_mode: 10,
  tenant_admin: 11,
  editor_newsletter: 20,
  podcast_producer: 21,
  video_producer: 22,
  trader_host: 23,
  gaming_creator: 24,
  social_manager: 25,
  music_artist: 26,
  finance_ops: 30,
  guest_viewer: 40
};

function sortByRoleHierarchy(usersList) {
  return [...usersList].sort(
    (a, b) => (ROLE_HIERARCHY_RANK[a.defaultRoleId] ?? 99) - (ROLE_HIERARCHY_RANK[b.defaultRoleId] ?? 99)
  );
}

/**
 * Builds tree-structured `<optgroup>` user lists:
 *   - "__platform__": shows strictly the 2 Platform accounts
 *   - "__tree__": shows Platform (2) first, then each Tenant as its own optgroup containing only that Tenant's users (with composite "<wsId>::<userId>" values)
 *   - "<workspaceId>": shows ONLY that Tenant's users, grouped by Team when teams exist
 */
export function buildUserTreeOptgroups({
  snapshot,
  scopeWsId = "__platform__",
  selectedUserId = null,
  selectedCompositeValue = null,
  compositeValue = false,
  workspaces = null,
  includePlatform = true
}) {
  const users = snapshot.users ?? [];
  const wsList = workspaces ?? snapshot.workspaces ?? [];
  const getRole = (roleId) => ROLES.find((r) => r.id === roleId);
  const groups = [];

  const renderPlatformGroup = () => {
    const platUsers = users.filter((u) => u.userScope === "platform");
    if (!platUsers.length) return;
    groups.push(
      h(
        "optgroup",
        { label: `Platform (${platUsers.length} Accounts)` },
        ...platUsers.map((u, idx) => {
          const branch = idx === platUsers.length - 1 ? "└─" : "├─";
          const role = getRole(u.defaultRoleId);
          const optVal = compositeValue ? `__platform__::${u.id}` : u.id;
          const isSel = selectedCompositeValue
            ? selectedCompositeValue === optVal
            : selectedUserId === u.id;
          return h(
            "option",
            { value: optVal, selected: isSel },
            `${branch} ${u.name} · [${role?.badge ?? "PLATFORM"}]`
          );
        })
      )
    );
  };

  if (scopeWsId === "__platform__") {
    renderPlatformGroup();
    return groups;
  }

  if (scopeWsId === "__tree__") {
    if (includePlatform) renderPlatformGroup();
    for (const ws of wsList) {
      const wsUsers = users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id));
      groups.push(
        h(
          "optgroup",
          { label: `Tenant: ${ws.name} (${wsUsers.length} users)` },
          ...wsUsers.map((u, idx) => {
            const branch = idx === wsUsers.length - 1 ? "└─" : "├─";
            const role = getRole(u.defaultRoleId);
            const optVal = compositeValue ? `${ws.id}::${u.id}` : u.id;
            const isSel = selectedCompositeValue
              ? selectedCompositeValue === optVal
              : selectedUserId === u.id;
            return h(
              "option",
              { value: optVal, selected: isSel },
              `${branch} ${u.name} · [${role?.badge ?? "USER"}]`
            );
          })
        )
      );
    }
    return groups;
  }

  // Specific Tenant Workspace (or Tenant::Channel) Scope -> strictly users in that workspace/channel, ordered by role hierarchy
  const [baseWsId, selectedChannelId] = String(scopeWsId || "").split("::");
  const targetWs = wsList.find((w) => w.id === baseWsId) ?? snapshot.workspaces.find((w) => w.id === baseWsId);
  const selectedChannel = selectedChannelId ? (targetWs?.channels ?? []).find((c) => c.id === selectedChannelId) : null;
  const wsUsers = users.filter((u) => {
    if (u.userScope === "platform" || !u.workspaceIds.includes(baseWsId)) return false;
    if (selectedChannelId && (u.channelIds ?? []).length > 0) {
      return u.channelIds.includes(selectedChannelId);
    }
    return true;
  });
  if (!targetWs || !wsUsers.length) {
    return [
      h(
        "optgroup",
        { label: `Tenant: ${targetWs?.name ?? baseWsId}` },
        h("option", { value: "", disabled: true }, "No users assigned to this tenant")
      )
    ];
  }

  const scopeLabel = selectedChannel ? `${targetWs.name} › ${selectedChannel.name}` : targetWs.name;
  const teams = getTenantTeams(targetWs.id, snapshot);
  const seen = new Set();

  const buildOption = (u, role, idx, total) => {
    const branch = idx === total - 1 ? "└─" : "├─";
    const optVal = compositeValue ? `${scopeWsId}::${u.id}` : u.id;
    const isSel = selectedCompositeValue
      ? selectedCompositeValue === optVal
      : selectedUserId === u.id;
    return h(
      "option",
      { value: optVal, selected: isSel },
      `${branch} ${u.name} · [${role?.badge ?? "USER"}]`
    );
  };

  // Tier 1: Executive & Workspace Leadership (God Mode -> Workspace Admin)
  const leadershipUsers = sortByRoleHierarchy(
    wsUsers.filter((u) => u.defaultRoleId === "god_mode" || u.defaultRoleId === "tenant_admin")
  );
  if (leadershipUsers.length) {
    leadershipUsers.forEach((u) => seen.add(u.id));
    groups.push(
      h(
        "optgroup",
        { label: `${scopeLabel} › 1. Executive & Leadership (${leadershipUsers.length})` },
        ...leadershipUsers.map((u, idx) => buildOption(u, getRole(u.defaultRoleId), idx, leadershipUsers.length))
      )
    );
  }

  // Tier 2: Production Sections (Team Lead first, then sorted by role hierarchy)
  for (const tm of teams) {
    const members = (tm.members ?? [])
      .filter((m) => !seen.has(m.user.id) && wsUsers.some((wu) => wu.id === m.user.id) && m.user.defaultRoleId !== "finance_ops" && m.user.defaultRoleId !== "guest_viewer")
      .sort((a, b) => {
        if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
        return (ROLE_HIERARCHY_RANK[a.user.defaultRoleId] ?? 99) - (ROLE_HIERARCHY_RANK[b.user.defaultRoleId] ?? 99);
      });
    if (!members.length) continue;
    members.forEach((m) => seen.add(m.user.id));
    groups.push(
      h(
        "optgroup",
        { label: `${scopeLabel} › 2. ${tm.name} (${members.length})` },
        ...members.map(({ user: u, role }, idx) => buildOption(u, role, idx, members.length))
      )
    );
  }

  // Tier 3: Finance, Affiliates & External Collaborators
  const opsAndPartners = sortByRoleHierarchy(wsUsers.filter((u) => !seen.has(u.id)));
  if (opsAndPartners.length) {
    groups.push(
      h(
        "optgroup",
        { label: `${scopeLabel} › 3. Finance, Affiliates & Partners (${opsAndPartners.length})` },
        ...opsAndPartners.map((u, idx) => buildOption(u, getRole(u.defaultRoleId), idx, opsAndPartners.length))
      )
    );
  }

  const remaining = wsUsers.filter((u) => !seen.has(u.id));
  if (remaining.length) {
    groups.push(
      h(
        "optgroup",
        { label: `${targetWs.name} · Members (${remaining.length})` },
        ...remaining.map((u, idx) => {
          const branch = idx === remaining.length - 1 ? "└─" : "├─";
          const role = getRole(u.defaultRoleId);
          const optVal = compositeValue ? `${targetWs.id}::${u.id}` : u.id;
          const isSel = selectedCompositeValue
            ? selectedCompositeValue === optVal
            : selectedUserId === u.id;
          return h(
            "option",
            { value: optVal, selected: isSel },
            `${branch} ${u.name} · [${role?.badge ?? "USER"}]`
          );
        })
      )
    );
  }

  return groups;
}

/**
 * Interactive expandable Platform Account Tree UI widget:
 * Root 1: Platform (2 Accounts: Ultimate Master, Ultimate Maintenance)
 * Root 2: Tenants -> Each Tenant -> Teams / Respective Tenant Users with Role Badges
 */
export function createAccountTreeWidget({
  snapshot,
  selectedScopeWsId = "__platform__",
  selectedUserId = null,
  workspaces = null,
  includePlatform = true,
  expandAllTenants = false,
  actionLabel = null,
  onSelectAccount
}) {
  const users = snapshot.users ?? [];
  const wsList = workspaces ?? snapshot.workspaces ?? [];
  const platUsers = users.filter((u) => u.userScope === "platform");
  const getRole = (roleId) => ROLES.find((r) => r.id === roleId);

  const branches = [];

  if (includePlatform && platUsers.length) {
    branches.push(
      h(
        "details",
        { class: "acc-tree-branch", open: true },
        h(
          "summary",
          { class: "acc-tree-summary" },
          h("span", { style: "display:inline-flex;align-items:center;gap:0.45rem;" },
            h("strong", {}, "Platform Root"),
            h("span", { class: "mono-meta" }, "newlifecorp.io")
          ),
          createStatusPill(`${platUsers.length} Accounts`, "warn")
        ),
        h(
          "ul",
          { class: "acc-tree-list", role: "group", "aria-label": "Platform Accounts" },
          ...platUsers.map((u) => {
            const role = getRole(u.defaultRoleId);
            const isActive = selectedScopeWsId === "__platform__" && selectedUserId === u.id;
            return h(
              "li",
              { class: "acc-tree-item" },
              h(
                "button",
                {
                  type: "button",
                  class: `acc-tree-node-btn ${isActive ? "is-selected" : ""}`,
                  "aria-pressed": String(isActive),
                  onClick: () => onSelectAccount?.({ wsId: "__platform__", userId: u.id, roleId: u.defaultRoleId, user: u, role, workspace: null })
                },
                h("span", { class: "acc-tree-node-main" },
                  h("span", { class: "creator-avatar acc-tree-avatar", "aria-hidden": "true" }, u.initials),
                  h("span", { class: "acc-tree-node-text" },
                    h("strong", {}, u.name),
                    h("span", { class: "mono-meta" }, `${u.email} · ${u.title}`)
                  )
                ),
                h("span", { class: "acc-tree-node-meta" },
                  createStatusPill(role?.badge ?? "PLATFORM", role?.tone ?? "warn"),
                  actionLabel ? h("span", { class: "mono-meta" }, actionLabel) : null
                )
              )
            );
          })
        )
      )
    );
  }

  if (wsList.length) {
    branches.push(
      h(
        "details",
        { class: "acc-tree-branch", open: true },
        h(
          "summary",
          { class: "acc-tree-summary" },
          h("span", { style: "display:inline-flex;align-items:center;gap:0.45rem;" },
            h("strong", {}, "Registered Tenants"),
            h("span", { class: "mono-meta" }, `${wsList.length} isolated customer workspaces`)
          ),
          createStatusPill(`${users.filter((u) => u.userScope !== "platform").length} Tenant Users`, "ok")
        ),
        h(
          "div",
          { class: "acc-tree-tenants", role: "group", "aria-label": "Tenants and their users" },
          ...wsList.map((ws, idx) => {
            const wsUsers = users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id));
            const teams = getTenantTeams(ws.id, snapshot);
            const isOpen = expandAllTenants || ws.id === selectedScopeWsId || (selectedScopeWsId === "__platform__" && idx === 0);

            return h(
              "details",
              { class: "acc-tree-tenant", open: isOpen },
              h(
                "summary",
                { class: "acc-tree-tenant-summary" },
                h("span", { style: "display:inline-flex;align-items:center;gap:0.45rem;flex-wrap:wrap;" },
                  h("strong", { style: "font-size:var(--text-sm);" }, ws.name),
                  h("span", { class: "mono-meta" }, ws.domain)
                ),
                h("span", { style: "display:inline-flex;align-items:center;gap:0.35rem;" },
                  h("span", { class: "badge" }, `${(ws.channels ?? []).length} ch`),
                  createStatusPill(`${wsUsers.length} Users`, "info")
                )
              ),
              h(
                "div",
                { class: "acc-tree-tenant-body" },
                ...(teams.length
                  ? teams.map((tm) =>
                      h(
                        "div",
                        { class: "acc-tree-team-group" },
                        h("div", { class: "acc-tree-team-label" },
                          h("span", {}, `Team: ${tm.name}`),
                          h("span", { class: "mono-meta" }, tm.channels.map((c) => c.name).join(" + "))
                        ),
                        h(
                          "ul",
                          { class: "acc-tree-list" },
                          ...tm.members.map(({ user: u, role }) => {
                            const isActive = selectedScopeWsId === ws.id && selectedUserId === u.id;
                            return h(
                              "li",
                              { class: "acc-tree-item" },
                              h(
                                "button",
                                {
                                  type: "button",
                                  class: `acc-tree-node-btn ${isActive ? "is-selected" : ""}`,
                                  "aria-pressed": String(isActive),
                                  onClick: () => onSelectAccount?.({ wsId: ws.id, userId: u.id, roleId: u.defaultRoleId, user: u, role, workspace: ws })
                                },
                                h("span", { class: "acc-tree-node-main" },
                                  h("span", { class: "creator-avatar acc-tree-avatar", "aria-hidden": "true" }, u.initials),
                                  h("span", { class: "acc-tree-node-text" },
                                    h("strong", {}, u.name),
                                    h("span", { class: "mono-meta" }, `${u.email} · ${u.title}`)
                                  )
                                ),
                                h("span", { class: "acc-tree-node-meta" },
                                  createStatusPill(role?.badge ?? "USER", role?.tone ?? "info"),
                                  actionLabel ? h("span", { class: "mono-meta" }, actionLabel) : null
                                )
                              )
                            );
                          })
                        )
                      )
                    )
                  : [
                      h(
                        "ul",
                        { class: "acc-tree-list" },
                        ...wsUsers.map((u) => {
                          const role = getRole(u.defaultRoleId);
                          const isActive = selectedScopeWsId === ws.id && selectedUserId === u.id;
                          return h(
                            "li",
                            { class: "acc-tree-item" },
                            h(
                              "button",
                              {
                                type: "button",
                                class: `acc-tree-node-btn ${isActive ? "is-selected" : ""}`,
                                "aria-pressed": String(isActive),
                                onClick: () => onSelectAccount?.({ wsId: ws.id, userId: u.id, roleId: u.defaultRoleId, user: u, role, workspace: ws })
                              },
                              h("span", { class: "acc-tree-node-main" },
                                h("span", { class: "creator-avatar acc-tree-avatar", "aria-hidden": "true" }, u.initials),
                                h("span", { class: "acc-tree-node-text" },
                                  h("strong", {}, u.name),
                                  h("span", { class: "mono-meta" }, u.email)
                                )
                              ),
                              createStatusPill(role?.badge ?? "USER", role?.tone ?? "info")
                            )
                          );
                        })
                      )
                    ])
              )
            );
          })
        )
      )
    );
  }

  return h("div", { class: "acc-tree", "aria-label": "Platform and Tenant Account Tree" }, ...branches);
}
