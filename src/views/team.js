import { ROLES, SCENARIOS, TEAM_UNITS } from "../data/seed.js";
import { openInviteMemberModal } from "../components/modal.js";
import { createScenarioBadge, createStatusPill, h } from "../lib/dom.js";
import {
  can,
  createTeamSection,
  delegateMemberInSection,
  drillIntoUser,
  getActiveContext,
  getState,
  getTenantSlice,
  getTenantTeams,
  setUserLeaveAndCoverage,
  switchRole,
  switchUser,
  updateMemberRole,
  updateTeamSection
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let editingSectionId = null;

export function renderTeam() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const slice = getTenantSlice(snap);
  const canManageTeam = can("team:write", snap);
  const tenantTeams = getTenantTeams(ctx.workspace.id, snap);
  const tenantRoles = ROLES.filter((r) => r.scope === "tenant");
  const wsUsers = snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ctx.workspace.id));

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Teams, Section Leads & Role Delegation"),
      h("p", { class: "page-subtitle" }, `Scoped to ${ctx.workspace.name} · Live Stream, Music, Podcast, Article & Social — customize sections, Team Leads, Research & Content units`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary",
          disabled: !canManageTeam,
          onClick: () => openInviteMemberModal()
        },
        "+ Invite & Delegate Member"
      )
    )
  );

  // Add New Custom Section / Team Builder (Editable by Tenant Admin / Owner)
  const newSecNameIn = h("input", { id: "tm-new-name", class: "input", type: "text", placeholder: "e.g., Documentary Research Unit" });
  const newSecScenSel = h(
    "select",
    { id: "tm-new-scen", class: "select" },
    ...SCENARIOS.map((sc) => h("option", { value: sc.id }, sc.label))
  );
  const newSecLeadSel = h(
    "select",
    { id: "tm-new-lead", class: "select" },
    ...wsUsers.map((u) => h("option", { value: u.id }, `${u.name} (${u.title})`))
  );
  const newSecFocusIn = h("input", { id: "tm-new-focus", class: "input", type: "text", placeholder: "Research briefs, content review & publishing scope" });

  const createSectionCard = canManageTeam
    ? h(
        "section",
        { class: "card", style: "gap:0.65rem;" },
        h("div", { class: "card-header" },
          h("div", {},
            h("h2", { class: "card-title" }, "Configure Custom Section / Team Structure"),
            h("span", { class: "mono-meta" }, "Add or modify tenant sections with a designated Team Lead, Research Team, Content Team & Production units")
          ),
          createStatusPill("Tenant Editable · SQLite Saved", "ok")
        ),
        h("form", {
          class: "form-grid",
          style: "align-items:end;",
          onSubmit: (e) => {
            e.preventDefault();
            if (!newSecNameIn.value.trim()) {
              showToast("Enter a section or team name first", { tone: "warn" });
              return;
            }
            createTeamSection(ctx.workspace.id, {
              name: newSecNameIn.value.trim(),
              scenario: newSecScenSel.value,
              leadUserId: newSecLeadSel.value,
              focus: newSecFocusIn.value.trim() || "Tenant section workflows",
              channelIds: (ctx.workspace.channels ?? []).map((c) => c.id)
            });
            showToast(`Created team section "${newSecNameIn.value.trim()}"`, { tone: "ok" });
          }
        },
          h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-new-name" }, "Section Name"), newSecNameIn),
          h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-new-scen" }, "Scenario"), newSecScenSel),
          h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-new-lead" }, "Assign Team Lead"), newSecLeadSel),
          h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-new-focus" }, "Section Mandate / Focus"), newSecFocusIn),
          h("button", { type: "submit", class: "btn btn--primary" }, "+ Create Custom Team")
        )
      )
    : null;

  // Tenant Channels -> Teams/Sections -> Team Lead + Research/Content Unit Delegation Cards
  const teamsHierarchy = h(
    "section",
    { style: "display:flex;flex-direction:column;gap:0.75rem;" },
    h("div", { class: "card-header" },
      h("h2", { class: "section-heading" }, `${ctx.workspace.name}: Sections, Team Leads & Delegated Units (${tenantTeams.length} Sections)`),
      h("span", { class: "mono-meta" }, "Respective tenant users & delegated sub-team roles only (Platform accounts excluded)")
    ),
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:0.9rem;" },
      ...tenantTeams.map((tm) => {
        const isEditing = editingSectionId === tm.id;
        const unitCounts = tm.assignments.reduce((acc, a) => {
          acc[a.unit] = (acc[a.unit] || 0) + 1;
          return acc;
        }, {});

        const leadSelect = h(
          "select",
          {
            class: "select",
            "aria-label": `Team Lead for ${tm.name}`,
            disabled: !canManageTeam,
            onChange: (e) => {
              updateTeamSection(ctx.workspace.id, tm.id, { leadUserId: e.target.value });
              const promoted = wsUsers.find((u) => u.id === e.target.value);
              showToast(`Assigned ${promoted?.name ?? "teammate"} as Team Lead for ${tm.name}`, { tone: "ok" });
            }
          },
          ...wsUsers.map((u) => h("option", { value: u.id, selected: u.id === tm.leadUserId }, `${u.name} (${u.title})`))
        );

        // Quick Edit Section panel (rename / change scenario / change focus)
        const editNameIn = h("input", { class: "input", type: "text", value: tm.name, "aria-label": `Section name for ${tm.name}` });
        const editFocusIn = h("input", { class: "input", type: "text", value: tm.focus || "", "aria-label": `Section focus for ${tm.name}` });
        const editScenSel = h(
          "select",
          { class: "select", "aria-label": `Scenario for ${tm.name}` },
          ...SCENARIOS.map((sc) => h("option", { value: sc.id, selected: sc.id === tm.scenario }, sc.label))
        );

        // Quick Add / Delegate Teammate into this Section
        const addMemberSel = h(
          "select",
          { class: "select", "aria-label": `Select teammate to assign to ${tm.name}` },
          ...wsUsers.map((u) => h("option", { value: u.id }, u.name))
        );
        const addUnitSel = h(
          "select",
          { class: "select", "aria-label": `Select delegated unit in ${tm.name}` },
          ...TEAM_UNITS.map((unit) => h("option", { value: unit.id, selected: unit.id === "Research Team" }, unit.label))
        );
        const addSubRoleIn = h("input", {
          class: "input",
          type: "text",
          placeholder: "Delegated responsibility (e.g. Research & Fact-Check)",
          "aria-label": `Delegated responsibility in ${tm.name}`
        });

        return h(
          "article",
          { class: "card", style: "gap:0.65rem;" },
          h("div", { class: "card-header" },
            h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;" },
              createScenarioBadge(tm.scenario || "article", SCENARIOS),
              h("h3", { class: "card-title" }, tm.name)
            ),
            h("div", { style: "display:flex;gap:0.35rem;align-items:center;" },
              createStatusPill(`${tm.assignments.length} assigned`, "info"),
              canManageTeam
                ? h("button", {
                    type: "button",
                    class: "btn btn--ghost btn--sm",
                    onClick: () => {
                      editingSectionId = isEditing ? null : tm.id;
                      window.dispatchEvent(new CustomEvent("godflow:rerender"));
                    }
                  }, isEditing ? "Close Edit" : "Customize")
                : null
            )
          ),
          isEditing
            ? h("form", {
                style: "padding:0.6rem;border-radius:var(--radius-sm);background:var(--bg-subtle);display:flex;flex-direction:column;gap:0.45rem;",
                onSubmit: (e) => {
                  e.preventDefault();
                  updateTeamSection(ctx.workspace.id, tm.id, {
                    name: editNameIn.value.trim() || tm.name,
                    scenario: editScenSel.value,
                    focus: editFocusIn.value.trim() || tm.focus
                  });
                  editingSectionId = null;
                  showToast(`Updated section "${editNameIn.value.trim() || tm.name}"`, { tone: "ok" });
                }
              },
                h("div", { class: "form-grid" }, editNameIn, editScenSel),
                editFocusIn,
                h("button", { type: "submit", class: "btn btn--primary btn--sm" }, "Save Section Settings")
              )
            : null,
          h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, tm.focus),
          h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;" },
            ...tm.channels.map((ch) => h("span", { class: "tag" }, `Ch: ${ch.name}`)),
            ...Object.entries(unitCounts).map(([uName, cnt]) => h("span", { class: "tag" }, `${cnt} ${uName}`))
          ),
          h("div", { style: "display:flex;align-items:center;gap:0.5rem;" },
            h("span", { class: "mono-meta", style: "white-space:nowrap;" }, "Section Lead:"),
            leadSelect
          ),
          h(
            "ul",
            { class: "feed-list" },
            ...tm.assignments.map((a) => {
              const unitSelect = h(
                "select",
                {
                  class: "select",
                  style: "max-inline-size:170px;",
                  disabled: !canManageTeam,
                  "aria-label": `Delegated unit for ${a.user.name} in ${tm.name}`,
                  onChange: (e) => {
                    delegateMemberInSection(ctx.workspace.id, tm.id, {
                      userId: a.user.id,
                      unit: e.target.value
                    });
                    showToast(`Delegated ${a.user.name} → ${e.target.value} in ${tm.name}`, { tone: "ok" });
                  }
                },
                ...TEAM_UNITS.map((unit) => h("option", { value: unit.id, selected: unit.id === a.unit }, unit.label))
              );
              const prevEntry = (snap.roleHistory ?? []).find(
                (rh) => rh.workspaceId === ctx.workspace.id && (rh.sectionName === tm.name || rh.roleLabel === a.unit) && rh.userName !== a.user.name
              );
              return h(
                "li",
                { class: "feed-row", style: "flex-wrap:wrap;gap:0.45rem;" },
                h("div", { class: "feed-row-main" },
                  h("div", { style: "display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;" },
                    h("strong", { style: "font-size:var(--text-xs);" }, a.user.name),
                    createStatusPill(a.unit, a.unitTone),
                    createStatusPill(a.role.badge, a.role.tone),
                    a.user.onLeave ? createStatusPill("On Leave", "warn") : null
                  ),
                  h("span", { class: "mono-meta" }, `${a.subRole} · ${a.user.email}${prevEntry ? ` · Previously: ${prevEntry.userName} (${prevEntry.date})` : ""}`)
                ),
                h("div", { style: "display:flex;gap:0.35rem;align-items:center;" },
                  unitSelect,
                  canManageTeam
                    ? h("button", {
                        type: "button",
                        class: "btn btn--primary btn--sm",
                        onClick: () => {
                          delegateMemberInSection(ctx.workspace.id, tm.id, { userId: a.user.id, unit: unitSelect.value });
                          showToast(`Saved ${a.user.name} as ${unitSelect.value} in ${tm.name}`, { tone: "ok" });
                        }
                      }, "Save Role")
                    : null,
                  canManageTeam && tm.assignments.length > 1
                    ? h("button", {
                        type: "button",
                        class: "btn btn--subtle btn--sm",
                        "aria-label": `Remove ${a.user.name} from ${tm.name}`,
                        onClick: () => {
                          delegateMemberInSection(ctx.workspace.id, tm.id, { userId: a.user.id, remove: true });
                          showToast(`Removed ${a.user.name} from ${tm.name}`, { tone: "info" });
                        }
                      }, "Remove")
                    : null
                )
              );
            })
          ),
          canManageTeam
            ? h("form", {
                style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;padding-top:0.4rem;border-top:1px solid var(--border-subtle);",
                onSubmit: (e) => {
                  e.preventDefault();
                  delegateMemberInSection(ctx.workspace.id, tm.id, {
                    userId: addMemberSel.value,
                    unit: addUnitSel.value,
                    subRole: addSubRoleIn.value.trim() || undefined
                  });
                  const who = wsUsers.find((u) => u.id === addMemberSel.value)?.name ?? "Teammate";
                  showToast(`Delegated ${who} → ${addUnitSel.value} in ${tm.name}`, { tone: "ok" });
                }
              },
                h("div", { style: "flex:1 1 130px;" }, addMemberSel),
                h("div", { style: "flex:1 1 145px;" }, addUnitSel),
                h("div", { style: "flex:1 1 170px;" }, addSubRoleIn),
                h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Delegate")
              )
            : null
        );
      })
    )
  );

  // 5-Scenario Squad Ownership Summary Cards
  const scenarioSquad = h(
    "section",
    { style: "display:flex;flex-direction:column;gap:0.75rem;" },
    h("h2", { class: "section-heading" }, "Production Scenarios & Lead Ownership"),
    h(
      "div",
      { class: "grid-3" },
      ...SCENARIOS.map((sc, idx) => {
        const matchedSection = tenantTeams.find((tm) => tm.scenario === sc.id);
        const leadRole = ROLES.find((r) => r.id === sc.leadRole);
        const leadUser =
          matchedSection?.leadUser ??
          snap.users.find((u) => u.userScope !== "platform" && u.workspaceIds.includes(ctx.workspace.id) && u.defaultRoleId === sc.leadRole);
        const activeCount = slice.pipelineItems.filter((p) => p.scenario === sc.id).length;
        const enabledInTenant = ctx.workspace.activeScenarios.includes(sc.id);

        return h(
          "article",
          { class: "card" },
          h(
            "div",
            { class: "card-header" },
            createScenarioBadge(sc.id, SCENARIOS),
            createStatusPill(enabledInTenant ? "Tenant Enabled" : "Standby", enabledInTenant ? "ok" : "warn")
          ),
          h("h3", { class: "card-title" }, `${idx + 1}. ${sc.label}`),
          h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, sc.description),
          h("div", { class: "mono-meta" }, `Stack: ${sc.tool}`),
          h(
            "div",
            { class: "feed-row" },
            h(
              "div",
              { class: "feed-row-main" },
              h("strong", { style: "font-size:var(--text-xs);" }, leadUser?.name ?? "Unassigned"),
              h("span", { class: "mono-meta" }, `${matchedSection ? `${matchedSection.assignments.length} unit members` : leadRole?.badge ?? ""} · ${activeCount} pipeline`)
            ),
            leadUser
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "btn btn--subtle btn--sm",
                    onClick: () => {
                      switchUser(leadUser.id);
                      showToast(`Switched session to ${leadUser.name} (${leadRole?.name})`, { tone: "info" });
                    }
                  },
                  "Act As Lead"
                )
              : null
          )
        );
      })
    )
  );

  // Team Roster Table with Section Units & Inline RBAC Role Delegation
  const rosterTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "team-roster-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "team-roster-caption" }, `Workspace Members & Delegated Section Roles (${slice.teamMembers.length})`),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { scope: "col" }, "Member"),
          h("th", { scope: "col" }, "Section Delegations (Lead / Research / Content)"),
          h("th", { scope: "col" }, "Primary RBAC Role"),
          h("th", { scope: "col" }, "Auth / Passkey"),
          h("th", { scope: "col" }, "Session")
        )
      ),
      h(
        "tbody",
        {},
        ...slice.teamMembers.map((u) => {
          const isCurrent = u.id === ctx.activeUser.id;
          const userDelegations = tenantTeams
            .map((tm) => {
              const a = tm.assignments.find((x) => x.user.id === u.id);
              return a ? { teamName: tm.name, unit: a.unit } : null;
            })
            .filter(Boolean);

          const roleSelect = h(
            "select",
            {
              class: "select",
              disabled: !canManageTeam,
              "aria-label": `Assign role for ${u.name}`,
              onChange: (e) => {
                updateMemberRole(u.id, e.target.value);
                showToast(`Updated ${u.name}'s role`, { tone: "ok" });
              }
            },
            ...tenantRoles.map((r) => h("option", { value: r.id, selected: r.id === u.defaultRoleId }, r.name))
          );

          return h(
            "tr",
            {},
            h(
              "th",
              { scope: "row" },
              h("div", { style: "display:flex;align-items:center;gap:0.55rem;" },
                h("span", { class: "creator-avatar", style: "margin:0;" }, u.initials),
                h("div", {},
                  h("div", {}, u.name),
                  h("div", { class: "mono-meta" }, `${u.email} · ${u.title}`),
                  (u.channelIds ?? []).length
                    ? h("div", { style: "display:flex;gap:0.25rem;flex-wrap:wrap;padding-top:0.2rem;" },
                        ...u.channelIds.map((cid) => h("span", { class: "tag" }, cid === "ch-godflow" ? "GodFlow" : cid))
                      )
                    : null
                )
              )
            ),
            h(
              "td",
              { dataset: { label: "Delegations" } },
              userDelegations.length
                ? h("div", { style: "display:flex;flex-wrap:wrap;gap:0.25rem;" },
                    ...userDelegations.map((d) => h("span", { class: "tag" }, `${d.teamName}: ${d.unit}`))
                  )
                : u.primaryScenarios.length
                  ? h("div", { class: "filter-bar" }, ...u.primaryScenarios.map((scId) => createScenarioBadge(scId, SCENARIOS)))
                  : h("span", { class: "mono-meta" }, "Cross-Functional / Ops")
            ),
            h("td", { dataset: { label: "Role" }, style: "min-inline-size:210px;" }, roleSelect),
            h(
              "td",
              { dataset: { label: "Security" } },
              createStatusPill(u.passkeyEnabled ? "Passkey + MFA" : "Password", u.passkeyEnabled ? "ok" : "info")
            ),
            h(
              "td",
              { dataset: { label: "Impersonate" } },
              h(
                "button",
                {
                  type: "button",
                  class: isCurrent ? "btn btn--primary btn--sm" : "btn btn--subtle btn--sm",
                  onClick: () => {
                    switchUser(u.id);
                    showToast(`Switched active user to ${u.name}`, { tone: "info" });
                  }
                },
                isCurrent ? "Active" : "Impersonate"
              )
            )
          );
        })
      )
    )
  );

  // Full RBAC Role & Permission Matrix
  const capColumns = [
    { key: "pipeline:write", label: "Pipeline" },
    { key: "hub:write", label: "Media Hub" },
    { key: "distribution:write", label: "Distribute" },
    { key: "links:write", label: "/go Links" },
    { key: "sponsors:write", label: "Sponsors" },
    { key: "finance:write", label: "Finance" },
    { key: "team:write", label: "Team" },
    { key: "tenant:admin", label: "Tenant Admin" }
  ];

  const matrixTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "rbac-matrix-caption" },
    h(
      "table",
      { class: "data-table matrix-table" },
      h("caption", { id: "rbac-matrix-caption" }, "RBAC Permissions & 5-Scenario Capability Matrix (Click any Role to Test)"),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { scope: "col" }, "Role"),
          h("th", { scope: "col" }, "Allowed Scenarios"),
          ...capColumns.map((c) => h("th", { scope: "col" }, c.label)),
          h("th", { scope: "col" }, "Test Role")
        )
      ),
      h(
        "tbody",
        {},
        ...tenantRoles.map((r) => {
          const isSelected = r.id === ctx.role.id;
          const hasAll = r.permissions.includes("*");
          return h(
            "tr",
            {},
            h(
              "th",
              { scope: "row" },
              h("div", {}, r.name),
              h("div", { class: "mono-meta" }, r.badge)
            ),
            h(
              "td",
              { dataset: { label: "Scenarios" }, class: "mono" },
              r.scenarios.length >= SCENARIOS.length ? `All ${SCENARIOS.length}` : r.scenarios.length ? r.scenarios.map((id) => SCENARIOS.find((s) => s.id === id)?.short ?? id).join(", ") : "Read-only"
            ),
            ...capColumns.map((c) => {
              const allowed = hasAll || r.permissions.includes(c.key);
              return h(
                "td",
                { dataset: { label: c.label }, class: "mono" },
                allowed ? createStatusPill("✓", "ok") : h("span", { class: "mono-meta" }, "—")
              );
            }),
            h(
              "td",
              { dataset: { label: "Switch" } },
              h(
                "button",
                {
                  type: "button",
                  class: isSelected ? "btn btn--primary btn--sm" : "btn btn--subtle btn--sm",
                  onClick: () => {
                    switchRole(r.id);
                    showToast(`Previewing role: ${r.name}`, { tone: "info" });
                  }
                },
                isSelected ? "Active" : "Switch"
              )
            )
          );
        })
      )
    )
  );

  const leaveUserSel = h("select", { id: "tm-leave-user", class: "select" },
    ...slice.teamMembers.map((u) => h("option", { value: u.id }, `${u.name}${u.onLeave ? " (On Leave)" : ""}`))
  );
  const coverUserSel = h("select", { id: "tm-cover-user", class: "select" },
    ...slice.teamMembers.map((u) => h("option", { value: u.id }, u.name))
  );
  const tempRoleSel = h("select", { id: "tm-temp-role", class: "select" },
    ...ROLES.filter((r) => r.scope === "tenant").map((r) => h("option", { value: r.id }, `${r.name} [${r.badge}]`))
  );
  const durSel = h("select", { id: "tm-temp-dur", class: "select" },
    h("option", { value: "4" }, "4 Hours"),
    h("option", { value: "24", selected: true }, "1 Day (24h)"),
    h("option", { value: "72" }, "3 Days (72h)"),
    h("option", { value: "168" }, "1 Week (7d)")
  );
  const onLeaveUsers = slice.teamMembers.filter((u) => u.onLeave);

  const leaveCoverageCard = h(
    "section",
    { class: "card", style: "gap:0.75rem;" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "card-title" }, "HR Leave & Temporary Role Coverage"),
        h("span", { class: "mono-meta" }, "Temporarily assign another team member to cover a role with an automatic expiry timer")
      ),
      createStatusPill(`${onLeaveUsers.length} On Leave`, onLeaveUsers.length ? "warn" : "ok")
    ),
    h("form", {
      class: "form-grid",
      style: "align-items:end;",
      onSubmit: (e) => {
        e.preventDefault();
        if (leaveUserSel.value === coverUserSel.value) {
          showToast("Select a different teammate to cover the role", { tone: "warn" });
          return;
        }
        setUserLeaveAndCoverage({
          userId: leaveUserSel.value,
          onLeave: true,
          coverUserId: coverUserSel.value,
          tempRoleId: tempRoleSel.value,
          durationHours: Number(durSel.value) || 24
        });
        showToast(`Assigned temporary leave coverage for ${durSel.value}h (synced with HR)`, { tone: "ok" });
      }
    },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-leave-user" }, "Team Member on Leave"), leaveUserSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-cover-user" }, "Covering Teammate"), coverUserSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-temp-role" }, "Temporary Role"), tempRoleSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "tm-temp-dur" }, "Timer / Duration"), durSel),
      h("button", { type: "submit", class: "btn btn--primary", disabled: !canManageTeam }, "Assign Temp Coverage →")
    ),
    onLeaveUsers.length
      ? h("ul", { class: "feed-list" },
          ...onLeaveUsers.map((u) => {
            const cov = slice.teamMembers.find((m) => m.id === u.coveredByUserId);
            const tRole = ROLES.find((r) => r.id === cov?.temporaryRoleId);
            const expLabel = u.leaveExpiresAt ? `Timer: ${u.leaveDurationHours || 24}h (expires ${u.leaveExpiresAt.slice(0, 16).replace("T", " ")})` : "Active";
            return h("li", { class: "feed-row" },
              h("div", { class: "feed-row-main" },
                h("strong", { style: "font-size:var(--text-xs);" }, `${u.name} — On Leave`),
                h("span", { class: "mono-meta" }, `${cov ? `Covered by ${cov.name} as ${tRole?.name || cov.temporaryRoleId}` : "No cover assigned"} · ${expLabel}`)
              ),
              h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                disabled: !canManageTeam,
                onClick: () => {
                  setUserLeaveAndCoverage({ userId: u.id, onLeave: false });
                  showToast(`${u.name} returned from leave — roles restored`, { tone: "ok" });
                }
              }, "End Leave & Restore")
            );
          })
        )
      : null
  );

  const wsHistory = (snap.roleHistory ?? []).filter((rh) => rh.workspaceId === ctx.workspace.id);
  const roleHistoryCard = h(
    "section",
    { class: "card" },
    h("div", { class: "card-header" },
      h("h2", { class: "card-title" }, `Role Assignment History & Calendar Log (${wsHistory.length})`),
      createStatusPill("Calendar & Time Audit", "info")
    ),
    wsHistory.length
      ? h("ul", { class: "feed-list" },
          ...wsHistory.slice(0, 12).map((rh) =>
            h("li", { class: "feed-row" },
              h("div", { class: "feed-row-main" },
                h("strong", { style: "font-size:var(--text-xs);" }, `${rh.userName} → ${rh.roleLabel} (${rh.sectionName})`),
                h("span", { class: "mono-meta" }, `${rh.action}${rh.previousUserName ? ` · Previously: ${rh.previousUserName}` : ""}`)
              ),
              createStatusPill(`${rh.date} ${rh.time}`, "info")
            )
          )
        )
      : h("p", { class: "mono-meta" }, "Role changes, leave coverage, and section assignments will be recorded here with date and time.")
  );

  return [header, ...(createSectionCard ? [createSectionCard] : []), leaveCoverageCard, teamsHierarchy, roleHistoryCard, scenarioSquad, rosterTable, matrixTable];
}
