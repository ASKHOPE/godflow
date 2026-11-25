import { createStatusPill, h } from "../lib/dom.js";
import { addBrainstormNote, addResearchSource, getState, getTenantSlice, removeBrainstormNote, saveArticleDraft } from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import { createStudioTabs, createToolCard, createWhiteboardPane, safeSetHTML } from "../lib/workbench-helpers.js";

let searchQuery = "";
let selectedSourceId = null;
let htmlSourceMode = false;

export function renderArticleStudio() {
  const snap = getState();
  const wb = snap.workbenchData;
  const sources = wb.researchSources.filter(
    (s) =>
      !searchQuery.trim() ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!selectedSourceId || !wb.researchSources.some((s) => s.id === selectedSourceId)) {
    selectedSourceId = wb.researchSources[0]?.id;
  }
  const activeSrc = wb.researchSources.find((s) => s.id === selectedSourceId) ?? wb.researchSources[0];

  // Pane 1: Online Research Desk
  const searchIn = h("input", {
    id: "res-search",
    class: "input",
    type: "search",
    value: searchQuery,
    placeholder: "Search saved online articles & reports...",
    onInput: (e) => {
      searchQuery = e.target.value;
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  });

  const urlTitleIn = h("input", { id: "res-add-title", class: "input", type: "text", placeholder: "Article title to fetch/save..." });
  const urlIn = h("input", { id: "res-add-url", class: "input input--mono", type: "url", placeholder: "https://..." });
  const sumIn = h("input", { id: "res-add-sum", class: "input", type: "text", placeholder: "Key finding or snippet..." });

  const researchPane = createToolCard(
    "1. Online Research Desk",
    `${sources.length} Sources`,
    "info",
    h("div", { class: "field" }, h("label", { class: "visually-hidden", for: "res-search" }, "Search research library"), searchIn),
    h(
      "ul",
      { class: "feed-list", style: "max-block-size:210px;overflow-y:auto;" },
      ...sources.map((src) =>
        h(
          "li",
          {},
          h(
            "button",
            {
              type: "button",
              class: "pipeline-card",
              style: src.id === activeSrc?.id ? "border-color:var(--accent);background:var(--accent-soft);padding:0.55rem;" : "padding:0.55rem;",
              onClick: () => {
                selectedSourceId = src.id;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            },
            h("strong", { style: "font-size:var(--text-xs);" }, src.title),
            h("span", { class: "mono-meta" }, `${src.domain} · ${src.published}`)
          )
        )
      )
    ),
    activeSrc
      ? h(
          "article",
          { class: "card", style: "background:var(--bg-canvas);padding:0.75rem;gap:0.45rem;" },
          h("span", { class: "mono-meta" }, `READER · ${activeSrc.domain}`),
          h("strong", { style: "font-size:var(--text-sm);" }, activeSrc.title),
          h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, activeSrc.body),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle btn--sm",
              onClick: () => {
                addBrainstormNote({
                  tag: "Citation",
                  sourceTitle: activeSrc.title,
                  text: activeSrc.summary
                });
                showToast("Clipped research insight to Brainstorm Canvas", { tone: "ok" });
              }
            },
            "Clip Highlight → Brainstorm"
          )
        )
      : null,
    h(
      "form",
      {
        style: "display:flex;flex-direction:column;gap:0.45rem;padding-top:0.25rem;border-top:1px solid var(--border-subtle);",
        onSubmit: async (e) => {
          e.preventDefault();
          const rawUrl = urlIn.value.trim();
          if (!rawUrl) return;
          const btn = e.target.querySelector('button[type="submit"]');
          if (btn) {
            btn.disabled = true;
            btn.textContent = "Crawling...";
          }
          try {
            let crawled = null;
            try {
              const res = await fetch(`/api/crawl?url=${encodeURIComponent(rawUrl)}`);
              if (res.ok) {
                const json = await res.json();
                if (json?.ok) crawled = json;
              }
            } catch {
              // fallback below
            }
            const created = addResearchSource({
              title: urlTitleIn.value.trim() || crawled?.title || rawUrl,
              url: crawled?.url || rawUrl,
              summary: sumIn.value.trim() || crawled?.summary || `Archived reader view for ${rawUrl}`,
              body: crawled?.body || sumIn.value.trim() || `Archived reader view for ${rawUrl}`
            });
            selectedSourceId = created.id;
            showToast(crawled ? "Crawled & added source to Research Desk (+20m tracked)" : "Added web source to Research Desk (+20m tracked)", { tone: "ok" });
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.textContent = "Fetch & Add Source";
            }
          }
        }
      },
      h("span", { class: "mono-meta" }, "+ Save Online Article URL"),
      h("label", { class: "visually-hidden", for: "res-add-title" }, "Source title"),
      urlTitleIn,
      h("label", { class: "visually-hidden", for: "res-add-url" }, "Source URL"),
      urlIn,
      h("label", { class: "visually-hidden", for: "res-add-sum" }, "Key takeaway"),
      sumIn,
      h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "Fetch & Add Source")
    )
  );

  // Pane 2: Brainstorm Canvas
  const brTagSel = h(
    "select",
    { id: "br-tag", class: "select" },
    h("option", { value: "Thesis" }, "Thesis"),
    h("option", { value: "Hook" }, "Hook"),
    h("option", { value: "Data Point" }, "Data Point"),
    h("option", { value: "Quote" }, "Quote"),
    h("option", { value: "CTA" }, "CTA")
  );
  const brTextIn = h("textarea", { id: "br-text", class: "textarea", style: "min-block-size:68px;", placeholder: "Jot angle, hook, or synthesis from research..." });

  let currentDraftHtml = wb.articleDraft.html;

  const brainstormPane = createToolCard(
    "2. Brainstorm Canvas",
    `${wb.brainstormNotes.length} Ideas`,
    "warn",
    h(
      "form",
      {
        style: "display:flex;flex-direction:column;gap:0.45rem;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!brTextIn.value.trim()) return;
          addBrainstormNote({
            tag: brTagSel.value,
            sourceTitle: activeSrc?.title ?? "Brainstorm",
            text: brTextIn.value.trim()
          });
          brTextIn.value = "";
          showToast("Added brainstorm block (+10m tracked)", { tone: "ok" });
        }
      },
      h("div", { class: "form-grid" }, h("div", { class: "field" }, h("label", { class: "field-label", for: "br-tag" }, "Card Type"), brTagSel)),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "br-text" }, "Idea / Synthesis"), brTextIn),
      h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Add Brainstorm Note")
    ),
    h(
      "ul",
      { class: "feed-list", style: "max-block-size:380px;overflow-y:auto;" },
      ...wb.brainstormNotes.map((note) =>
        h(
          "li",
          { class: "card", style: "background:var(--bg-canvas);padding:0.65rem;gap:0.4rem;" },
          h(
            "div",
            { style: "display:flex;justify-content:space-between;align-items:center;" },
            createStatusPill(note.tag, "info"),
            h("button", { type: "button", class: "btn btn--ghost btn--sm", "aria-label": "Remove note", onClick: () => removeBrainstormNote(note.id) }, "✕")
          ),
          h("span", { style: "font-size:var(--text-xs);" }, note.text),
          h("span", { class: "mono-meta truncate" }, `Source: ${note.sourceTitle}`),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle btn--sm",
              onClick: () => {
                const addition = `<blockquote><p><strong>${note.tag}:</strong> ${note.text} <em>(${note.sourceTitle})</em></p></blockquote>`;
                currentDraftHtml += addition;
                saveArticleDraft({ title: titleIn.value, slug: slugIn.value, html: currentDraftHtml, publishToHub: false });
                showToast("Inserted brainstorm citation into Article Composer", { tone: "ok" });
              }
            },
            "Insert into Article →"
          )
        )
      )
    )
  );

  // Pane 3: Rich Text / HTML Article Composer
  const titleIn = h("input", { id: "ed-title", class: "input", type: "text", value: wb.articleDraft.title });
  const slugIn = h("input", { id: "ed-slug", class: "input input--mono", type: "text", value: wb.articleDraft.slug });
  const wordCounter = h("span", { class: "mono-meta" }, "");

  const visualEditor = h("div", {
    id: "ed-visual",
    class: "rich-editor-surface",
    contenteditable: "true",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "Rich text article composer"
  });
  safeSetHTML(visualEditor, currentDraftHtml);

  const rawHtmlArea = h("textarea", {
    id: "ed-html-raw",
    class: "textarea input--mono",
    style: "min-block-size:270px;",
    "aria-label": "Raw HTML source editor"
  });
  rawHtmlArea.value = currentDraftHtml;

  function updateWords() {
    const txt = (htmlSourceMode ? rawHtmlArea.value : visualEditor.textContent || "").replace(/<[^>]+>/g, " ").trim();
    const count = txt ? txt.split(/\s+/).length : 0;
    wordCounter.textContent = `${count} words`;
  }
  updateWords();

  visualEditor.addEventListener("input", () => {
    currentDraftHtml = visualEditor.innerHTML;
    rawHtmlArea.value = currentDraftHtml;
    updateWords();
  });
  rawHtmlArea.addEventListener("input", () => {
    currentDraftHtml = rawHtmlArea.value;
    updateWords();
  });

  function applyFormat(cmd, arg = null) {
    if (htmlSourceMode) {
      if (cmd === "insertHtml" && arg) {
        rawHtmlArea.value += `\n${arg}`;
        currentDraftHtml = rawHtmlArea.value;
        updateWords();
      }
      return;
    }
    visualEditor.focus();
    if (cmd === "insertHtml" && arg) {
      const wrap = document.createElement("div");
      safeSetHTML(wrap, arg);
      visualEditor.append(...wrap.childNodes);
    } else if (cmd === "heading") {
      document.execCommand("formatBlock", false, arg);
    } else {
      document.execCommand(cmd, false, arg);
    }
    currentDraftHtml = visualEditor.innerHTML;
    rawHtmlArea.value = currentDraftHtml;
    updateWords();
  }

  const toolbar = h(
    "div",
    { class: "rich-toolbar", role: "toolbar", "aria-label": "Rich text formatting" },
    ...[
      { label: "H2", fn: () => applyFormat("heading", "H2") },
      { label: "H3", fn: () => applyFormat("heading", "H3") },
      { label: "Bold", fn: () => applyFormat("bold") },
      { label: "Italic", fn: () => applyFormat("italic") },
      { label: "List", fn: () => applyFormat("insertUnorderedList") },
      { label: "Quote", fn: () => applyFormat("heading", "BLOCKQUOTE") },
      { label: "+ <SponsorBox/>", fn: () => applyFormat("insertHtml", '<p><code>&lt;SponsorBox sponsor="TradingView" slug="tradingview" /&gt;</code></p>') },
      { label: "+ <AffiliateCard/>", fn: () => applyFormat("insertHtml", '<p><code>&lt;AffiliateCard slug="hetzner" /&gt;</code></p>') }
    ].map((b) => h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: b.fn }, b.label)),
    h(
      "button",
      {
        type: "button",
        class: "btn btn--ghost btn--sm",
        style: "margin-inline-start:auto;",
        "aria-pressed": String(htmlSourceMode),
        onClick: () => {
          htmlSourceMode = !htmlSourceMode;
          if (!htmlSourceMode) {
            safeSetHTML(visualEditor, rawHtmlArea.value);
            currentDraftHtml = visualEditor.innerHTML;
          } else {
            rawHtmlArea.value = visualEditor.innerHTML;
          }
          window.dispatchEvent(new CustomEvent("godflow:rerender"));
        }
      },
      htmlSourceMode ? "Switch to Visual Editor" : "View / Edit HTML"
    )
  );

  const savedArticles = getTenantSlice(snap).articles ?? [];
  const fileManagerBar = h(
    "div",
    { style: "display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;padding:0.55rem 0.7rem;border-radius:var(--radius-sm);background:var(--bg-canvas);border:1px solid var(--border-subtle);" },
    h("span", { class: "mono-meta" }, `File Manager (${savedArticles.length}):`),
    ...savedArticles.map((art) =>
      h("button", {
        type: "button",
        class: slugIn.value === art.slug ? "filter-pill is-active" : "filter-pill",
        onClick: () => {
          titleIn.value = art.title;
          slugIn.value = art.slug;
          currentDraftHtml = art.html || `<p>${art.excerpt || ""}</p>`;
          if (htmlSourceMode) rawHtmlArea.value = currentDraftHtml;
          else safeSetHTML(visualEditor, currentDraftHtml);
          updateWordCount();
          showToast(`Opened "${art.title}" in Editor`, { tone: "info" });
        }
      }, art.title.slice(0, 32))
    ),
    h("button", {
      type: "button",
      class: "btn btn--subtle btn--sm",
      onClick: () => {
        titleIn.value = "Untitled Article";
        slugIn.value = `article-${Date.now().toString(36)}`;
        currentDraftHtml = "<h2>New Article</h2><p>Start writing here...</p>";
        if (htmlSourceMode) rawHtmlArea.value = currentDraftHtml;
        else safeSetHTML(visualEditor, currentDraftHtml);
        updateWordCount();
        showToast("Created new blank article", { tone: "ok" });
      }
    }, "+ New Article")
  );

  let currentParentId = "";

  const newChildNoteBtn = h("button", {
    type: "button",
    class: "btn btn--subtle btn--sm",
    onClick: () => {
      const parentSlug = slugIn.value.trim();
      currentParentId = parentSlug;
      const suffix = Date.now().toString(36).slice(-4);
      titleIn.value = parentSlug ? "Child Note" : "New Note";
      slugIn.value = `${parentSlug ? `${parentSlug}-` : "note-"}${suffix}`;
      currentDraftHtml = "<p>Start writing your note...</p>";
      if (htmlSourceMode) rawHtmlArea.value = currentDraftHtml;
      else safeSetHTML(visualEditor, currentDraftHtml);
      updateWords();
      saveArticleDraft({ title: titleIn.value.trim(), slug: slugIn.value.trim(), parentId: currentParentId, html: currentDraftHtml, publishToHub: false });
      showToast(parentSlug ? `Created child note under ${parentSlug}` : "Created new root note", { tone: "ok" });
    }
  }, "+ Child Note");

  const triliumTagBtn = h("button", {
    type: "button",
    class: "btn btn--subtle btn--sm",
    onClick: () => {
      saveArticleDraft({ title: titleIn.value.trim(), slug: slugIn.value.trim(), parentId: currentParentId, html: currentDraftHtml, publishToHub: true });
      showToast("Tagged #publish-ready & synced via TriliumNext ETAPI", { tone: "ok" });
    }
  }, "#publish-ready + ETAPI Sync");

  function renderNoteTreeNodes(parentId = "", depth = 0) {
    const children = savedArticles.filter((a) => (a.parentId || "") === parentId);
    const items = [];
    for (const art of children) {
      items.push(
        h("button", {
          type: "button",
          class: `org-folder-btn${slugIn.value === art.slug ? " is-active" : ""}`,
          style: depth > 0 ? `padding-left:${0.65 + depth * 0.75}rem;` : "",
          onClick: () => {
            titleIn.value = art.title;
            slugIn.value = art.slug;
            currentParentId = art.parentId || "";
            currentDraftHtml = art.html || `<p>${art.excerpt || ""}</p>`;
            if (htmlSourceMode) rawHtmlArea.value = currentDraftHtml;
            else safeSetHTML(visualEditor, currentDraftHtml);
            updateWords();
          }
        }, h("span", {}, `${depth > 0 ? "↳ " : ""}${art.title.slice(0, 24)}`), h("span", { class: "mono-meta" }, art.status === "Published" ? "#live" : "#draft"))
      );
      items.push(...renderNoteTreeNodes(art.slug, depth + 1));
    }
    return items;
  }

  const editorPane = createToolCard(
    "3. TriliumNext Note Tree & Rich Editor",
    htmlSourceMode ? "HTML / Code" : "Trilium Rich Note",
    "ok",
    fileManagerBar,
    h("div", { class: "org-layout" },
      h("aside", { class: "card", style: "padding:0.65rem;gap:0.45rem;" },
        h("div", { class: "card-header" },
          h("strong", { style: "font-size:var(--text-xs);" }, "Trilium Note Tree"),
          createStatusPill("ETAPI", "info")
        ),
        h("div", { class: "org-folder-list" },
          ...(savedArticles.length
            ? renderNoteTreeNodes("", 0)
            : [h("span", { class: "mono-meta" }, "No notes yet — click + New Article")])
        ),
        newChildNoteBtn,
        triliumTagBtn
      ),
      h("div", { style: "display:flex;flex-direction:column;gap:0.65rem;min-inline-size:0;" },
        h("div", { class: "form-grid" },
          h("div", { class: "field" }, h("label", { class: "field-label", for: "ed-title" }, "Note / Article Title"), titleIn),
          h("div", { class: "field" }, h("label", { class: "field-label", for: "ed-slug" }, "EmDash / Note Slug"), slugIn)
        ),
        toolbar,
        htmlSourceMode ? rawHtmlArea : visualEditor,
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.5rem;" },
          wordCounter,
          h(
            "div",
            { style: "display:flex;gap:0.5rem;" },
            h(
              "button",
              {
                type: "button",
                class: "btn btn--subtle",
                onClick: () => {
                  saveArticleDraft({ title: titleIn.value.trim(), slug: slugIn.value.trim(), html: currentDraftHtml, publishToHub: false });
                  showToast("Saved Trilium note draft", { tone: "info" });
                }
              },
              "Save Note Draft"
            ),
            h(
              "button",
              {
                type: "button",
                class: "btn btn--primary",
                onClick: () => {
                  saveArticleDraft({ title: titleIn.value.trim(), slug: slugIn.value.trim(), html: currentDraftHtml, publishToHub: true });
                  showToast("Published note to EmDash Hub & Listmonk (+45m work logged)", { tone: "ok" });
                }
              },
              "Publish to Hub & EmDash"
            )
          )
        )
      )
    )
  );

  const whiteboardPane = createWhiteboardPane({
    idPrefix: "art-wb",
    scenarioId: "article",
    onSendToEditor: (it) => {
      currentDraftHtml = `${currentDraftHtml}\n<blockquote><p><strong>[${it.authorName} · ${it.kind}]</strong> ${it.text}</p></blockquote>`;
      if (htmlSourceMode) rawHtmlArea.value = currentDraftHtml;
      else safeSetHTML(visualEditor, currentDraftHtml);
      showToast("Inserted whiteboard note into Article Editor", { tone: "ok" });
    }
  });

  const previewSurface = h("div", {
    class: "rich-editor-surface",
    style: "min-block-size:280px;padding:1.25rem;background:var(--bg-canvas);"
  });
  safeSetHTML(previewSurface, currentDraftHtml);

  const previewPane = createToolCard(
    "5. Live Article Preview",
    "Reader View",
    "info",
    h("div", { style: "display:flex;flex-direction:column;gap:0.35rem;padding-bottom:0.65rem;border-bottom:1px solid var(--border-subtle);" },
      h("h2", { style: "margin:0;font-size:var(--text-xl);" }, titleIn.value || "Untitled Article"),
      h("span", { class: "mono-meta" }, `/${slugIn.value || "draft"} · ${wordCounter.textContent}`)
    ),
    previewSurface
  );

  return createStudioTabs({
    ariaLabel: "Article studio workspace tabs",
    initialTab: "editor",
    onTabChange: (tabId) => {
      if (tabId === "preview") safeSetHTML(previewSurface, currentDraftHtml);
    },
    sourcesNode: researchPane,
    brainstormNode: brainstormPane,
    editorNode: editorPane,
    whiteboardNode: whiteboardPane,
    previewNode: previewPane
  });
}
