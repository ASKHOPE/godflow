import { ROLES, SCENARIOS } from "../data/seed.js";
import { createAccountTreeWidget } from "../lib/account-tree.js";
import { createScenarioBadge, createStatusPill, formatCurrency, formatNumber, h, svgEl } from "../lib/dom.js";
import { navigateTo } from "../lib/router.js";
import {
  convertLeadToTenant,
  enterSandboxWorkingCopy,
  getActiveContext,
  getState,
  loginSession,
  registerCompanyOnNewLifeCorp,
  setAuthView,
  signOutSession,
  switchWorkspace
} from "../lib/store.js";
import { toggleRenderedScheme } from "../lib/theme.js";
import { showToast } from "../lib/toast.js";
import { formatPlanPrice } from "../lib/workbench-helpers.js";

let formState = {
  selectedPlanId: "plan-growth",
  companyName: "",
  domain: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  showPassword: false,
  channels: [
    { id: "c1", name: "Flagship Media", domain: "", capabilities: ["shorts", "posts", "statuses", "podcasts", "articles", "website", "social"] },
    { id: "c2", name: "Live & Podcast Desk", domain: "", capabilities: ["live-streaming", "podcasts", "affiliates", "website"] }
  ],
  scenarios: ["stock", "podcast", "article", "social"],
  teamMembers: [
    { id: "tm1", name: "Clara Ruiz", email: "clara@company.io", roleId: "editor_newsletter" },
    { id: "tm2", name: "Marcus Reed", email: "marcus@company.io", roleId: "podcast_producer" },
    { id: "tm3", name: "Sonia Park", email: "sonia@company.io", roleId: "trader_host" }
  ]
};

/**
 * Attaches interactive blur/input/submit ARIA validation synchronization + fallback
 * tracking without premature red borders during initial typing.
 */
function installAccessibleValidation(form) {
  if (!form || typeof document === "undefined") return;

  let announcer = document.getElementById("nlc-error-announcer");
  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = "nlc-error-announcer";
    announcer.setAttribute("aria-live", "polite");
    announcer.className = "visually-hidden";
    document.body?.append?.(announcer);
  }

  let announceTimer;
  let announcedField;
  const flagged = new WeakSet();
  const announced = new WeakSet();
  const dirtyMap = new WeakMap();

  const linkError = (el, shown) => {
    const errorId = el.dataset?.error;
    if (!errorId) return;
    const ids = (el.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
    else el.removeAttribute("aria-describedby");
  };

  const announceError = (el) => {
    const errEl = document.getElementById(el.dataset?.error);
    if (!errEl) return;
    clearTimeout(announceTimer);
    announcer.textContent = "";
    announcedField = el;
    const errText = errEl.textContent?.replace(/\s+/g, " ").trim() || "Invalid field";
    announceTimer = setTimeout(() => {
      announcer.textContent = errText;
    }, 500);
  };

  const supportsUserInvalid = typeof CSS !== "undefined" && CSS.supports?.("selector(:user-invalid)");

  const syncField = (el, announce = false) => {
    if (!el.matches?.("input, select, textarea")) return;
    const invalid = supportsUserInvalid
      ? el.matches(":user-invalid")
      : Boolean(dirtyMap.get(el)?.hasBlurred && !el.validity?.valid);

    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute("aria-invalid", "true");
      if (!supportsUserInvalid) {
        el.classList.add("user-invalid-fallback");
        el.classList.remove("user-valid-fallback");
      }
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
      el.setAttribute("aria-invalid", "false");
      if (!supportsUserInvalid) {
        el.classList.remove("user-invalid-fallback");
        if (dirtyMap.get(el)?.hasBlurred) el.classList.add("user-valid-fallback");
      }
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = "";
      }
    }
  };

  for (const el of form.querySelectorAll("input, select, textarea")) {
    syncField(el, false);
  }

  form.addEventListener(
    "blur",
    (e) => {
      const st = dirtyMap.get(e.target) || { hasInteracted: true, hasBlurred: false };
      st.hasBlurred = true;
      dirtyMap.set(e.target, st);
      syncField(e.target, true);
    },
    true
  );

  form.addEventListener("input", (e) => {
    const st = dirtyMap.get(e.target) || { hasInteracted: false, hasBlurred: false };
    st.hasInteracted = true;
    dirtyMap.set(e.target, st);
    if (e.target.hasAttribute?.("aria-invalid")) syncField(e.target, false);
  });

  form.addEventListener(
    "change",
    (e) => {
      const st = dirtyMap.get(e.target) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      st.hasBlurred = true;
      dirtyMap.set(e.target, st);
      syncField(e.target, true);
    },
    true
  );

  form.addEventListener(
    "invalid",
    (e) => {
      announced.add(e.target);
      dirtyMap.set(e.target, { hasInteracted: true, hasBlurred: true });
      syncField(e.target, false);
    },
    true
  );
}

