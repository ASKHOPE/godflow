import { createStatusPill, createTabs, formatNumber, h } from "./dom.js";
import { navigateTo } from "./router.js";
import {
  addBrainstormNote,
  addResearchSource,
  addWhiteboardItem,
  canAccessRoute,
  getActiveContext,
  getState,
  getTenantModuleStatus,
  removeBrainstormNote,
  removeWhiteboardItem,
  setTenantModuleTrack,
  toggleWhiteboardItem
} from "./store.js";
import { showToast } from "./toast.js";

const ALLOWED_TAGS = new Set([
  "h2", "h3", "h4", "p", "b", "strong", "i", "em", "u",
  "ul", "ol", "li", "blockquote", "pre", "code", "a", "br", "hr"
]);
const ALLOWED_ATTRS = new Set(["href", "class"]);

/**
 * Safely sanitizes and inserts rich HTML into a container using native Element.setHTML()
 * when available, with a strict DOMParser allowlist fallback.
 */
export function safeSetHTML(el, rawHtml) {
  if (!el) return;
  const html = String(rawHtml ?? "");

  if (typeof Element !== "undefined" && "setHTML" in Element.prototype) {
    try {
      el.setHTML(html, {
        sanitizer: {
          elements: [...ALLOWED_TAGS],
          attributes: [...ALLOWED_ATTRS]
        }
      });
      return;
    } catch {
      /* fall through to DOMParser sanitizer */
    }
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return document.createDocumentFragment();
    }
    const out = document.createElement(tag);
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) continue;
      if (name === "href" && !/^https?:|^\/|^#/i.test(attr.value.trim())) continue;
      out.setAttribute(name, attr.value);
    }
    for (const child of node.childNodes) {
      out.append(cleanNode(child));
    }
    return out;
  }

  const frag = document.createDocumentFragment();
  for (const child of doc.body.childNodes) {
    frag.append(cleanNode(child));
  }
  el.replaceChildren(frag);
}

export function createToolCard(title, badgeText, badgeTone = "info", ...children) {
  return h(
    "section",
    { class: "card" },
    h(
      "div",
      { class: "card-header" },
      h("h2", { class: "card-title" }, title),
      badgeText ? createStatusPill(badgeText, badgeTone) : null
    ),
    ...children
  );
}

export function createFaderControl({ id, label, min = 0, max = 100, value = 50, unit = "", onInput }) {
  const readout = h("span", { class: "mono-meta" }, `${value}${unit}`);
  const slider = h("input", {
    id,
    type: "range",
    min: String(min),
    max: String(max),
    value: String(value),
    onInput: (e) => {
      readout.textContent = `${e.target.value}${unit}`;
      onInput?.(Number(e.target.value));
    }
  });

  return h(
    "div",
    { class: "field" },
    h("div", { style: "display:flex;justify-content:space-between;align-items:center;" }, h("label", { class: "field-label", for: id }, label), readout),
    slider
  );
}

/**
 * Evaluates a tenant's assigned Suite module + release track (Experimental / Current / LTS)
 * so every feature route reflects live platform upgrades, track features, or module removal.
 */
