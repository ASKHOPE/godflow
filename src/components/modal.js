import { ROLES, SCENARIOS, SPONSOR_STAGES, TEAM_UNITS } from "../data/seed.js";
import {
  buildUserTreeOptgroups,
  buildWorkspaceScopeOptgroups,
  createAccountTreeWidget
} from "../lib/account-tree.js";
import { copyText } from "../lib/clipboard.js";
import { createStatusPill, formatCurrency, formatNumber, h } from "../lib/dom.js";
import {
  addChannelToWorkspace,
  addInvoice,
  addPipelineItem,
  addShortLink,
  addSocialPost,
  addSponsorDeal,
  can,
  createWorkspace,
  drillIntoTenant,
  getActiveContext,
  getDerivedMetrics,
  getScopedUsersAndRoles,
  getState,
  getTenantSlice,
  inviteTeamMember,
  loginSession,
  markInvoicePaid,
  returnToWaterfallLevel,
  signOutSession,
  switchChannel,
  switchRole,
  switchUser,
  switchWorkspace,
  toggleGodMode
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

function installLightDismissFallback(dialog) {
  if ("closedBy" in HTMLDialogElement.prototype) return;
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (e) => {
    pressedOutside = outside(e);
  });
  dialog.addEventListener("pointerup", (e) => {
    if (pressedOutside && outside(e)) dialog.close();
  });
}

export function initModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  installLightDismissFallback(dialog);
  dialog.addEventListener("close", () => {
    dialog.returnValue = "";
  });
}

function showModalContent(...nodes) {
  const dialog = document.getElementById("app-modal");
  const content = document.getElementById("modal-content");
  if (!dialog || !content) return;
  content.replaceChildren(...nodes);
  if (!dialog.open) dialog.showModal();
  return dialog;
}

function modalHeader(title, subtitle, dialog) {
  return h(
    "div",
    { class: "dialog-header" },
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:0.2rem;" },
      h("h1", { id: "modal-title", class: "dialog-title" }, title),
      subtitle ? h("p", { class: "page-subtitle" }, subtitle) : null
    ),
    h(
      "button",
      {
        type: "button",
        class: "icon-btn",
        "aria-label": "Close modal",
        onClick: () => dialog.close("close")
      },
      "✕"
    )
  );
}