function buildPublicNavbar(activeSection = "home") {
  return h(
    "header",
    { class: "nlc-header" },
    h(
      "div",
      { class: "nlc-header-inner" },
      h(
        "a",
        { href: "/", class: "nlc-brand" },
        h("span", { class: "brand-mark", "aria-hidden": "true" }, "NL"),
        h(
          "span",
          { style: "display:flex;flex-direction:column;line-height:1.1;" },
          h("strong", { style: "font-size:var(--text-base);" }, "NewLifeCorp"),
          h("span", { class: "mono-meta" }, "newlifecorp.io · Multi-Tenant Creator Cloud")
        )
      ),
      h(
        "nav",
        { class: "nlc-nav", "aria-label": "NewLifeCorp navigation" },
        h("a", { href: activeSection === "home" ? "#nlc-ultimate" : "/#nlc-ultimate", class: "nlc-nav-link", "aria-current": activeSection === "home" ? "page" : undefined }, "Ultimate Suite"),
        h("a", { href: activeSection === "home" ? "#nlc-demos" : "/#nlc-demos", class: "nlc-nav-link" }, "Login as Demo"),
        h("a", { href: activeSection === "home" ? "#nlc-scenarios" : "/#nlc-scenarios", class: "nlc-nav-link" }, "Workflows"),
        h("a", { href: activeSection === "home" ? "#nlc-plans" : "/#nlc-plans", class: "nlc-nav-link" }, "Plans & Pricing"),
        h("a", { href: "/register", class: "nlc-nav-link", "aria-current": activeSection === "register" ? "page" : undefined }, "Register Company")
      ),
      h(
        "div",
        { style: "display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;" },
        h(
          "button",
          { type: "button", class: "btn btn--ghost btn--sm", onClick: () => toggleRenderedScheme() },
          "Theme"
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn--subtle btn--sm",
            onClick: () => {
              setAuthView("login");
              navigateTo("command");
            }
          },
          "Demo Sign-In Gate"
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn--primary btn--sm",
            onClick: () => {
              loginSession({ userId: "usr-master", workspaceId: "__platform__", roleId: "ultimate_master" });
              navigateTo("command");
              showToast("Signed in as Ultimate Master (NewLifeCorp Platform)", { tone: "warn" });
            }
          },
          "Launch Ultimate Master Demo →"
        )
      )
    )
  );
}

function buildPlansGridSection(pd, { linkToRegister = false } = {}) {
  return h(
    "section",
    { id: "nlc-plans", style: "display:flex;flex-direction:column;gap:0.75rem;" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "section-heading" }, "NewLifeCorp Multi-Tenant Pricing Tiers (3 Standard + Custom)"),
        h("span", { class: "mono-meta" }, linkToRegister ? "Choose from 3 core tiers or Custom Enterprise Pricing on /register" : "Select Starter, Growth, Ultimate, or Custom Enterprise Pricing below")
      ),
      linkToRegister ? h("a", { href: "/register", class: "btn btn--primary btn--sm" }, "Configure Selected Plan on /register →") : null
    ),
    h(
      "div",
      { class: "grid-2" },
      ...pd.saasPlans.map((plan) => {
        const checked = formState.selectedPlanId === plan.id;
        return h(
          "label",
          { class: "card nlc-choice-card" },
          h("input", {
            type: "radio",
            name: "nlc-plan-select",
            value: plan.id,
            checked,
            onChange: () => {
              formState.selectedPlanId = plan.id;
              const summary = document.getElementById("nlc-selected-plan-summary");
              if (summary) summary.textContent = `${plan.name} — ${formatPlanPrice(plan, { compact: true })} (${plan.seatLimit} seats · ${plan.channelLimit} channels)`;
            }
          }),
          h("div", { class: "card-header" },
            h("strong", { style: "font-size:var(--text-base);" }, plan.name),
            createStatusPill(plan.badge, plan.id === "plan-growth" ? "ok" : plan.isCustom ? "warn" : "info")
          ),
          h("div", { style: "font-size:1.45rem;font-weight:700;" },
            plan.isCustom || !plan.monthlyPriceUsd ? "Custom Pricing" : `$${formatNumber(plan.monthlyPriceUsd)}`,
            h("span", { class: "mono-meta", style: "font-weight:400;" }, plan.isCustom ? " · dedicated cluster & custom SLA" : " / month · billed per tenant")
          ),
          h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, plan.summary),
          h(
            "ul",
            { style: "margin:0;padding-inline-start:1.1rem;font-size:var(--text-xs);color:var(--text-secondary);display:flex;flex-direction:column;gap:0.2rem;" },
            ...plan.features.map((f) => h("li", {}, f))
          )
        );
      })
    )
  );
}

function buildSiteFooter() {
  return h(
    "footer",
    { class: "nlc-footer" },
    h("div", { style: "display:flex;align-items:center;gap:0.65rem;" },
      h("span", { class: "brand-mark", style: "inline-size:28px;block-size:28px;font-size:0.75rem;", "aria-hidden": "true" }, "NL"),
      h("strong", {}, "NewLifeCorp"),
      h("span", { class: "mono-meta" }, "newlifecorp.io · Multi-Tenant Creator Operating System")
    ),
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.85rem;align-items:center;" },
      h("a", { href: "/#nlc-ultimate", class: "nlc-nav-link" }, "Ultimate Suite"),
      h("a", { href: "/#nlc-demos", class: "nlc-nav-link" }, "Account Tree Demos"),
      h("a", { href: "/#nlc-plans", class: "nlc-nav-link" }, "Pricing"),
      h("a", { href: "/register", class: "nlc-nav-link" }, "Register Company"),
      h("span", { class: "mono-meta" }, "© 2026 NewLifeCorp Inc.")
    )
  );
}

/**
 * Renders the public Homepage (`/`) and authenticated SaaS Portal (`/newlifecorp`).
 * Keeps the Homepage clean with a dedicated CTA card linking to `/register` rather than embedding the huge onboarding form inline.
 */