export function renderModuleVersionGuard(moduleId, featureTitle = "This Module") {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const st = getTenantModuleStatus(moduleId, ctx.workspace.id, snap);
  if (!st) return { enabled: true, status: null, bannerNode: null, blockedNodes: null };

  const canConfigure = canAccessRoute("suite", snap);

  if (!st.enabled) {
    return {
      enabled: false,
      status: st,
      bannerNode: null,
      blockedNodes: [
        h(
          "section",
          { class: "card", style: "max-inline-size:680px;margin-block:1rem;border-color:var(--status-warn);" },
          h(
            "div",
            { class: "card-header" },
            h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, `${featureTitle} — Module Not Assigned`),
            createStatusPill(!st.globallyEnabled ? "DISABLED GLOBALLY" : "UNASSIGNED FOR TENANT", "warn")
          ),
          h(
            "p",
            { class: "page-subtitle" },
            !st.globallyEnabled
              ? `Suite module "${st.module.name}" is currently disabled globally by Platform Operations.`
              : `Tenant "${ctx.workspace.name}" does not have the "${st.module.name}" suite module assigned under its current requirements.`
          ),
          h(
            "div",
            { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
            canConfigure ? h("button", { type: "button", class: "btn btn--primary", onClick: () => navigateTo("suite") }, "Enable & Assign in Suite →") : null,
            h("a", { href: "/", class: "btn btn--subtle" }, "Return to Command Center")
          )
        )
      ]
    };
  }

  const bannerNode = h(
    "aside",
    {
      class: "card",
      "aria-label": `${st.module.name} active release`,
      style: "padding:0.55rem 0.9rem;flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.65rem;background:var(--bg-subtle);"
    },
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;" },
      createStatusPill(`SUITE · v${st.installedVersion} (${st.trackLabel})`, st.tone),
      h("span", { class: "mono-meta" }, (st.activeMeta?.features ?? []).join(" · "))
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;" },
      st.upgradeAvailable && canConfigure
        ? h(
            "button",
            {
              type: "button",
              class: "btn btn--primary btn--sm",
              onClick: () => {
                setTenantModuleTrack(ctx.workspace.id, moduleId, st.track);
                showToast(`Upgraded ${st.module.name} → v${st.availableVersion}`, { tone: "ok" });
              }
            },
            `Upgrade Available → v${st.availableVersion}`
          )
        : null,
      canConfigure
        ? h("a", { href: "/suite", class: "btn btn--ghost btn--sm" }, "Manage Versions")
        : null
    )
  );

  return { enabled: true, status: st, bannerNode, blockedNodes: null };
}

export function formatPlanPrice(plan, { compact = false } = {}) {
  if (!plan) return "$0/mo";
  if (plan.isCustom || !plan.monthlyPriceUsd) {
    return compact ? "Custom Quote" : "Custom Pricing · Tailored Quota";
  }
  return compact ? `$${formatNumber(plan.monthlyPriceUsd)}/mo` : `$${formatNumber(plan.monthlyPriceUsd)} / month`;
}

/**
 * Shared online source gathering & citation desk across all creator workbenches
 * (Articles, Videos/Shorts, Live Streams, Music, Podcasts & Social Thumbnails/GIFs).
 */