export function openSessionModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  const snap = getState();
  const ctx = getActiveContext(snap);
  const canMaster = ctx.isPlatformOperator || ["ultimate_master", "ultimate_maintenance"].includes(ctx.realUser.defaultRoleId);
  const { scopedUsers, scopedRoles } = getScopedUsersAndRoles(snap);

  const allowedWorkspaces = snap.workspaces.filter(
    (w) => ctx.isPlatformOperator || ctx.isGodMode || ctx.activeUser.workspaceIds.includes(w.id)
  );
  const currentScopeWs = ctx.isMasterPlatformScope ? "__platform__" : ctx.workspace.id;

  const wsSel = h(
    "select",
    { id: "sm-ws", class: "select" },
    ...buildWorkspaceScopeOptgroups({
      snapshot: snap,
      workspaces: allowedWorkspaces,
      includePlatform: canMaster,
      selectedValue: currentScopeWs,
      platformLabel: "Master Platform (2 Accounts)"
    })
  );
  const userSel = h(
    "select",
    { id: "sm-user", class: "select", autofocus: true },
    ...(!ctx.isUltimateMaster && !ctx.isUltimateMaintenance && !ctx.isGodMode && ctx.role.id !== "tenant_admin"
      ? [h("optgroup", { label: `Tenant: ${ctx.workspace.name}` }, h("option", { value: ctx.activeUser.id, selected: true }, `${ctx.activeUser.name} — ${ctx.activeUser.title}`))]
      : buildUserTreeOptgroups({
          snapshot: snap,
          scopeWsId: currentScopeWs,
          selectedUserId: ctx.activeUser.id,
          compositeValue: false
        }))
  );
  const roleSel = h(
    "select",
    { id: "sm-role", class: "select" },
    ...scopedRoles.map((r) => h("option", { value: r.id, selected: r.id === ctx.role.id }, `${r.name} [${r.badge}]`))
  );

  wsSel.addEventListener("change", () => {
    const isPlat = wsSel.value === "__platform__";
    const usersList = isPlat
      ? snap.users.filter((u) => u.userScope === "platform")
      : snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(wsSel.value));
    const rolesList = isPlat ? ROLES.filter((r) => r.scope === "platform") : ROLES.filter((r) => r.scope === "tenant");
    userSel.replaceChildren(
      ...buildUserTreeOptgroups({
        snapshot: snap,
        scopeWsId: wsSel.value,
        selectedUserId: usersList[0]?.id,
        compositeValue: false
      })
    );
    roleSel.replaceChildren(...rolesList.map((r) => h("option", { value: r.id }, `${r.name} [${r.badge}]`)));
    if (usersList[0]) roleSel.value = usersList[0].defaultRoleId;
  });

  const treeQuickSwitch = canMaster || ctx.isGodMode || ctx.role.id === "tenant_admin"
    ? h(
        "details",
        { class: "acc-tree-branch" },
        h("summary", { class: "acc-tree-summary" },
          h("strong", { style: "font-size:var(--text-xs);" }, "Browse Platform Tree (2 Accounts → Tenants → Users)"),
          createStatusPill("TREE SWITCH", "info")
        ),
        h(
          "div",
          { style: "padding:0.55rem;" },
          createAccountTreeWidget({
            snapshot: snap,
            workspaces: allowedWorkspaces,
            selectedScopeWsId: currentScopeWs,
            selectedUserId: ctx.activeUser.id,
            includePlatform: canMaster,
            actionLabel: "Select",
            onSelectAccount: ({ wsId, userId, roleId, user, role }) => {
              if (wsId === "__platform__") {
                loginSession({ userId, workspaceId: snap.workspaces[0].id, roleId });
              } else {
                loginSession({ userId, workspaceId: wsId, roleId });
                drillIntoTenant(wsId);
                switchUser(userId);
                switchRole(roleId);
              }
              dialog.close("switched");
              showToast(`Switched to ${user.name} [${role?.badge}]`, { tone: "ok" });
            }
          })
        )
      )
    : null;

  userSel.addEventListener("change", () => {
    const u = snap.users.find((x) => x.id === userSel.value);
    if (u) {
      roleSel.value = u.defaultRoleId;
    }
  });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.9rem;",
      onSubmit: (e) => {
        e.preventDefault();
        if (wsSel.value === "__platform__") {
          loginSession({ userId: userSel.value, workspaceId: snap.workspaces[0].id, roleId: roleSel.value });
        } else {
          loginSession({ userId: userSel.value, workspaceId: wsSel.value, roleId: roleSel.value });
          if (userSel.value !== "usr-master" && userSel.value !== "usr-maint") {
            drillIntoTenant(wsSel.value);
            switchUser(userSel.value);
            switchRole(roleSel.value);
          }
        }
        dialog.close("switched");
        showToast("Session context updated", { tone: "ok" });
      }
    },
    h("div", { class: "field" }, h("label", { class: "field-label", for: "sm-ws" }, "1. Platform Root or Registered Tenant"), wsSel),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "sm-user" }, "2. Scoped User in Tree"), userSel),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "sm-role" }, "3. Scoped RBAC Role"), roleSel),
    ...(treeQuickSwitch ? [treeQuickSwitch] : []),
    h(
      "div",
      { class: "dialog-footer" },
        h(
          "button",
          {
            type: "button",
            class: "btn btn--subtle",
            onClick: () => {
              dialog.close("logout");
              signOutSession({ toPublicHomepage: true });
            }
          },
          "Sign Out → Public Homepage"
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn--ghost",
            onClick: () => {
              dialog.close("login");
              signOutSession({ toPublicHomepage: false });
            }
          },
          "Demo Login Screen"
        ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--subtle",
          onClick: () => {
            toggleGodMode();
            dialog.close("god");
            showToast(ctx.isGodMode ? "Exited God Mode" : "God Mode Enabled", { tone: "warn" });
          }
        },
        ctx.isGodMode ? "Disable God Mode" : "Elevate to God Mode"
      ),
      h("button", { type: "submit", class: "btn btn--primary" }, "Apply Session")
    )
  );

  showModalContent(modalHeader("Workspace, User & Role Switcher", "Switch tenant isolation, user identity, or RBAC role instantaneously", dialog), form);
}

export function openNewWorkspaceModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;

  const nameIn = h("input", { id: "nw-name", class: "input", type: "text", required: true, autofocus: true, placeholder: "e.g., Meridian Quant Media" });
  const domIn = h("input", { id: "nw-dom", class: "input input--mono", type: "text", required: true, placeholder: "meridianquant.tv" });
  const planIn = h(
    "select",
    { id: "nw-plan", class: "select" },
    h("option", { value: "Creator Pro" }, "Creator Pro"),
    h("option", { value: "Syndicate Pro" }, "Syndicate Pro"),
    h("option", { value: "Label Studio" }, "Label Studio"),
    h("option", { value: "Sovereign Enterprise" }, "Sovereign Enterprise")
  );
  const scenarioChecks = SCENARIOS.map((s) => {
    const chk = h("input", { type: "checkbox", value: s.id, checked: true });
    return { id: s.id, el: h("label", { class: "checklist-item" }, chk, h("span", { style: "font-size:var(--text-xs);" }, s.label)), chk };
  });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.85rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const activeScenarios = scenarioChecks.filter((c) => c.chk.checked).map((c) => c.id);
        const ws = createWorkspace({
          name: nameIn.value.trim(),
          domain: domIn.value.trim(),
          plan: planIn.value,
          activeScenarios
        });
        dialog.close("created");
        showToast(`Created tenant ${ws.name} (${ws.domain})`, { tone: "ok" });
      }
    },
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nw-name" }, "Workspace Name"), nameIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nw-dom" }, "Primary Domain"), domIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nw-plan" }, "Tenant Tier"), planIn)
    ),
    h("span", { class: "field-label" }, "Enabled Production Scenarios"),
    h("div", { class: "form-grid" }, ...scenarioChecks.map((c) => c.el)),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Provision Tenant")
    )
  );

  showModalContent(modalHeader("Provision New Tenant Workspace", "Creates an isolated PostgreSQL tenant_id scope & R2 storage prefix", dialog), form);
}