export function renderNewLifeCorpPage({ publicMode = false } = {}) {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const pd = snap.platformData;

  const totalMrr = snap.workspaces.reduce((s, w) => s + (w.subscriptionStatus === "Suspended" ? 0 : w.monthlyPriceUsd || 0), 0);
  const totalChannels = snap.workspaces.reduce((s, w) => s + (w.channels?.length || 1), 0);

  const publicNavbar = publicMode
    ? buildPublicNavbar("home")
    : h(
        "div",
        { class: "page-head" },
        h(
          "div",
          { class: "page-title-group" },
          h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "NewLifeCorp — SaaS Portal & Ultimate Suite Options"),
          h("p", { class: "page-subtitle" }, `newlifecorp.io · Public company portal, Ultimate Suite plans, /register onboarding & Ultimate Master sales pipeline`)
        ),
        h(
          "div",
          { class: "page-actions" },
          h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle",
              onClick: () => {
                signOutSession({ toPublicHomepage: true });
                navigateTo("command");
                showToast("Viewing public NewLifeCorp SaaS Homepage", { tone: "info" });
              }
            },
            "Preview Public Homepage"
          ),
          h("a", { href: "/register", class: "btn btn--subtle" }, "Open Company Registration"),
          h("a", { href: "/subscriptions", class: "btn btn--subtle" }, "Manage Subscriptions"),
          h("a", { href: "/suite", class: "btn btn--subtle" }, "Suite Modules (3 Versions)"),
          ctx.isUltimateMaster
            ? h("a", { href: "/emulate", class: "btn btn--primary" }, "Emulate Sandbox →")
            : h(
                "button",
                {
                  type: "button",
                  class: "btn btn--primary",
                  onClick: () => {
                    loginSession({ userId: "usr-master", workspaceId: "__platform__", roleId: "ultimate_master" });
                    navigateTo("command");
                    showToast("Elevated to Ultimate Master (Julian Vance)", { tone: "warn" });
                  }
                },
                "Enter Ultimate Master Mode"
              )
        )
      );

  const scenarioVisualSvg = (scId) => {
    const stroke = scId === "stock" ? "var(--scen-stock)" : scId === "video" || scId === "gaming" ? "var(--scen-gaming)" : scId === "music" ? "var(--scen-music)" : scId === "podcast" ? "var(--scen-podcast)" : scId === "article" ? "var(--scen-article)" : "var(--scen-social)";
    const paths = {
      stock: [svgEl("polyline", { points: "3,18 9,12 14,15 21,6", fill: "none", stroke, "stroke-width": "2.2", "stroke-linecap": "round" }), svgEl("circle", { cx: "21", cy: "6", r: "2.3", fill: stroke })],
      video: [svgEl("rect", { x: "2", y: "5", width: "14", height: "14", rx: "2.2", fill: "none", stroke, "stroke-width": "2" }), svgEl("path", { d: "M16 10l6-3v10l-6-3z", fill: "none", stroke, "stroke-width": "2", "stroke-linejoin": "round" })],
      music: [svgEl("path", { d: "M9 18V6l11-2v12", fill: "none", stroke, "stroke-width": "2", "stroke-linecap": "round" }), svgEl("circle", { cx: "6.5", cy: "18", r: "2.5", fill: stroke }), svgEl("circle", { cx: "17.5", cy: "16", r: "2.5", fill: stroke })],
      podcast: [svgEl("rect", { x: "9", y: "3", width: "6", height: "11", rx: "3", fill: "none", stroke, "stroke-width": "2" }), svgEl("path", { d: "M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8", fill: "none", stroke, "stroke-width": "2", "stroke-linecap": "round" })],
      article: [svgEl("rect", { x: "4", y: "3", width: "16", height: "18", rx: "2", fill: "none", stroke, "stroke-width": "2" }), svgEl("path", { d: "M8 8h8M8 12h8M8 16h5", stroke, "stroke-width": "2", "stroke-linecap": "round" })],
      social: [svgEl("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2.5", fill: "none", stroke, "stroke-width": "2" }), svgEl("circle", { cx: "9", cy: "10", r: "2", fill: stroke }), svgEl("path", { d: "M4 17l5-4 4 3 4-4 4 5", fill: "none", stroke, "stroke-width": "2", "stroke-linecap": "round" })]
    };
    return svgEl("svg", { viewBox: "0 0 24 24", width: "26", height: "26", "aria-hidden": "true" }, ...(paths[scId] ?? paths.article));
  };

  const heroSection = h(
    "section",
    { class: "card nlc-hero", "aria-labelledby": publicMode ? "main-heading" : "nlc-hero-title" },
    h(
      "div",
      { class: "nlc-hero-grid" },
      h(
        "div",
        { style: "display:flex;flex-direction:column;gap:0.85rem;" },
        h("div", { style: "display:flex;gap:0.45rem;flex-wrap:wrap;" },
          createStatusPill("NEWLIFECORP CREATOR CLOUD", "warn"),
          createStatusPill(`${snap.workspaces.length} Live Company Networks`, "ok"),
          createStatusPill(`${(pd.suiteModules ?? []).length} Suite Modules · 3 Tracks`, "info")
        ),
        h(
          publicMode ? "h1" : "h2",
          { id: publicMode ? "main-heading" : "nlc-hero-title", class: "nlc-hero-heading", tabindex: publicMode ? "-1" : undefined },
          pd.heroHeadline
        ),
        h("p", { class: "page-subtitle nlc-hero-copy", style: "max-inline-size:60ch;font-size:var(--text-base);" }, pd.heroSubhead),
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;gap:0.65rem;padding-top:0.25rem;" },
          h("a", { href: "#nlc-demos", class: "btn btn--primary" }, "Try Live Account Demos →"),
          h("a", { href: "/register", class: "btn btn--subtle" }, "Register Your Company →"),
          h("a", { href: "#nlc-ultimate", class: "btn btn--ghost" }, "Explore Platform Suite"),
          !publicMode ? h("a", { href: "/", class: "btn btn--ghost" }, "Back to Command Center") : null
        )
      ),
      h(
        "figure",
        { class: "nlc-hero-media", style: "margin:0;" },
        h("img", {
          src: "/images/hero-platform.jpg",
          alt: "NewLifeCorp multi-tenant creator operating system showcasing isolated tenant consoles, waveforms, and charts",
          width: "1376",
          height: "768",
          fetchpriority: "high"
        }),
        h("figcaption", { class: "nlc-hero-caption" },
          h("strong", {}, "Multi-Tenant Platform Console"),
          h("span", { class: "mono-meta" }, "2 Platform Operators → Isolated Customer Tenants (GodFlow & Tradester) → Teams & Users")
        )
      )
    )
  );

  const trustStrip = h(
    "section",
    { class: "nlc-trust-strip", "aria-label": "NewLifeCorp platform scale" },
    h("div", { class: "nlc-trust-stat" }, h("strong", {}, `${snap.workspaces.length} Customer Tenants`), h("span", { class: "mono-meta" }, "GodFlow & Tradester isolated via PG17 RLS")),
    h("div", { class: "nlc-trust-stat" }, h("strong", {}, `${totalChannels} Brand Channels`), h("span", { class: "mono-meta" }, "GodFlow & Tradester websites")),
    h("div", { class: "nlc-trust-stat" }, h("strong", {}, "Podcast Script + Simulcast"), h("span", { class: "mono-meta" }, "Script composer, teleprompter & multi-platform live stream")),
    h("div", { class: "nlc-trust-stat" }, h("strong", {}, "3 Release Tracks"), h("span", { class: "mono-meta" }, "Experimental, Current (Subscribed) & LTS per module"))
  );

  const visualShowcase = h(
    "section",
    { id: "nlc-ultimate", style: "display:flex;flex-direction:column;gap:0.9rem;" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "nlc-section-title" }, "Built Like a Modern Media Cloud — Visually Unified, Strictly Isolated"),
        h("span", { class: "mono-meta" }, "NewLifeCorp Ultimate Platform combines multi-tenant SaaS operations with specialized creator studios")
      ),
      createStatusPill("ULTIMATE SUITE · $4,900/MO", "warn")
    ),
    h(
      "div",
      { class: "grid-3" },
      h("article", { class: "card nlc-visual-card" },
        h("img", {
          src: "/images/suite-versions.jpg",
          alt: "Three parallel software release tracks representing Experimental, Current, and LTS module versions",
          width: "1376",
          height: "768",
          loading: "lazy"
        }),
        h("header", { class: "card-header" }, h("h3", { class: "card-title" }, "Suite 3-Version Engine & Sandbox"), createStatusPill("EXP · CUR · LTS", "info")),
        h("p", {}, "Assign Suite modules per tenant requirement, ship updates across Experimental, Current, or LTS tracks site-wide, and test safely in Sandbox Working Copy."),
        h("footer", { style: "display:flex;gap:0.4rem;flex-wrap:wrap;" },
          h("button", {
            type: "button",
            class: "btn btn--primary btn--sm",
            onClick: () => {
              loginSession({ userId: "usr-master", workspaceId: "__platform__", roleId: "ultimate_master" });
              enterSandboxWorkingCopy({ label: "Homepage Sandbox Tour", workspaceId: "ws-godflow" });
              navigateTo("emulate");
              showToast("Launched interactive Sandbox Emulator!", { tone: "warn" });
            }
          }, "Try Sandbox Emulator →")
        )
      ),
      h("article", { class: "card nlc-visual-card" },
        h("img", {
          src: "/images/studio-media.jpg",
          alt: "Creator desk featuring studio microphone, audio faders, candlestick market ticker, and streaming lens",
          width: "1376",
          height: "768",
          loading: "lazy"
        }),
        h("header", { class: "card-header" }, h("h3", { class: "card-title" }, "Videos, Shorts, Podcasts & Live"), createStatusPill("6 STUDIO MODES", "ok")),
        h("p", {}, "16:9 long videos & 9:16 vertical Shorts studio, podcast scripts + multi-platform live stream (YT, X, Twitch, LinkedIn) & live market desks."),
        h("footer", {}, h("a", { href: "#nlc-demos", class: "btn btn--subtle btn--sm" }, "Demo Creator Studios →"))
      ),
      h("article", { class: "card nlc-visual-card" },
        h("img", {
          src: "/images/editorial-growth.jpg",
          alt: "Floating layered editorial HTML canvas, social image frames, and multi-channel website blocks",
          width: "1376",
          height: "768",
          loading: "lazy"
        }),
        h("header", { class: "card-header" }, h("h3", { class: "card-title" }, "Sources, Articles, Thumbnails & GIFs"), createStatusPill("GODFLOW + TRADESTER", "info")),
        h("p", {}, "Gather online sources across studios, write Rich HTML articles, design YT thumbnails & animated GIFs, and organize assets by Folder, Tree or Timeline."),
        h("footer", {}, h("a", { href: "#nlc-plans", class: "btn btn--subtle btn--sm" }, "Compare SaaS Plans →"))
      )
    )
  );

  const platformUsersCount = snap.users.filter((u) => u.userScope === "platform").length;
  const tenantUsersCount = snap.users.filter((u) => u.userScope !== "platform").length;

  const accountTreeDemo = createAccountTreeWidget({
    snapshot: snap,
    selectedScopeWsId: snap.session.waterfallLevel === "platform" ? "__platform__" : snap.session.activeWorkspaceId,
    selectedUserId: snap.session.activeUserId,
    includePlatform: true,
    expandAllTenants: false,
    actionLabel: "Launch Demo →",
    onSelectAccount: ({ wsId, userId, roleId, user, role, workspace }) => {
      loginSession({ userId, workspaceId: wsId, roleId });
      navigateTo("command");
      showToast(
        wsId === "__platform__"
          ? `Signed in on Platform Root as ${user.name} (${role?.badge})`
          : `Signed in under ${workspace?.name} as ${user.name} (${role?.badge})`,
        { tone: "ok" }
      );
    }
  });

  const demoLauncher = h(
    "section",
    { id: "nlc-demos", class: "card", style: "gap:0.95rem;" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { class: "nlc-section-title" }, "Interactive Account Tree — Login as Any Demo Account"),
        h("span", { class: "mono-meta" }, `Organized Platform Hierarchy: ${platformUsersCount} Platform Accounts (Master & Maintenance) → ${snap.workspaces.length} Tenants (GodFlow & Tradester) → ${tenantUsersCount} Team Users`)
      ),
      h("button", {
        type: "button",
        class: "btn btn--subtle btn--sm",
        onClick: () => {
          setAuthView("login");
          navigateTo("command");
        }
      }, "Open Classic Sign-In Form →")
    ),
    accountTreeDemo
  );

  const scenariosShowcase = h(
    "section",
    { id: "nlc-scenarios", style: "display:flex;flex-direction:column;gap:0.85rem;" },
    h("div", { class: "card-header" },
      h("h2", { class: "nlc-section-title" }, "6 Specialized Creator Workflows Built Into One Suite"),
      h("span", { class: "mono-meta" }, "Live Stream, Music, Podcast, Article, Videos & Shorts, and Thumbnails, GIFs & Social — isolated per team & RBAC role")
    ),
    h(
      "div",
      { class: "grid-3" },
      ...SCENARIOS.map((sc, i) =>
        h(
          "article",
          { class: "card nlc-card" },
          h("div", { class: "nlc-scen-thumb" },
            scenarioVisualSvg(sc.id),
            createScenarioBadge(sc.id, SCENARIOS),
            h("span", { class: "mono-meta" }, `0${i + 1}`)
          ),
          h("h3", { class: "card-title" }, sc.label),
          h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, sc.description),
          h("footer", { class: "mono-meta", style: "margin-top:auto;" }, `Built-in stack: ${sc.tool}`)
        )
      )
    )
  );

  const plansGrid = buildPlansGridSection(pd, { linkToRegister: true });
  const selectedPlanObj = pd.saasPlans.find((p) => p.id === formState.selectedPlanId) ?? pd.saasPlans[1];

  // Concise Register CTA Card kept on the Homepage linking cleanly to dedicated `/register` page
  const registerCtaCard = h(
    "section",
    { id: "nlc-register", class: "card nlc-hero", "aria-labelledby": "nlc-cta-heading" },
    h("div", { class: "card-header" },
      h("div", {},
        h("h2", { id: "nlc-cta-heading", class: "nlc-section-title" }, "Ready to Register Your Company & Configure Your Multi-Tenant Suite?"),
        h("p", { class: "page-subtitle", style: "max-inline-size:66ch;margin-top:0.35rem;" },
          `Launch an isolated PostgreSQL + SQLite-backed company tenant (just like GodFlow & Tradester) with custom channels, creator teams for Articles, Podcasts + Multi-Platform Live Streaming, Live Markets & Social Canvas.`
        )
      ),
      createStatusPill(`Selected: ${selectedPlanObj.name} (${formatPlanPrice(selectedPlanObj, { compact: true })})`, "ok")
    ),
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;justify-content:space-between;" },
      h("span", { class: "mono-meta" }, "Opens dedicated /register onboarding builder · Instant multi-channel provisioning + RBAC team setup"),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.55rem;" },
        h("a", { href: "/register", class: "btn btn--primary" }, "Register Company & Configure Suite →"),
        h("a", { href: "#nlc-demos", class: "btn btn--subtle" }, "Explore Live Tenant Demos")
      )
    )
  );

  // Master SaaS Directory & Leads Table (Visible cleanly when authenticated as Ultimate Master or Admin)
  const masterCommercialPanel =
    !publicMode && (ctx.isUltimateMaster || ctx.isGodMode)
      ? h(
          "section",
          { class: "card", style: "gap:0.85rem;" },
          h(
            "div",
            { class: "card-header" },
            h("div", {},
              h("h2", { class: "card-title" }, "NewLifeCorp Commercial Pipeline & Active Customer Directory"),
              h("span", { class: "mono-meta" }, `SaaS MRR: ${formatCurrency(totalMrr)}/mo · ${snap.workspaces.length} Live Tenants · ${pd.enterpriseLeads.length} Registrations`)
            ),
            createStatusPill(ctx.isUltimateMaster ? "ULTIMATE MASTER CLEARANCE" : "READ PREVIEW (MASTER FOR EDITS)", ctx.isUltimateMaster ? "ok" : "warn")
          ),
          h(
            "div",
            { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "nlc-leads-cap" },
            h(
              "table",
              { class: "data-table" },
              h("caption", { id: "nlc-leads-cap" }, "Companies Registered via newlifecorp.io"),
              h("thead", {},
                h("tr", {},
                  h("th", { scope: "col" }, "Company"),
                  h("th", { scope: "col" }, "Owner Contact"),
                  h("th", { scope: "col" }, "Plan / MRR"),
                  h("th", { scope: "col" }, "Requested Channels"),
                  h("th", { scope: "col" }, "Status"),
                  h("th", { scope: "col" }, "Master Action")
                )
              ),
              h("tbody", {},
                ...pd.enterpriseLeads.map((ld) =>
                  h(
                    "tr",
                    {},
                    h("th", { scope: "row" }, h("div", {}, ld.companyName), h("div", { class: "mono-meta" }, ld.domain)),
                    h("td", { dataset: { label: "Owner" } }, `${ld.contactName} (${ld.contactEmail})`),
                    h("td", { dataset: { label: "Plan" }, class: "mono" }, `${ld.planName} · ${ld.monthlyPriceUsd ? `$${ld.monthlyPriceUsd}/mo` : "Custom Quote"}`),
                    h("td", { dataset: { label: "Channels" } }, h("span", { class: "mono-meta" }, `${(ld.channelsRequested ?? []).join(" · ")} (${ld.teamSize} seats)`)),
                    h("td", { dataset: { label: "Status" } }, createStatusPill(ld.status, ld.status === "Live Tenant" ? "ok" : "info")),
                    h(
                      "td",
                      { dataset: { label: "Action" } },
                      ctx.isUltimateMaster
                        ? h(
                            "button",
                            {
                              type: "button",
                              class: ld.status === "Live Tenant" ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
                              onClick: () => {
                                const targetWs = convertLeadToTenant(ld.id);
                                if (targetWs) {
                                  switchWorkspace(targetWs);
                                  navigateTo("command");
                                  showToast(`Opened customer tenant ${ld.companyName}`, { tone: "ok" });
                                }
                              }
                            },
                            ld.status === "Live Tenant" ? "Open Tenant →" : "Approve & Provision"
                          )
                        : h("span", { class: "mono-meta" }, "Master only")
                    )
                  )
                )
              )
            )
          )
        )
      : null;

  const siteFooter = publicMode ? buildSiteFooter() : null;

  const pageNodes = [
    publicNavbar,
    heroSection,
    trustStrip,
    visualShowcase,
    demoLauncher,
    scenariosShowcase,
    plansGrid,
    registerCtaCard,
    ...(masterCommercialPanel ? [masterCommercialPanel] : []),
    ...(siteFooter ? [siteFooter] : [])
  ];

  return publicMode
    ? h("div", { class: "nlc-public-shell" }, ...pageNodes)
    : pageNodes;
}