export function createSourceGatheringCard({
  idPrefix = "src",
  title = "1. Online Sources & Research Gathering",
  sources = [],
  selectedId = null,
  onSelect = null,
  citeLabel = "Clip Insight → Editor",
  onCite = null
}) {
  const activeSrc = sources.find((s) => s.id === selectedId) ?? sources[0] ?? null;
  const searchIn = h("input", {
    id: `${idPrefix}-q`,
    class: "input",
    type: "search",
    placeholder: "Filter gathered URLs, reports & references..."
  });
  const listEl = h("ul", { class: "feed-list", style: "max-block-size:190px;overflow-y:auto;" });

  const renderSourceList = (query = "") => {
    const q = query.trim().toLowerCase();
    const filtered = sources.filter(
      (s) => !q || s.title.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q) || (s.summary || "").toLowerCase().includes(q)
    );
    listEl.replaceChildren(
      ...filtered.map((src) =>
        h("li", {},
          h("button", {
            type: "button",
            class: "pipeline-card",
            style: src.id === activeSrc?.id ? "border-color:var(--accent);background:var(--accent-soft);padding:0.5rem;" : "padding:0.5rem;",
            onClick: () => {
              onSelect?.(src.id);
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
            h("strong", { style: "font-size:var(--text-xs);" }, src.title),
            h("span", { class: "mono-meta" }, `${src.domain} · ${src.published}`)
          )
        )
      )
    );
  };
  renderSourceList();
  searchIn.addEventListener("input", () => renderSourceList(searchIn.value));

  const titleIn = h("input", { id: `${idPrefix}-title`, class: "input", type: "text", placeholder: "Source article, video or reference title..." });
  const urlIn = h("input", { id: `${idPrefix}-url`, class: "input input--mono", type: "url", placeholder: "https://..." });
  const sumIn = h("input", { id: `${idPrefix}-sum`, class: "input", type: "text", placeholder: "Key note / quote to reuse..." });
  const crawlStatus = h("span", { class: "mono-meta" }, "Paste any URL to crawl & pin directly to your sources");

  const crawlAndPinBtn = h("button", {
    type: "button",
    class: "btn btn--primary btn--sm",
    onClick: async () => {
      const rawUrl = urlIn.value.trim();
      if (!rawUrl) {
        showToast("Enter a website URL to crawl & pin", { tone: "warn" });
        return;
      }
      crawlStatus.textContent = `Crawling ${rawUrl}...`;
      let crawledTitle = titleIn.value.trim();
      let crawledSummary = sumIn.value.trim();
      try {
        const apiRes = await fetch(`/api/crawl?url=${encodeURIComponent(rawUrl)}`);
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data?.ok) {
            if (!crawledTitle && data.title) crawledTitle = data.title;
            if (!crawledSummary && data.summary) crawledSummary = data.summary;
          }
        }
      } catch {
        /* fallback to URL metadata */
      }
      const host = rawUrl.replace(/^https?:\/\//i, "").split("/")[0] || "web-source";
      const created = addResearchSource({
        title: crawledTitle || `Crawled: ${host}`,
        url: rawUrl,
        summary: crawledSummary || `Crawled & pinned from ${rawUrl}`,
        body: crawledSummary || `Pinned online source from ${rawUrl}`
      });
      onSelect?.(created.id);
      crawlStatus.textContent = `Pinned "${created.title}"`;
      showToast(`Crawled & pinned "${created.title}" to Sources (+20m tracked)`, { tone: "ok" });
    }
  }, "Crawl Site & Pin Source");

  return createToolCard(
    title,
    `${sources.length} Sources`,
    "info",
    h("div", { class: "field" }, h("label", { class: "visually-hidden", for: `${idPrefix}-q` }, "Filter gathered sources"), searchIn),
    listEl,
    activeSrc
      ? h("article", { class: "card", style: "background:var(--bg-canvas);padding:0.7rem;gap:0.4rem;" },
          h("span", { class: "mono-meta" }, `SOURCE · ${activeSrc.domain}`),
          h("strong", { style: "font-size:var(--text-xs);" }, activeSrc.title),
          h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, activeSrc.summary || activeSrc.body),
          onCite
            ? h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => onCite(activeSrc)
              }, citeLabel)
            : null
        )
      : null,
    h("form", {
      style: "display:flex;flex-direction:column;gap:0.4rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);",
      onSubmit: (e) => {
        e.preventDefault();
        if (!titleIn.value.trim() || !urlIn.value.trim()) return;
        const created = addResearchSource({
          title: titleIn.value.trim(),
          url: urlIn.value.trim(),
          summary: sumIn.value.trim(),
          body: sumIn.value.trim() || `Saved reference from ${urlIn.value.trim()}`
        });
        onSelect?.(created.id);
        showToast("Saved online source to Research Library (+20m tracked)", { tone: "ok" });
      }
    },
      h("span", { class: "mono-meta" }, "+ Site Crawler & Quick Pin to Source"),
      crawlStatus,
      h("label", { class: "visually-hidden", for: `${idPrefix}-url` }, "Source URL"),
      urlIn,
      h("label", { class: "visually-hidden", for: `${idPrefix}-title` }, "Source title"),
      titleIn,
      h("label", { class: "visually-hidden", for: `${idPrefix}-sum` }, "Source notes"),
      sumIn,
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.4rem;" },
        crawlAndPinBtn,
        h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Save Manual Source")
      )
    )
  );
}