export function openInviteMemberModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  const snap = getState();
  const ctx = getActiveContext(snap);

  const nameIn = h("input", { id: "im-name", class: "input", type: "text", required: true, autofocus: true, placeholder: "Jordan Rivera" });
  const emailIn = h("input", { id: "im-email", class: "input", type: "email", required: true, placeholder: "jordan@godflow.studio" });
  const titleIn = h("input", { id: "im-title", class: "input", type: "text", required: true, placeholder: "Research & Fact-Checking Specialist" });
  const roleIn = h("select", { id: "im-role", class: "select" }, ...ROLES.filter((r) => r.scope === "tenant").map((r) => h("option", { value: r.id, selected: r.id === "editor_newsletter" }, r.name)));
  const wsIn = h("select", { id: "im-ws", class: "select" }, ...snap.workspaces.map((w) => h("option", { value: w.id, selected: w.id === ctx.workspace.id }, w.name)));
  const getTeamsForWs = (wsId) => snap.workspaces.find((w) => w.id === wsId)?.teams ?? [];
  const teamIn = h("select", { id: "im-team", class: "select" }, ...getTeamsForWs(ctx.workspace.id).map((t) => h("option", { value: t.id }, t.name)));
  const unitIn = h("select", { id: "im-unit", class: "select" }, ...TEAM_UNITS.map((u) => h("option", { value: u.id, selected: u.id === "Research Team" }, u.label)));

  wsIn.addEventListener("change", () => {
    teamIn.replaceChildren(...getTeamsForWs(wsIn.value).map((t) => h("option", { value: t.id }, t.name)));
  });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.85rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const roleObj = ROLES.find((r) => r.id === roleIn.value);
        inviteTeamMember({
          name: nameIn.value.trim(),
          email: emailIn.value.trim(),
          title: titleIn.value.trim(),
          roleId: roleIn.value,
          workspaceId: wsIn.value,
          scenarios: roleObj?.scenarios ?? [],
          teamId: teamIn.value || null,
          unit: unitIn.value || "Content Team",
          subRole: titleIn.value.trim()
        });
        dialog.close("created");
        showToast(`Invited ${nameIn.value.trim()} → ${unitIn.value}`, { tone: "ok" });
      }
    },
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-name" }, "Full Name"), nameIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-email" }, "Email Address"), emailIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-title" }, "Title / Sub-Role"), titleIn)
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-role" }, "Primary RBAC Role"), roleIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-ws" }, "Primary Tenant"), wsIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-team" }, "Assign to Section"), teamIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "im-unit" }, "Delegated Unit"), unitIn)
    ),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Send Invite & Delegate Role")
    )
  );

  showModalContent(modalHeader("Invite & Delegate Teammate", "Assigns workspace membership, section placement (Lead / Research / Content), and RBAC policy", dialog), form);
}

