import { ROLES, SCENARIOS } from "../data/seed.js";
import {
  buildUserTreeOptgroups,
  buildWorkspaceScopeOptgroups,
  createAccountTreeWidget
} from "../lib/account-tree.js";
import { createStatusPill, h } from "../lib/dom.js";
import { navigateTo, ROUTES } from "../lib/router.js";
import {
  can,
  commitSandboxToProduction,
  discardSandboxWorkingCopy,
  enterSandboxWorkingCopy,
  getActiveContext,
  getState,
  getTenantModuleStatus,
  getTenantTeams,
  resetSandboxWorkingCopy
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let simWsId = null;
let simChannelId = "all";
let simUserId = null;
let simRoleId = null;

export function renderEmulate() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const canMasterPlatform = ctx.isPlatformOperator || ["ultimate_master", "ultimate_maintenance"].includes(ctx.realUser.defaultRoleId);
  const visibleWorkspaces = canMasterPlatform
    ? snap.workspaces
    : snap.workspaces.filter((w) => w.id === ctx.workspace.id);

  if (!simWsId || (simWsId !== "__platform__" && !visibleWorkspaces.some((w) => w.id === simWsId))) {
    simWsId = ctx.isMasterPlatformScope && canMasterPlatform ? "__platform__" : ctx.workspace.id;
  }

  const targetWs = simWsId === "__platform__" ? null : snap.workspaces.find((w) => w.id === simWsId) ?? visibleWorkspaces[0];
  const candidateUsers = simWsId === "__platform__"
    ? snap.users.filter((u) => u.userScope === "platform")
    : snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(targetWs?.id));

  if (!simUserId || !candidateUsers.some((u) => u.id === simUserId)) {
    simUserId = candidateUsers[0]?.id ?? ctx.activeUser.id;
  }
  const targetUser = snap.users.find((u) => u.id === simUserId) ?? candidateUsers[0];

  const candidateRoles = simWsId === "__platform__"
    ? ROLES.filter((r) => r.scope === "platform")
    : ROLES.filter((r) => r.scope === "tenant");

  if (!simRoleId || !candidateRoles.some((r) => r.id === simRoleId)) {
    simRoleId = candidateRoles.some((r) => r.id === targetUser?.defaultRoleId) ? targetUser.defaultRoleId : candidateRoles[0]?.id;
  }
  const targetRole = ROLES.find((r) => r.id === simRoleId) ?? ROLES[0];

  const channels = targetWs?.channels ?? [];
  if (simChannelId !== "all" && !channels.some((c) => c.id === simChannelId)) {
    simChannelId = "all";
  }

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Emulate — Sandbox Working Copy & Tenant/User Tester"),
      h("p", { class: "page-subtitle" }, "Spin up an isolated Working Copy snapshot to test tenants, channels, users, RBAC boundaries, and Experimental module upgrades safely without altering Production.")
    ),
    h(
      "div",
      { class: "page-actions" },
      createStatusPill(ctx.isSandbox ? `SANDBOX WORKING COPY (${ctx.sandboxChangesCount} edits)` : "PRODUCTION BASELINE", ctx.isSandbox ? "warn" : "ok")
    )
  );

  // Working Copy Lifecycle Bar
  const workingCopyCard = h(
    "section",
    { class: "card", style: ctx.isSandbox ? "border-color:var(--status-warn);background:var(--status-warn-bg);" : "" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "card-title" }, ctx.isSandbox ? `Active Working Copy: ${ctx.sandboxLabel}` : "Sandbox Working Copy Status: Inactive (Live Production)"),
        h("span", { class: "mono-meta" }, ctx.isSandbox
          ? `Forked at ${ctx.sandboxChangesCount >= 0 ? snap.sandbox.enteredAt : "now"} · ${ctx.sandboxChangesCount} isolated mutation(s) recorded in working copy only`
          : "Click below to fork a safe Sandbox Working Copy before testing tenant modifications or module rollouts.")
      ),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.4rem;" },
        !ctx.isSandbox
          ? h("button", {
              type: "button",
              class: "btn btn--primary btn--sm",
              onClick: () => {
                enterSandboxWorkingCopy({ label: "Operator Working Copy" });
                showToast("Forked isolated Sandbox Working Copy from Production", { tone: "warn" });
              }
            }, "Fork Working Copy Now")
          : [
              h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => {
                  resetSandboxWorkingCopy();
                  showToast("Reset Sandbox Working Copy to clean Production baseline", { tone: "info" });
                }
              }, "Reset Working Copy"),
              can("sandbox:commit", snap)
                ? h("button", {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => {
                      commitSandboxToProduction();
                      showToast("Promoted Sandbox Working Copy changes into Production", { tone: "ok" });
                    }
                  }, "Commit to Production")
                : null,
              h("button", {
                type: "button",
                class: "btn btn--primary btn--sm",
                onClick: () => {
                  discardSandboxWorkingCopy();
                  showToast("Discarded Working Copy and restored clean Production data", { tone: "ok" });
                }
              }, "Discard & Exit Sandbox")
            ]
      )
    )
  );

  // Controls Matrix
  const wsSel = h(
    "select",
    {
      id: "emu-ws-select",
      class: "select",
      onChange: (e) => {
        simWsId = e.target.value;
        simChannelId = "all";
        simUserId = null;
        simRoleId = null;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
    ...buildWorkspaceScopeOptgroups({
      snapshot: snap,
      workspaces: visibleWorkspaces,
      includePlatform: canMasterPlatform,
      selectedValue: simWsId,
      platformLabel: "Master Platform (2 Accounts)"
    })
  );

  const chSel = h(
    "select",
    {
      id: "emu-ch-select",
      class: "select",
      disabled: !targetWs || channels.length === 0,
      onChange: (e) => {
        simChannelId = e.target.value;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
    h("option", { value: "all", selected: simChannelId === "all" }, targetWs ? `All Channels (${channels.length})` : "N/A on Platform Root"),
    ...channels.map((c) => h("option", { value: c.id, selected: simChannelId === c.id }, `${c.name} (${c.domain})`))
  );

  const usrSel = h(
    "select",
    {
      id: "emu-user-select",
      class: "select",
      onChange: (e) => {
        simUserId = e.target.value;
        const picked = snap.users.find((x) => x.id === simUserId);
        if (picked) simRoleId = picked.defaultRoleId;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
    ...buildUserTreeOptgroups({
      snapshot: snap,
      scopeWsId: simWsId,
      selectedUserId: simUserId,
      compositeValue: false
    })
  );

  const roleSel = h(
    "select",
    {
      id: "emu-role-select",
      class: "select",
      onChange: (e) => {
        simRoleId = e.target.value;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
    ...candidateRoles.map((r) => h("option", { value: r.id, selected: r.id === simRoleId }, `${r.name} [${r.badge}]`))
  );

  const launchTarget = (destRoute) => {
    enterSandboxWorkingCopy({
      label: `Emulating ${targetUser?.name} (${targetRole.badge})${targetWs ? ` @ ${targetWs.name}` : ""}`,
      workspaceId: simWsId,
      channelId: simChannelId,
      userId: simUserId,
      roleId: simRoleId
    });
    navigateTo(destRoute);
    showToast(`Sandbox Emulating ${targetUser?.name} (${targetRole.badge})`, { tone: "warn" });
  };

  const previewAllowedRoutes = simWsId === "__platform__"
    ? (targetRole.id === "ultimate_master"
        ? ["command", "subscriptions", "suite", "emulate", "admin", "newlifecorp", "system"]
        : ["command", "subscriptions", "suite", "emulate", "admin", "system"])
    : targetRole.allowedRoutes;

  const tenantModSnapshots = targetWs
    ? (snap.platformData?.suiteModules ?? []).map((m) => getTenantModuleStatus(m.id, targetWs.id, snap)).filter(Boolean)
    : [];

  const targetTeams = targetWs ? getTenantTeams(targetWs.id, snap) : [];

  const matrixCard = h(
    "section",
    { class: "split-pane" },
    h(
      "article",
      { class: "card", style: "gap:0.85rem;" },
      h("h2", { class: "card-title" }, "Configure Sandbox Target (Tenant · Channel · User · Role)"),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "emu-ws-select" }, "1. Target Tenant or Platform Root"), wsSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "emu-ch-select" }, "2. Brand Channel Filter"), chSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "emu-user-select" }, "3. User Account in Scope"), usrSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "emu-role-select" }, "4. Effective RBAC Role"), roleSel),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.45rem;padding-top:0.25rem;" },
        h("button", { type: "button", class: "btn btn--primary", onClick: () => launchTarget("command") }, "Launch Sandbox Preview →"),
        previewAllowedRoutes.includes("studio") ? h("button", { type: "button", class: "btn btn--subtle", onClick: () => launchTarget("studio") }, "Open Workbench →") : null,
        previewAllowedRoutes.includes("calendar") ? h("button", { type: "button", class: "btn btn--subtle", onClick: () => launchTarget("calendar") }, "Open Mega Calendar →") : null
      )
    ),
    h(
      "article",
      { class: "card", style: "gap:0.75rem;" },
      h("div", { class: "card-header" },
        h("h2", { class: "card-title" }, "Pre-Flight Isolation & Suite Simulation"),
        createStatusPill(targetRole.badge, targetRole.tone || "info")
      ),
      h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, targetRole.summary),
      h("div", { style: "display:flex;flex-direction:column;gap:0.3rem;" },
        h("span", { class: "mono-meta" }, "SIDEBAR ROUTES VISIBLE TO THIS SESSION"),
        h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;" },
          ...ROUTES.map((r) => {
            const visible = previewAllowedRoutes.includes(r.id);
            return h("span", { class: visible ? "tag" : "mono-meta", style: visible ? "border-color:var(--status-ok);" : "opacity:0.45;text-decoration:line-through;padding:0.2rem 0.35rem;" }, r.title);
          })
        )
      ),
      h("div", { style: "display:flex;flex-direction:column;gap:0.3rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
        h("span", { class: "mono-meta" }, "AUTHORIZED SCENARIOS"),
        h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;" },
          ...(targetRole.scenarios.length
            ? targetRole.scenarios.map((scId) => {
                const s = SCENARIOS.find((x) => x.id === scId);
                return h("span", { class: "tag" }, s?.label ?? scId);
              })
            : [h("span", { class: "mono-meta" }, "No creative scenario studios (Platform/Ops/External viewer isolation)")])
        )
      ),
      targetWs
        ? h("div", { style: "display:flex;flex-direction:column;gap:0.3rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);" },
            h("span", { class: "mono-meta" }, `${targetWs.name} · ACTIVE SUITE MODULE VERSIONS`),
            h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;" },
              ...tenantModSnapshots.map((st) =>
                createStatusPill(`${st.module.category.split(" ")[0]} v${st.installedVersion}`, st.enabled ? st.tone : "warn")
              )
            ),
            h("span", { class: "mono-meta" }, `Teams: ${targetTeams.map((t) => t.name).join(" · ")}`)
          )
        : null
    )
  );

  // Quick One-Click Sandbox Test Cards
  const quickPresets = [
    { label: "GodFlow · Editorial", wsId: "ws-godflow", chId: "ch-godflow", userId: "usr-nadia", roleId: "editor_newsletter", dest: "studio", note: "Verify Article Research Desk + Rich HTML Studio isolation" },
    { label: "GodFlow · Podcast + Simulcast", wsId: "ws-godflow", chId: "ch-godflow", userId: "usr-liam", roleId: "podcast_producer", dest: "studio", note: "Verify Podcast Script Composer & Multi-Platform Live Simulcast" },
    { label: "Tradester · Live Markets Stream Desk", wsId: "ws-tradester", chId: "ch-tr-live", userId: "usr-tr-vikram", roleId: "trader_host", dest: "studio", note: "Verify Tradester Live Streamer isolation from GodFlow" },
    { label: "Tradester · Partner Viewer (Confidential)", wsId: "ws-tradester", chId: "all", userId: "usr-tr-guest", roleId: "guest_viewer", dest: "command", note: "Verify internal finance & pipeline data stay hidden" }
  ];

  const presetsCard = h(
    "section",
    { class: "card", style: "gap:0.75rem;" },
    h("h2", { class: "card-title" }, "1-Click Working Copy Test Scenarios"),
    h("div", { class: "grid-2" },
      ...quickPresets.map((p) =>
        h("div", { class: "feed-row", style: "padding:0.65rem 0.8rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);" },
          h("div", { class: "feed-row-main" },
            h("strong", { style: "font-size:var(--text-xs);" }, p.label),
            h("span", { class: "mono-meta" }, p.note)
          ),
          h("button", {
            type: "button",
            class: "btn btn--subtle btn--sm",
            onClick: () => {
              enterSandboxWorkingCopy({
                label: p.label,
                workspaceId: p.wsId,
                channelId: p.chId,
                userId: p.userId,
                roleId: p.roleId
              });
              navigateTo(p.dest);
              showToast(`Sandbox Working Copy → ${p.label}`, { tone: "warn" });
            }
          }, "Test in Sandbox →")
        )
      )
    )
  );

  const accountTreeCard = h(
    "section",
    { class: "card", style: "gap:0.75rem;" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "card-title" }, "Platform Account Tree — Pick Any Node to Emulate"),
        h("span", { class: "mono-meta" }, "2 Platform Accounts → Registered Tenants → Users within each Tenant")
      ),
      createStatusPill("TREE SELECTOR", "info")
    ),
    createAccountTreeWidget({
      snapshot: snap,
      workspaces: visibleWorkspaces,
      selectedScopeWsId: simWsId,
      selectedUserId: simUserId,
      includePlatform: canMasterPlatform,
      actionLabel: "Load Target",
      onSelectAccount: ({ wsId, userId, roleId }) => {
        simWsId = wsId;
        simChannelId = "all";
        simUserId = userId;
        simRoleId = roleId;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
        showToast("Loaded selected account from tree — click Launch Sandbox Preview", { tone: "info" });
      }
    })
  );

  return [header, workingCopyCard, matrixCard, accountTreeCard, presetsCard];
}
