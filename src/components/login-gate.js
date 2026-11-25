import { ROLES } from "../data/seed.js";
import {
  buildUserTreeOptgroups,
  buildWorkspaceScopeOptgroups,
  createAccountTreeWidget,
  parseCompositeAccountValue
} from "../lib/account-tree.js";
import { createStatusPill, h } from "../lib/dom.js";
import { getState, loginSession, setAuthView } from "../lib/store.js";
import { showToast } from "../lib/toast.js";

export function renderLoginGate() {
  const snap = getState();
  const root = document.getElementById("login-gate-root");
  if (!root) return;

  const initialScopeWsId =
    snap.session.activeUserId === "usr-master" || snap.session.activeUserId === "usr-maint"
      ? "__platform__"
      : snap.session.activeWorkspaceId || snap.workspaces[0].id;
  const initialSelectedUser = snap.users.find((x) => x.id === snap.session.activeUserId) ?? snap.users[0];
  const initialRoleScope = initialScopeWsId === "__platform__" ? "platform" : "tenant";

  const wsSel = h(
    "select",
    { id: "lg-ws", class: "select" },
    ...buildWorkspaceScopeOptgroups({
      snapshot: snap,
      includePlatform: true,
      selectedValue: initialScopeWsId,
      platformLabel: "Master Platform (2 Operators)"
    })
  );

  const userSel = h(
    "select",
    { id: "lg-user", class: "select" },
    ...buildUserTreeOptgroups({
      snapshot: snap,
      scopeWsId: initialScopeWsId,
      selectedUserId: initialSelectedUser?.id,
      compositeValue: true
    })
  );

  const roleSel = h(
    "select",
    { id: "lg-role", class: "select" },
    ...ROLES.filter((r) => r.scope === initialRoleScope).map((r) =>
      h("option", { value: r.id, selected: r.id === (initialSelectedUser?.defaultRoleId || snap.session.activeRoleId) }, `${r.name} [${r.badge}]`)
    )
  );

  const syncUserAndRoleForScope = (scopeWsId, targetUserId = null) => {
    const isPlat = scopeWsId === "__platform__";
    const candidates = isPlat
      ? snap.users.filter((u) => u.userScope === "platform")
      : snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(scopeWsId));
    const chosen = candidates.find((u) => u.id === targetUserId) ?? candidates[0];
    userSel.replaceChildren(
      ...buildUserTreeOptgroups({
        snapshot: snap,
        scopeWsId,
        selectedUserId: chosen?.id,
        compositeValue: true
      })
    );
    if (chosen) {
      userSel.value = `${scopeWsId}::${chosen.id}`;
    }
    roleSel.replaceChildren(
      ...ROLES.filter((r) => r.scope === (isPlat ? "platform" : "tenant")).map((r) =>
        h("option", { value: r.id, selected: r.id === chosen?.defaultRoleId }, `${r.name} [${r.badge}]`)
      )
    );
    if (chosen) roleSel.value = chosen.defaultRoleId;
  };

  wsSel.addEventListener("change", () => {
    syncUserAndRoleForScope(wsSel.value);
  });

  userSel.addEventListener("change", () => {
    const { wsId, userId } = parseCompositeAccountValue(userSel.value, wsSel.value);
    const u = snap.users.find((x) => x.id === userId);
    if (u) {
      if (wsId !== wsSel.value) wsSel.value = wsId;
      const targetScope = wsId === "__platform__" || u.userScope === "platform" ? "platform" : "tenant";
      roleSel.replaceChildren(
        ...ROLES.filter((r) => r.scope === targetScope).map((r) =>
          h("option", { value: r.id, selected: r.id === u.defaultRoleId }, `${r.name} [${r.badge}]`)
        )
      );
      roleSel.value = u.defaultRoleId;
    }
  });

  const usernameIn = h("input", {
    id: "lg-username",
    class: "input",
    type: "text",
    autocomplete: "username",
    placeholder: "arnold, bablu, or user email..."
  });

  const pwdIn = h("input", {
    id: "lg-pass",
    class: "input",
    type: "password",
    autocomplete: "current-password",
    placeholder: "Enter password..."
  });

  const leftForm = h(
    "form",
    {
      style: "display:flex;flex-direction:column;gap:0.9rem;",
      onSubmit: (e) => {
        e.preventDefault();
        const enteredUser = usernameIn.value.trim().toLowerCase();
        const enteredPass = pwdIn.value;
        let matched = null;
        if (enteredUser) {
          matched = snap.users.find(
            (u) =>
              (u.username && u.username.toLowerCase() === enteredUser) ||
              (u.email && u.email.toLowerCase() === enteredUser) ||
              u.name.toLowerCase() === enteredUser
          );
          if (!matched) {
            showToast("Invalid username or email", { tone: "warn" });
            return;
          }
          const expectedPass = matched.password || "1Admin";
          if (enteredPass !== expectedPass) {
            showToast("Incorrect password", { tone: "warn" });
            return;
          }
        } else {
          const { userId } = parseCompositeAccountValue(userSel.value, wsSel.value);
          matched = snap.users.find((u) => u.id === userId);
          if (!matched) {
            showToast("Select or enter a valid user", { tone: "warn" });
            return;
          }
          const expectedPass = matched.password || "1Admin";
          if (enteredPass !== expectedPass) {
            showToast("Incorrect password", { tone: "warn" });
            return;
          }
        }
        const targetWsId = matched.userScope === "platform" ? "__platform__" : (matched.workspaceIds?.[0] || "ws-godflow");
        loginSession({
          userId: matched.id,
          workspaceId: targetWsId,
          roleId: matched.defaultRoleId
        });
        showToast(`Signed in as ${matched.name}`, { tone: "ok" });
      }
    },
    h(
      "div",
      { style: "display:flex;align-items:center;gap:0.65rem;" },
      h("span", { class: "brand-mark", "aria-hidden": "true" }, "GF"),
      h(
        "div",
        {},
        h("h1", { id: "main-heading", class: "dialog-title", tabindex: "-1" }, "Sign in to NewLifeCorp / GodFlow OS"),
        h("p", { class: "page-subtitle" }, "Tree Hierarchy: 2 Platform Accounts → Tenants → Tenant Users")
      )
    ),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "lg-ws" }, "1. Platform or Target Tenant"), wsSel),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "lg-user" }, "2. Scoped Account in Tree"), userSel),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "lg-role" }, "3. Session Role / Elevation"), roleSel),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "lg-username" }, "Username or Email"), usernameIn),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "lg-pass" }, "Password"), pwdIn),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
      h("button", { type: "submit", class: "btn btn--primary", style: "flex:1;" }, "Sign In as Selected Demo User"),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--subtle",
          onClick: () => {
            loginSession({ userId: "usr-master", workspaceId: "__platform__", roleId: "ultimate_master" });
            showToast("Verified NewLifeCorp Founder Passkey — Ultimate Master Ready", { tone: "warn" });
          }
        },
        "Passkey (Ultimate Master)"
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--subtle",
          style: "flex-basis:100%;",
          onClick: () => setAuthView("public")
        },
        "← Back to NewLifeCorp Public Homepage"
      )
    )
  );

  const treePanel = createAccountTreeWidget({
    snapshot: snap,
    selectedScopeWsId: initialScopeWsId,
    selectedUserId: initialSelectedUser?.id,
    includePlatform: true,
    expandAllTenants: false,
    actionLabel: "Sign In →",
    onSelectAccount: ({ wsId, userId, roleId, user, role, workspace }) => {
      loginSession({ userId, workspaceId: wsId, roleId });
      showToast(
        wsId === "__platform__"
          ? `Signed in on Platform Root: ${user.name} (${role?.badge})`
          : `Signed in to ${workspace?.name}: ${user.name} (${role?.badge})`,
        { tone: "ok" }
      );
    }
  });

  const rightGrid = h(
    "div",
    { style: "display:flex;flex-direction:column;gap:0.75rem;" },
    h("h2", { class: "card-title" }, "Account Tree Quick Sign-In (Platform → Tenants → Users)"),
    h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, "Expand Platform (2 accounts) or any Registered Tenant below to click into its users and preview their exact isolated menus."),
    treePanel
  );

  root.replaceChildren(h("div", { class: "login-card" }, leftForm, rightGrid));
}