export function openInvoicePreviewModal(invoiceId) {
  const dialog = document.getElementById("app-modal");
  const snap = getState();
  const inv = snap.invoices.find((i) => i.id === invoiceId);
  if (!inv || !dialog) return;

  const canSettle = can("finance:write", snap);
  const { workspace } = getActiveContext(snap);
  const tone = inv.status === "Paid" ? "ok" : inv.status === "Draft" ? "info" : "warn";

  const sheet = h(
    "div",
    { class: "invoice-sheet" },
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;" },
      h(
        "div",
        {},
        h("div", { class: "mono", style: "font-weight:700;font-size:1.05rem;" }, `${workspace.name.toUpperCase()} LLC`),
        h("div", { class: "mono-meta" }, `Tenant: ${workspace.domain} · Region: ${workspace.region}`),
        h("div", { class: "mono-meta" }, `billing@${workspace.domain}`)
      ),
      h(
        "div",
        { style: "text-align:end;" },
        h("div", { class: "mono", style: "font-weight:700;font-size:1.15rem;" }, inv.number),
        createStatusPill(inv.status, tone),
        h("div", { class: "mono-meta", style: "margin-top:0.35rem;" }, `Issued: ${inv.issuedDate} · Due: ${inv.dueDate}`)
      )
    ),
    h(
      "div",
      { class: "grid-2" },
      h(
        "div",
        { class: "card" },
        h("span", { class: "mono-meta" }, "BILL TO"),
        h("strong", {}, inv.sponsorName),
        h("span", { class: "page-subtitle" }, inv.sponsorAddress)
      ),
      h(
        "div",
        { class: "card" },
        h("span", { class: "mono-meta" }, "SETTLEMENT RAIL"),
        h("strong", {}, `${inv.rail} (${inv.currency})`),
        h(
          "span",
          { class: "mono-meta" },
          inv.currency === "BTC"
            ? `BTCPay Invoice: btcpay.${workspace.domain}/i/gf-902`
            : inv.rail.includes("Wire")
            ? "Routing: 021000021 · Acct: ••••4819"
            : "Instant Stripe / PayPal checkout link embedded"
        )
      )
    ),
    h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-label": "Invoice line items" },
      h(
        "table",
        { class: "data-table" },
        h(
          "thead",
          {},
          h("tr", {}, h("th", { scope: "col" }, "Deliverable"), h("th", { scope: "col" }, "Qty"), h("th", { scope: "col" }, "Unit Rate"), h("th", { scope: "col" }, "Line Total"))
        ),
        h(
          "tbody",
          {},
          ...inv.items.map((line) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, line.desc),
              h("td", { dataset: { label: "Qty" }, class: "mono" }, String(line.qty)),
              h("td", { dataset: { label: "Rate" }, class: "mono" }, formatCurrency(line.rate, inv.currency)),
              h("td", { dataset: { label: "Total" }, class: "mono" }, formatCurrency(Number(line.qty) * Number(line.rate), inv.currency))
            )
          )
        )
      )
    ),
    h(
      "div",
      { style: "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;" },
      h("span", { class: "mono-meta" }, `USD Reference Value: ${formatCurrency(inv.usdEquivalent, "USD")}`),
      h(
        "div",
        { style: "display:flex;align-items:baseline;gap:0.6rem;" },
        h("span", { class: "page-subtitle" }, "Total Due:"),
        h("strong", { class: "mono", style: "font-size:1.35rem;" }, formatCurrency(inv.amount, inv.currency))
      )
    )
  );

  const footer = h(
    "div",
    { class: "dialog-footer" },
    inv.status !== "Paid" && canSettle
      ? h(
          "button",
          {
            type: "button",
            class: "btn btn--subtle",
            onClick: () => {
              dialog.close("paid");
              markInvoicePaid(inv.id);
              showToast(`${inv.number} marked Paid and recorded in Unified Ledger`, { tone: "ok" });
            }
          },
          "Mark Paid"
        )
      : null,
    h("button", { type: "button", class: "btn btn--subtle", onClick: () => window.print() }, "Print / Save PDF"),
    h("button", { type: "button", class: "btn btn--primary", autofocus: true, onClick: () => dialog.close("close") }, "Close Preview")
  );

  showModalContent(modalHeader(`Invoice PDF Preview — ${inv.number}`, `Multi-currency sponsor invoice (${inv.currency})`, dialog), sheet, footer);
}

export function openMediaKitModal() {
  const dialog = document.getElementById("app-modal");
  const snap = getState();
  const metrics = getDerivedMetrics(snap);
  const { workspace } = getActiveContext(snap);
  if (!dialog) return;

  const publicUrl = `https://${workspace.shortDomain}/sponsor`;

  const body = h(
    "div",
    { style: "display:flex;flex-direction:column;gap:1rem;" },
    h(
      "div",
      { class: "sponsor-box-block" },
      h("span", { class: "mono-meta" }, `PUBLIC MEDIA KIT · ${workspace.domain.toUpperCase()}`),
      h("strong", { style: "font-size:1.05rem;" }, `${workspace.name} — Multi-Channel Creator Studio`),
      h("p", { style: "margin:0;font-size:var(--text-sm);" }, "Covering live streams, acoustic music releases, podcasts + multi-platform simulcasts, articles & research, and social distribution.")
    ),
    h(
      "div",
      { class: "grid-kpi" },
      h("div", { class: "card" }, h("span", { class: "kpi-label" }, "Newsletter Subs"), h("strong", { class: "kpi-value" }, formatNumber(workspace.newsletterSubscribers)), h("span", { class: "mono-meta" }, `${workspace.newsletterOpenRate}% verified open rate`)),
      h("div", { class: "card" }, h("span", { class: "kpi-label" }, "Active Scenarios"), h("strong", { class: "kpi-value" }, String(workspace.activeScenarios.length)), h("span", { class: "mono-meta" }, workspace.plan)),
      h("div", { class: "card" }, h("span", { class: "kpi-label" }, "Monthly /go Clicks"), h("strong", { class: "kpi-value" }, formatNumber(metrics.totalAffiliateClicks)), h("span", { class: "mono-meta" }, "First-party Hono attribution"))
    ),
    h(
      "div",
      { class: "card" },
      h("h2", { class: "card-title" }, "2026 Sponsorship Packages & Rate Card"),
      h(
        "ul",
        { class: "feed-list" },
        h("li", { class: "feed-row" }, h("span", {}, "Live Stream Broadcast Title Integration + Pinned /go Link"), h("strong", { class: "mono" }, "$1,500 / stream")),
        h("li", { class: "feed-row" }, h("span", {}, "Podcast Host-Read Mid-Roll + 3 Short Clips Package"), h("strong", { class: "mono" }, "$2,000 / episode")),
        h("li", { class: "feed-row" }, h("span", {}, "Listmonk Primary <SponsorBox/> + EmDash Essay Bundle"), h("strong", { class: "mono" }, "$2,200 / package")),
        h("li", { class: "feed-row" }, h("span", {}, "Full Multi-Channel 5-Scenario Launch Sprint"), h("strong", { class: "mono" }, "$4,800 / sprint"))
      )
    )
  );

  const footer = h(
    "div",
    { class: "dialog-footer" },
    h(
      "button",
      {
        type: "button",
        class: "btn btn--subtle",
        onClick: (e) => copyText(publicUrl, e.currentTarget, "Copied live Media Kit link")
      },
      `Copy ${workspace.shortDomain}/sponsor`
    ),
    h("button", { type: "button", class: "btn btn--primary", autofocus: true, onClick: () => dialog.close("close") }, "Close")
  );

  showModalContent(modalHeader("Live Media Kit Preview", `Synced automatically from ${workspace.name}`, dialog), body, footer);
}