/**
 * Shared Brainstorm Canvas pane usable inside any studio's Brainstorm tab.
 */
export function createBrainstormPane({ idPrefix = "br", scenarioLabel = "Studio", onInsertToEditor = null } = {}) {
  const snap = getState();
  const notes = snap.workbenchData?.brainstormNotes ?? [];
  const tagSel = h(
    "select",
    { id: `${idPrefix}-tag`, class: "select", style: "max-inline-size:180px;" },
    h("option", { value: "Thesis" }, "Thesis"),
    h("option", { value: "Data Point" }, "Data Point"),
    h("option", { value: "Hook" }, "Hook"),
    h("option", { value: "Angle" }, "Angle"),
    h("option", { value: "Visual Cue" }, "Visual Cue")
  );
  const textIn = h("textarea", {
    id: `${idPrefix}-text`,
    class: "textarea",
    style: "min-block-size:76px;",
    placeholder: `Jot ${scenarioLabel.toLowerCase()} angle, hook, or synthesis from crawled sources...`
  });

  return createToolCard(
    `Brainstorm Canvas (${scenarioLabel})`,
    `${notes.length} Ideas`,
    "warn",
    h("form", {
      style: "display:flex;flex-direction:column;gap:0.5rem;",
      onSubmit: (e) => {
        e.preventDefault();
        if (!textIn.value.trim()) return;
        addBrainstormNote({ tag: tagSel.value, sourceTitle: `${scenarioLabel} Brainstorm`, text: textIn.value.trim() });
        showToast("Added brainstorm note", { tone: "ok" });
      }
    },
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;" },
        h("label", { class: "field-label", for: `${idPrefix}-tag` }, "Card Type"),
        tagSel
      ),
      textIn,
      h("div", { style: "display:flex;justify-content:flex-end;" },
        h("button", { type: "submit", class: "btn btn--primary btn--sm" }, "+ Add Brainstorm Note")
      )
    ),
    h("div", { class: "grid-2" },
      ...notes.map((n) =>
        h("article", { class: "card", style: "background:var(--bg-canvas);padding:0.7rem;gap:0.4rem;" },
          h("div", { class: "card-header" },
            createStatusPill(n.tag, "info"),
            h("button", {
              type: "button",
              class: "btn btn--ghost btn--sm",
              "aria-label": "Remove brainstorm note",
              onClick: () => removeBrainstormNote(n.id)
            }, "×")
          ),
          h("p", { style: "margin:0;font-size:var(--text-xs);" }, n.text),
          h("span", { class: "mono-meta" }, `Source: ${n.sourceTitle}`),
          onInsertToEditor
            ? h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => onInsertToEditor(n)
              }, "Insert into Editor →")
            : null
        )
      )
    )
  );
}

/**
 * Shared simultaneous team Collaboration & Whiteboard pane for all studios.
 */