/**
 * Dedicated `/register` page containing the full Multi-Fieldset Company Registration & Suite Configuration Builder.
 */
export function renderRegisterPage({ publicMode = false } = {}) {
  const snap = getState();
  const pd = snap.platformData;

  const headerNode = publicMode
    ? buildPublicNavbar("register")
    : h(
        "div",
        { class: "page-head" },
        h(
          "div",
          { class: "page-title-group" },
          h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Register Company & Configure Your Multi-Tenant Suite"),
          h("p", { class: "page-subtitle" }, "Provision a dedicated tenant workspace with custom domains, channels, workflows, and team roles.")
        ),
        h(
          "div",
          { class: "page-actions" },
          h("a", { href: "/", class: "btn btn--subtle" }, "← Back to Command Center")
        )
      );

  const heroIntro = publicMode
    ? h(
        "section",
        { class: "card", style: "gap:0.55rem;" },
        h("div", { class: "card-header" },
          h("div", {},
            createStatusPill("NEWLIFECORP SELF-SERVE ONBOARDING", "ok"),
            h("h1", { id: "main-heading", class: "nlc-hero-heading", tabindex: "-1", style: "margin-top:0.35rem;" }, "Register Your Company & Configure Your Multi-Tenant Suite")
          ),
          h("a", { href: "/", class: "btn btn--ghost btn--sm" }, "← Back to NewLifeCorp Home")
        ),
        h("p", { class: "page-subtitle", style: "margin:0;" }, "Configure your SaaS subscription tier, primary domain, brand channels, production teams (Article, Podcast & Simulcast, Live Streaming, Social), and persist straight to your SQLite + PostgreSQL tenant database.")
      )
    : null;

  const plansGrid = buildPlansGridSection(pd, { linkToRegister: false });

  const companyIn = h("input", {
    id: "nlc-company",
    name: "organization",
    class: "input",
    type: "text",
    required: true,
    autocomplete: "organization",
    value: formState.companyName,
    placeholder: "e.g., Horizon Media Corp",
    "data-error": "nlc-company-err"
  });
  const domainIn = h("input", {
    id: "nlc-domain",
    name: "domain",
    class: "input input--mono",
    type: "text",
    required: true,
    pattern: "[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}",
    autocorrect: "off",
    autocapitalize: "none",
    spellcheck: "false",
    value: formState.domain,
    placeholder: "horizonmedia.tv",
    "data-error": "nlc-domain-err"
  });
  const ownerNameIn = h("input", {
    id: "nlc-owner-name",
    name: "name",
    class: "input",
    type: "text",
    required: true,
    autocomplete: "name",
    value: formState.ownerName,
    placeholder: "Alexia Morgan",
    "data-error": "nlc-owner-err"
  });
  const ownerEmailIn = h("input", {
    id: "nlc-owner-email",
    name: "email",
    class: "input",
    type: "email",
    required: true,
    autocomplete: "username",
    spellcheck: "false",
    value: formState.ownerEmail,
    placeholder: "founder@horizonmedia.tv",
    "aria-describedby": "nlc-email-hint",
    "data-error": "nlc-email-err"
  });
  const ownerPassIn = h("input", {
    id: "nlc-owner-pass",
    name: "new-password",
    class: "input",
    type: formState.showPassword ? "text" : "password",
    required: true,
    minlength: "8",
    pattern: "(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\\W_]).{8,}",
    autocomplete: "new-password",
    value: formState.ownerPassword,
    placeholder: "Create strong admin password",
    "aria-describedby": "nlc-pass-rules",
    "data-error": "nlc-pass-err"
  });

  const togglePassBtn = h(
    "button",
    {
      type: "button",
      class: "btn btn--ghost btn--sm",
      "aria-pressed": String(formState.showPassword),
      "aria-label": formState.showPassword ? "Hide password" : "Show password",
      onClick: () => {
        formState.showPassword = !formState.showPassword;
        ownerPassIn.type = formState.showPassword ? "text" : "password";
        togglePassBtn.setAttribute("aria-pressed", String(formState.showPassword));
        togglePassBtn.textContent = formState.showPassword ? "Hide" : "Show";
      }
    },
    formState.showPassword ? "Hide" : "Show"
  );

  const channelsListEl = h("div", { style: "display:flex;flex-direction:column;gap:0.5rem;" });
  function syncChannelsBuilder() {
    channelsListEl.replaceChildren(
      ...formState.channels.map((ch, idx) => {
        const chNameIn = h("input", {
          type: "text",
          class: "input",
          value: ch.name,
          required: true,
          "aria-label": `Channel ${idx + 1} name`,
          onChange: (e) => {
            ch.name = e.target.value;
          }
        });
        const chDomIn = h("input", {
          type: "text",
          class: "input input--mono",
          value: ch.domain,
          placeholder: idx === 0 ? "primary.fm (defaults to company domain)" : `channel-${idx + 1}.io`,
          "aria-label": `Channel ${idx + 1} website domain`,
          onChange: (e) => {
            ch.domain = e.target.value;
          }
        });
        return h(
          "div",
          { class: "feed-row", style: "flex-wrap:wrap;gap:0.5rem;" },
          h("div", { style: "flex:1 1 180px;" }, chNameIn),
          h("div", { style: "flex:1 1 200px;" }, chDomIn),
          formState.channels.length > 1
            ? h(
                "button",
                {
                  type: "button",
                  class: "btn btn--ghost btn--sm",
                  onClick: () => {
                    formState.channels = formState.channels.filter((x) => x.id !== ch.id);
                    syncChannelsBuilder();
                  }
                },
                "Remove"
              )
            : null
        );
      })
    );
  }
  syncChannelsBuilder();

  const teamListEl = h("div", { style: "display:flex;flex-direction:column;gap:0.5rem;" });
  const roleOptions = ROLES.filter((r) => r.scope === "tenant" && r.id !== "god_mode");
  function syncTeamBuilder() {
    teamListEl.replaceChildren(
      ...formState.teamMembers.map((tm, idx) => {
        const tmNameIn = h("input", {
          type: "text",
          class: "input",
          value: tm.name,
          placeholder: "Team member full name",
          "aria-label": `Team member ${idx + 1} name`,
          onChange: (e) => {
            tm.name = e.target.value;
          }
        });
        const tmEmailIn = h("input", {
          type: "email",
          class: "input",
          value: tm.email,
          placeholder: "member@company.io",
          "aria-label": `Team member ${idx + 1} email`,
          onChange: (e) => {
            tm.email = e.target.value;
          }
        });
        const tmRoleSel = h(
          "select",
          {
            class: "select",
            "aria-label": `Team member ${idx + 1} RBAC role`,
            onChange: (e) => {
              tm.roleId = e.target.value;
            }
          },
          ...roleOptions.map((r) => h("option", { value: r.id, selected: r.id === tm.roleId }, `${r.name} [${r.badge}]`))
        );
        return h(
          "div",
          { class: "feed-row", style: "flex-wrap:wrap;gap:0.5rem;" },
          h("div", { style: "flex:1 1 150px;" }, tmNameIn),
          h("div", { style: "flex:1 1 180px;" }, tmEmailIn),
          h("div", { style: "flex:1 1 210px;" }, tmRoleSel),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--ghost btn--sm",
              onClick: () => {
                formState.teamMembers = formState.teamMembers.filter((x) => x.id !== tm.id);
                syncTeamBuilder();
              }
            },
            "Remove"
          )
        );
      })
    );
  }
  syncTeamBuilder();

  const scenarioCheckboxes = SCENARIOS.map((sc) => {
    const chk = h("input", {
      type: "checkbox",
      id: `nlc-scen-${sc.id}`,
      name: "scenarios",
      value: sc.id,
      checked: formState.scenarios.includes(sc.id),
      onChange: () => {
        if (chk.checked && !formState.scenarios.includes(sc.id)) formState.scenarios.push(sc.id);
        else formState.scenarios = formState.scenarios.filter((s) => s !== sc.id);
      }
    });
    return h("label", { class: "checklist-item", for: `nlc-scen-${sc.id}` }, chk, h("span", { style: "font-size:var(--text-xs);" }, sc.label));
  });

  const selectedPlanObj = pd.saasPlans.find((p) => p.id === formState.selectedPlanId) ?? pd.saasPlans[1];

  const signupForm = h(
    "form",
    {
      id: "nlc-company-signup-form",
      method: "post",
      "aria-labelledby": "nlc-signup-heading",
      style: "display:flex;flex-direction:column;gap:1.1rem;",
      onSubmit: (e) => {
        e.preventDefault();
        if (!signupForm.checkValidity()) {
          const firstInvalid = signupForm.querySelector(":invalid");
          firstInvalid?.focus?.();
          showToast("Please complete highlighted required company & password fields", { tone: "warn" });
          return;
        }
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        formState.companyName = companyIn.value.trim();
        formState.domain = domainIn.value.trim();
        formState.ownerName = ownerNameIn.value.trim();
        formState.ownerEmail = ownerEmailIn.value.trim();

        const res = registerCompanyOnNewLifeCorp({
          companyName: formState.companyName,
          domain: formState.domain,
          planId: formState.selectedPlanId,
          ownerName: formState.ownerName,
          ownerEmail: formState.ownerEmail,
          channels: formState.channels,
          activeScenarios: formState.scenarios,
          teamMembers: formState.teamMembers,
          autoSignIn: true
        });

        showToast(`Welcome ${res.ownerUser.name}! Company "${res.workspace.name}" saved to SQLite with ${res.workspace.channels.length} channels.`, { tone: "ok" });
        navigateTo("command");
      }
    },
    h(
      "div",
      { class: "card-header" },
      h("div", {},
        h("h2", { id: "nlc-signup-heading", class: "card-title", style: "font-size:var(--text-lg);" }, "Register Company & Configure Your Multi-Tenant Suite"),
        h("p", { id: "nlc-selected-plan-summary", class: "mono-meta" }, `${selectedPlanObj.name} — ${formatPlanPrice(selectedPlanObj, { compact: true })} (${selectedPlanObj.seatLimit} seats · ${selectedPlanObj.channelLimit} channels)`)
      ),
      createStatusPill("Instant Tenant Provisioning", "ok")
    ),
    h(
      "fieldset",
      { class: "nlc-fieldset" },
      h("legend", { class: "nlc-legend" }, "1. Company Identity & Primary Domain"),
      h(
        "div",
        { class: "form-grid" },
        h(
          "div",
          { class: "field" },
          h("label", { class: "field-label", for: "nlc-company" }, "Company / Organization Name *"),
          companyIn,
          h("div", { id: "nlc-company-err", class: "error-msg" }, "Error: Enter your company or studio name.")
        ),
        h(
          "div",
          { class: "field" },
          h("label", { class: "field-label", for: "nlc-domain" }, "Primary Company Domain *"),
          h("span", { class: "hint" }, "Format: company.tv or studio.io (no https://)"),
          domainIn,
          h("div", { id: "nlc-domain-err", class: "error-msg" }, "Error: Enter a valid domain such as company.io.")
        )
      )
    ),
    h(
      "fieldset",
      { class: "nlc-fieldset" },
      h("legend", { class: "nlc-legend" }, "2. Founder / Workspace Admin Account"),
      h(
        "div",
        { class: "form-grid" },
        h(
          "div",
          { class: "field" },
          h("label", { class: "field-label", for: "nlc-owner-name" }, "Full Name *"),
          ownerNameIn,
          h("div", { id: "nlc-owner-err", class: "error-msg" }, "Error: Enter the workspace admin full name.")
        ),
        h(
          "div",
          { class: "field" },
          h("label", { class: "field-label", for: "nlc-owner-email" }, "Work Email *"),
          h("span", { id: "nlc-email-hint", class: "hint" }, "Format: you@company.io"),
          ownerEmailIn,
          h("div", { id: "nlc-email-err", class: "error-msg" }, "Error: Enter a valid email address in the format you@company.io.")
        ),
        h(
          "div",
          { class: "field" },
          h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:0.5rem;" },
            h("label", { class: "field-label", for: "nlc-owner-pass" }, "Admin Password *"),
            togglePassBtn
          ),
          h("span", { id: "nlc-pass-rules", class: "hint" }, "8+ chars, uppercase, lowercase, number, and symbol."),
          ownerPassIn,
          h("div", { id: "nlc-pass-err", class: "error-msg" }, "Error: Password must be 8+ characters with upper, lower, number, and symbol.")
        )
      )
    ),
    h(
      "fieldset",
      { class: "nlc-fieldset" },
      h("legend", { class: "nlc-legend" }, "3. Configure Brand Channels, Websites & Scenarios"),
      h("div", { class: "card-header" },
        h("span", { class: "field-label" }, "Media Channels (Each gets its own domain, statuses & RBAC scope)"),
        h("button", {
          type: "button",
          class: "btn btn--subtle btn--sm",
          onClick: () => {
            formState.channels.push({ id: `ch-${Date.now()}`, name: "New Podcast / Brand Channel", domain: "", capabilities: ["shorts", "podcasts", "articles", "website", "social"] });
            syncChannelsBuilder();
          }
        }, "+ Add Channel")
      ),
      channelsListEl,
      h("span", { class: "field-label", style: "padding-top:0.35rem;" }, "Enabled Production Workflows"),
      h("div", { class: "form-grid" }, ...scenarioCheckboxes)
    ),
    h(
      "fieldset",
      { class: "nlc-fieldset" },
      h("legend", { class: "nlc-legend" }, "4. Pre-Configure Company Team & RBAC Roles"),
      h("div", { class: "card-header" },
        h("span", { class: "field-label" }, "Invite Initial Team Specialists (Isolated automatically to assigned scenarios & channels)"),
        h("button", {
          type: "button",
          class: "btn btn--subtle btn--sm",
          onClick: () => {
            formState.teamMembers.push({ id: `tm-${Date.now()}`, name: "", email: "", roleId: "podcast_producer" });
            syncTeamBuilder();
          }
        }, "+ Add Team Seat")
      ),
      teamListEl
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.75rem;padding-top:0.25rem;" },
      h("span", { class: "mono-meta" }, "Provisions isolated SQLite + PG17 tenant, custom domain routes, /go links, and team workspaces immediately."),
      h("button", { type: "submit", class: "btn btn--primary" }, "Create Company & Launch Suite →")
    )
  );

  queueMicrotask(() => installAccessibleValidation(signupForm));

  const registerFormCard = h("section", { id: "nlc-register", class: "card" }, signupForm);
  const pageNodes = [
    headerNode,
    ...(heroIntro ? [heroIntro] : []),
    plansGrid,
    registerFormCard,
    ...(publicMode ? [buildSiteFooter()] : [])
  ];

  return publicMode
    ? h("div", { class: "nlc-public-shell" }, ...pageNodes)
    : pageNodes;
}