export function openQuickCaptureModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;

  const titleInput = h("input", { id: "mc-title", class: "input", type: "text", required: true, autofocus: true, placeholder: "e.g., CPI Print Reaction Stream or Bassline Sketch" });
  const scenSelect = h("select", { id: "mc-scen", class: "select" }, ...SCENARIOS.map((s) => h("option", { value: s.id }, s.label)));
  const stageSelect = h(
    "select",
    { id: "mc-stage", class: "select" },
    h("option", { value: "capture" }, "Capture (TriliumNext)"),
    h("option", { value: "produce" }, "Produce (OBS / DaVinci)"),
    h("option", { value: "hub" }, "Hub (EmDash / RSS)"),
    h("option", { value: "distribute" }, "Distribute (Postiz / Listmonk)")
  );
  const readyCheck = h("input", { id: "mc-ready", type: "checkbox" });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.9rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        if (!title) return;
        addPipelineItem({
          title,
          scenario: scenSelect.value,
          stage: stageSelect.value,
          publishReady: readyCheck.checked
        });
        dialog.close("created");
        showToast(`Captured "${title}" to TriliumNext + Pipeline`, { tone: "ok" });
      }
    },
    h("div", { class: "field" }, h("label", { class: "field-label", for: "mc-title" }, "Production Title / Note"), titleInput),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "mc-scen" }, "Scenario"), scenSelect),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "mc-stage" }, "Initial Stage"), stageSelect)
    ),
    h("label", { class: "checklist-item" }, readyCheck, h("span", { style: "font-size:var(--text-sm);" }, "Tag with #publish-ready for TriliumNext ETAPI auto-sync")),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Capture to Pipeline")
    )
  );

  showModalContent(modalHeader("Quick Capture", "Creates a TriliumNext note and inserts a tenant-scoped Pipeline card", dialog), form);
}

export function openNewLinkModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;

  const slugIn = h("input", { id: "nl-slug", class: "input input--mono", type: "text", required: true, autofocus: true, placeholder: "cursor-pro" });
  const catIn = h(
    "select",
    { id: "nl-cat", class: "select" },
    h("option", { value: "Broker & Finance" }, "Broker & Finance"),
    h("option", { value: "Studio Gear" }, "Studio Gear"),
    h("option", { value: "Software & SaaS" }, "Software & SaaS"),
    h("option", { value: "Sponsors" }, "Sponsors")
  );
  const destIn = h("input", { id: "nl-dest", class: "input input--mono", type: "url", required: true, placeholder: "https://example.com/?ref=godflow" });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.9rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const slug = addShortLink({ slug: slugIn.value, category: catIn.value, destination: destIn.value.trim() });
        dialog.close("created");
        showToast(`Created short link /go/${slug}`, { tone: "ok" });
      }
    },
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nl-slug" }, "Slug (/go/:slug)"), slugIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nl-cat" }, "Category"), catIn)
    ),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "nl-dest" }, "Destination URL"), destIn),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Create /go Link")
    )
  );

  showModalContent(modalHeader("New Branded Short Link", "Registers a 302 redirect rule in Hono + PostgreSQL", dialog), form);
}