export function createWhiteboardPane({ idPrefix = "wb", scenarioId = "all", onSendToEditor = null } = {}) {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const wsUsers = snap.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ctx.workspace.id));
  const items = (snap.workbenchData?.whiteboard ?? []).filter((it) => !it.workspaceId || it.workspaceId === ctx.workspace.id);

  const kindSel = h(
    "select",
    { id: `${idPrefix}-kind`, class: "select", style: "max-inline-size:170px;" },
    h("option", { value: "Sticky Note" }, "Sticky Note"),
    h("option", { value: "Action Item" }, "Action Item"),
    h("option", { value: "Review Feedback" }, "Review Feedback"),
    h("option", { value: "Outline Block" }, "Outline Block")
  );
  const colorSel = h(
    "select",
    { id: `${idPrefix}-color`, class: "select", style: "max-inline-size:140px;" },
    h("option", { value: "info" }, "Blue (Info)"),
    h("option", { value: "ok" }, "Green (Ready)"),
    h("option", { value: "warn" }, "Amber (Review)")
  );
  const noteIn = h("textarea", {
    id: `${idPrefix}-note`,
    class: "textarea",
    style: "min-block-size:68px;",
    placeholder: "Post a live whiteboard note, task, or review comment for your team..."
  });

  return createToolCard(
    "Live Team Whiteboard & Simultaneous Collaboration",
    `${wsUsers.length} Collaborators · ${items.length} Board Items`,
    "ok",
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;" },
      h("span", { class: "mono-meta" }, "Active on Board:"),
      ...wsUsers.slice(0, 8).map((u) => h("span", { class: "tag" }, `${u.name} (${u.initials})`))
    ),
    h("form", {
      style: "display:flex;flex-direction:column;gap:0.45rem;padding:0.65rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);",
      onSubmit: (e) => {
        e.preventDefault();
        if (!noteIn.value.trim()) return;
        addWhiteboardItem({ text: noteIn.value.trim(), color: colorSel.value, kind: kindSel.value, scenario: scenarioId });
        showToast("Posted to shared team whiteboard", { tone: "ok" });
      }
    },
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.45rem;" }, kindSel, colorSel),
      noteIn,
      h("div", { style: "display:flex;justify-content:flex-end;" },
        h("button", { type: "submit", class: "btn btn--primary btn--sm" }, "+ Pin to Team Whiteboard")
      )
    ),
    h("div", { class: "grid-3" },
      ...(items.length
        ? items.map((it) =>
            h("article", {
              class: "card",
              style: `background:var(--bg-canvas);padding:0.7rem;gap:0.4rem;${it.done ? "opacity:0.65;" : ""}`
            },
              h("div", { class: "card-header" },
                createStatusPill(it.kind, it.color || "info"),
                h("button", {
                  type: "button",
                  class: "btn btn--ghost btn--sm",
                  "aria-label": "Delete whiteboard item",
                  onClick: () => removeWhiteboardItem(it.id)
                }, "×")
              ),
              h("p", { style: `margin:0;font-size:var(--text-xs);${it.done ? "text-decoration:line-through;" : ""}` }, it.text),
              h("span", { class: "mono-meta" }, `${it.authorName} · ${it.authorRole} · ${it.createdAt}`),
              h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:auto;" },
                h("button", {
                  type: "button",
                  class: "btn btn--subtle btn--sm",
                  onClick: () => toggleWhiteboardItem(it.id)
                }, it.done ? "Reopen" : "Mark Done"),
                onSendToEditor
                  ? h("button", {
                      type: "button",
                      class: "btn btn--ghost btn--sm",
                      onClick: () => onSendToEditor(it)
                    }, "Use in Editor →")
                  : null
              )
            )
          )
        : [h("p", { class: "mono-meta" }, "Whiteboard is clear — pin a note or task above to collaborate live with your team.")])
    )
  );
}

/**
 * Standard 4-tab layout for every studio:
 * 1. Search & Crawl Sources  2. Brainstorm  3. Editor  4. Collaboration & Whiteboard
 */
export function createStudioTabs({
  ariaLabel = "Studio workspace tabs",
  initialTab = "editor",
  onTabChange = null,
  sourcesNode,
  brainstormNode,
  editorNode,
  whiteboardNode,
  previewNode = null
}) {
  return createTabs({
    ariaLabel,
    initialId: initialTab,
    onChange: onTabChange,
    tabs: [
      { id: "sources", label: "1. Search & Crawl Sources", render: () => sourcesNode },
      { id: "brainstorm", label: "2. Brainstorm", render: () => brainstormNode },
      { id: "editor", label: "3. Editor", render: () => editorNode },
      { id: "whiteboard", label: "4. Collaboration & Whiteboard", render: () => whiteboardNode },
      ...(previewNode ? [{ id: "preview", label: "5. Live Preview", render: () => previewNode }] : [])
    ]
  });
}