export function openNewSponsorModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;

  const compIn = h("input", { id: "ns-company", class: "input", type: "text", required: true, autofocus: true, placeholder: "e.g., Raycast" });
  const contactIn = h("input", { id: "ns-contact", class: "input", type: "text", required: true, placeholder: "Alex Kim" });
  const emailIn = h("input", { id: "ns-email", class: "input", type: "email", required: true, placeholder: "partners@raycast.com" });
  const valueIn = h("input", { id: "ns-val", class: "input input--mono", type: "number", min: "100", value: "2500", required: true });
  const currIn = h("select", { id: "ns-curr", class: "select" }, h("option", { value: "USD" }, "USD"), h("option", { value: "EUR" }, "EUR"), h("option", { value: "GBP" }, "GBP"));
  const stageIn = h("select", { id: "ns-stage", class: "select" }, ...SPONSOR_STAGES.map((s) => h("option", { value: s }, s)));
  const delivIn = h("input", { id: "ns-deliv", class: "input", type: "text", required: true, placeholder: "2x YouTube Mid-Roll + 1x Listmonk Slot" });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.85rem;",
      onSubmit: (e) => {
        e.preventDefault();
        addSponsorDeal({
          company: compIn.value.trim(),
          contactName: contactIn.value.trim(),
          contactEmail: emailIn.value.trim(),
          value: Number(valueIn.value),
          currency: currIn.value,
          stage: stageIn.value,
          contractStatus: stageIn.value === "Paid" ? "Paid in Full" : stageIn.value === "Lead" ? "MSA Pending" : "SOW Draft",
          deliverables: delivIn.value.trim(),
          dueDate: "2026-12-20",
          affiliateSlug: "sponsor",
          notes: "Added via GodFlow CRM."
        });
        dialog.close("created");
        showToast(`Added ${compIn.value.trim()} to Sponsor CRM`, { tone: "ok" });
      }
    },
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-company" }, "Sponsor Company"), compIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-contact" }, "Contact Name"), contactIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-email" }, "Contact Email"), emailIn)
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-val" }, "Deal Value"), valueIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-curr" }, "Currency"), currIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-stage" }, "Pipeline Stage"), stageIn)
    ),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "ns-deliv" }, "Deliverables Summary"), delivIn),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Create Sponsor Deal")
    )
  );

  showModalContent(modalHeader("New Sponsor Deal", "Tracks deal stage, deliverables, and contract readiness", dialog), form);
}

export function openNewInvoiceModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  const slice = getTenantSlice(getState());

  const sponsorIn = h("input", { id: "ni-name", class: "input", type: "text", required: true, autofocus: true, list: "sponsor-names-list", placeholder: "TradingView Inc." });
  const sponsorDatalist = h("datalist", { id: "sponsor-names-list" }, ...slice.sponsors.map((s) => h("option", { value: s.company })));
  const currIn = h("select", { id: "ni-curr", class: "select" }, h("option", { value: "USD" }, "USD ($)"), h("option", { value: "EUR" }, "EUR (€)"), h("option", { value: "GBP" }, "GBP (£)"), h("option", { value: "BTC" }, "BTC (₿)"));
  const railIn = h("select", { id: "ni-rail", class: "select" }, h("option", { value: "Stripe" }, "Stripe"), h("option", { value: "Wire / ACH" }, "Wire / ACH"), h("option", { value: "PayPal Business" }, "PayPal Business"), h("option", { value: "BTCPay Server" }, "BTCPay Server"));
  const dueIn = h("input", { id: "ni-due", class: "input", type: "date", value: "2026-12-15", required: true });
  const descIn = h("input", { id: "ni-desc", class: "input", type: "text", required: true, placeholder: "Sponsor Package Deliverable" });
  const qtyIn = h("input", { id: "ni-qty", class: "input input--mono", type: "number", min: "1", value: "1", required: true });
  const rateIn = h("input", { id: "ni-rate", class: "input input--mono", type: "number", step: "any", min: "0.0001", value: "2500", required: true });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.85rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const created = addInvoice({
          sponsorName: sponsorIn.value.trim(),
          currency: currIn.value,
          rail: railIn.value,
          dueDate: dueIn.value,
          items: [{ desc: descIn.value.trim(), qty: Number(qtyIn.value), rate: Number(rateIn.value) }]
        });
        dialog.close("created");
        showToast(`Created ${created.number} (${formatCurrency(created.amount, created.currency)})`, { tone: "ok" });
      }
    },
    sponsorDatalist,
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-name" }, "Sponsor / Client Name"), sponsorIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-curr" }, "Currency"), currIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-rail" }, "Payment Rail"), railIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-due" }, "Due Date"), dueIn)
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-desc" }, "Line Item Description"), descIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-qty" }, "Qty"), qtyIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "ni-rate" }, "Unit Rate"), rateIn)
    ),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Issue B2B Invoice")
    )
  );

  showModalContent(modalHeader("Create Multi-Currency B2B Invoice", "Supports Stripe, PayPal, Wire/ACH, and BTCPay settlement", dialog), form);
}

export function openNewSocialModal() {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  const { workspace } = getActiveContext(getState());

  const platIn = h("select", { id: "soc-plat", class: "select", autofocus: true },
    h("option", { value: "YouTube Shorts" }, "YouTube Shorts"),
    h("option", { value: "X" }, "X"),
    h("option", { value: "LinkedIn" }, "LinkedIn"),
    h("option", { value: "Instagram" }, "Instagram")
  );
  const titleIn = h("input", { id: "soc-title", class: "input", type: "text", required: true, placeholder: "Clip / Carousel Title" });
  const schedIn = h("input", { id: "soc-sched", class: "input", type: "text", required: true, value: "Tomorrow · 15:00 EST" });
  const urlIn = h("input", { id: "soc-url", class: "input input--mono", type: "url", required: true, value: `https://${workspace.shortDomain}/broker?utm_source=x&utm_medium=social&utm_campaign=nov-macro` });
  const capIn = h("textarea", { id: "soc-cap", class: "textarea", required: true, placeholder: "Write post caption with hook and CTA..." });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.85rem;",
      onSubmit: (e) => {
        e.preventDefault();
        addSocialPost({
          platform: platIn.value,
          title: titleIn.value.trim(),
          scheduledFor: schedIn.value.trim(),
          trackingUrl: urlIn.value.trim(),
          caption: capIn.value.trim(),
          mediaLabel: platIn.value === "YouTube Shorts" ? "9:16 Clip · 00:45" : "Custom Visual Frame",
          mediaBadge: "Postiz Asset"
        });
        dialog.close("created");
        showToast(`Queued ${platIn.value} post in Postiz`, { tone: "ok" });
      }
    },
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "soc-plat" }, "Channel"), platIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "soc-title" }, "Asset Title"), titleIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "soc-sched" }, "Schedule Slot"), schedIn)
    ),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "soc-url" }, "Tracking URL"), urlIn),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "soc-cap" }, "Caption"), capIn),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Schedule in Postiz")
    )
  );

  showModalContent(modalHeader("Schedule Social Post", "Adds a visual post card to your Postiz distribution queue", dialog), form);
}

export function openChannelWebsiteModal(channelId) {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;
  const snap = getState();
  const ch = snap.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === channelId);
  if (!ch) return;

  const chStatuses = (snap.channelStatuses ?? []).filter((s) => s.channelId === ch.id);
  const chArticles = snap.content.articles.filter((a) => a.channelId === ch.id);
  const chPodcasts = snap.content.podcasts.filter((p) => p.channelId === ch.id);
  const chLinks = snap.shortLinks.filter((l) => l.channelId === ch.id);
  const chFlows = snap.workflowsToday.filter((w) => w.channelId === ch.id);

  const webFrame = h(
    "div",
    { class: "mediakit-sheet" },
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;" },
      h(
        "div",
        { style: "display:flex;flex-direction:column;gap:0.2rem;" },
        h("span", { class: "mono-meta" }, `LIVE CHANNEL SITE · ${ch.websiteUrl}`),
        h("strong", { style: "font-size:1.15rem;" }, `${ch.name} · ${ch.domain}`)
      ),
      createStatusPill(`${formatNumber(ch.monthlyVisitors)} monthly visitors`, ch.tone || "info")
    ),
    h("p", { style: "margin:0;color:var(--text-secondary);font-size:var(--text-sm);" }, ch.tagline),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.35rem;" },
      ...ch.capabilities.map((cap) => h("span", { class: "tag" }, cap))
    ),
    ch.capabilities.includes("live-streaming") && chFlows.length
      ? h(
          "div",
          { class: "card", style: "padding:0.75rem;border-color:var(--accent);" },
          h(
            "div",
            { class: "card-header" },
            h("strong", { style: "font-size:var(--text-sm);" }, `LIVE DESK · ${chFlows[0].title}`),
            createStatusPill(chFlows[0].status, chFlows[0].statusTone || "ok")
          ),
          h("span", { class: "mono-meta" }, chFlows[0].meta)
        )
      : null,
    chStatuses.length
      ? h(
          "div",
          { style: "display:flex;flex-direction:column;gap:0.4rem;" },
          h("span", { class: "mono-meta" }, `STATUSES, SHORTS & POSTS WALL (${chStatuses.length})`),
          ...chStatuses.slice(0, 3).map((st) =>
            h(
              "div",
              { class: "card", style: "padding:0.65rem 0.75rem;gap:0.25rem;" },
              h("div", { class: "card-header" }, h("strong", { style: "font-size:var(--text-xs);" }, st.title), createStatusPill(st.mediaType, "ok")),
              h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, st.body),
              h("span", { class: "mono-meta" }, `${st.websitePath} · Social: ${st.publishedToSocial.join(", ") || "Website only"}`)
            )
          )
        )
      : null,
    chArticles.length
      ? h(
          "div",
          { style: "display:flex;flex-direction:column;gap:0.4rem;" },
          h("span", { class: "mono-meta" }, `WEBSITE ARTICLES (${chArticles.length})`),
          ...chArticles.slice(0, 2).map((art) =>
            h(
              "div",
              { class: "card", style: "padding:0.65rem 0.75rem;gap:0.25rem;" },
              h("div", { class: "card-header" }, h("strong", { style: "font-size:var(--text-xs);" }, art.title), createStatusPill(art.status, "info")),
              h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, art.excerpt),
              h("span", { class: "mono-meta" }, `https://${ch.domain}/articles/${art.slug}`)
            )
          )
        )
      : null,
    chPodcasts.length
      ? h(
          "div",
          { style: "display:flex;flex-direction:column;gap:0.4rem;" },
          h("span", { class: "mono-meta" }, `PODCAST SHOWS (${ch.rssUrl})`),
          ...chPodcasts.slice(0, 2).map((p) =>
            h(
              "div",
              { class: "card", style: "padding:0.65rem 0.75rem;gap:0.2rem;" },
              h("div", { class: "card-header" }, h("strong", { style: "font-size:var(--text-xs);" }, `Ep. ${p.episodeNumber} · ${p.title}`), createStatusPill(`${p.duration}`, "ok")),
              h("span", { class: "mono-meta" }, `${formatNumber(p.downloads)} downloads · ${p.rssStatus}`)
            )
          )
        )
      : null,
    chLinks.length
      ? h(
          "div",
          { style: "display:flex;flex-direction:column;gap:0.4rem;" },
          h("span", { class: "mono-meta" }, `AFFILIATE ENGINE (${ch.shortDomain})`),
          ...chLinks.map((lnk) =>
            h(
              "div",
              { style: "display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:var(--text-xs);border-bottom:1px solid var(--border-subtle);padding-block:0.25rem;" },
              h("span", { class: "mono-meta", style: "color:var(--accent);" }, `${ch.shortDomain}/${lnk.slug}`),
              h("span", { class: "mono-meta" }, `${formatNumber(lnk.clicks)} clicks · $${formatNumber(lnk.estRevenueUsd)}`)
            )
          )
        )
      : null
  );

  const footer = h(
    "div",
    { class: "dialog-footer" },
    h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("close") }, "Close"),
    h(
      "button",
      {
        type: "button",
        class: "btn btn--subtle",
        onClick: (e) => copyText(ch.websiteUrl, e.currentTarget, `Copied ${ch.websiteUrl}`)
      },
      `Copy ${ch.domain}`
    ),
    h(
      "button",
      {
        type: "button",
        class: "btn btn--primary",
        onClick: () => {
          switchChannel(ch.id);
          dialog.close("scoped");
          showToast(`Filtered OS workspace to ${ch.name}`, { tone: "ok" });
        }
      },
      `Scope Dashboard to ${ch.name}`
    )
  );

  showModalContent(modalHeader(`${ch.name} — Autonomous Channel Website`, ch.websiteSummary, dialog), webFrame, footer);
}

export function openNewChannelModal(workspaceId) {
  const dialog = document.getElementById("app-modal");
  if (!dialog) return;

  const nameIn = h("input", { id: "nc-name", class: "input", type: "text", required: true, autofocus: true, placeholder: "e.g., Good Nights Studio" });
  const domIn = h("input", { id: "nc-dom", class: "input input--mono", type: "text", required: true, placeholder: "goodnights.fm" });
  const descIn = h("input", { id: "nc-desc", class: "input", type: "text", required: true, placeholder: "Shorts, podcasts, website articles & affiliates" });

  const capList = ["live-streaming", "shorts", "posts", "statuses", "podcasts", "articles", "affiliates", "website", "social"];
  const capChecks = capList.map((cap) => {
    const chk = h("input", { type: "checkbox", value: cap, checked: ["shorts", "podcasts", "articles", "website", "social"].includes(cap) });
    return { cap, chk, el: h("label", { class: "checklist-item" }, chk, h("span", { style: "font-size:var(--text-xs);" }, cap)) };
  });

  const form = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.85rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const chosenCaps = capChecks.filter((c) => c.chk.checked).map((c) => c.cap);
        const created = addChannelToWorkspace(workspaceId, {
          name: nameIn.value.trim(),
          domain: domIn.value.trim(),
          websiteSummary: descIn.value.trim(),
          capabilities: chosenCaps
        });
        dialog.close("created");
        showToast(`Provisioned channel ${created.name} (${created.domain})`, { tone: "ok" });
      }
    },
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nc-name" }, "Channel Name"), nameIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "nc-dom" }, "Own Website Domain"), domIn)
    ),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "nc-desc" }, "Channel Focus / Website Summary"), descIn),
    h("div", { class: "field" },
      h("span", { class: "field-label" }, "Channel Capabilities"),
      h("div", { style: "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.4rem;" }, ...capChecks.map((c) => c.el))
    ),
    h("div", { class: "dialog-footer" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => dialog.close("cancel") }, "Cancel"),
      h("button", { type: "submit", class: "btn btn--primary" }, "Provision Channel")
    )
  );

  showModalContent(modalHeader("Provision Multi-Channel Endpoint", "Creates a new channel website, RSS feed, and RBAC boundary in tenant", dialog), form);
}
