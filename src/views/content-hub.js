import { SCENARIOS } from "../data/seed.js";
import { openChannelWebsiteModal } from "../components/modal.js";
import { copyText } from "../lib/clipboard.js";
import { createScenarioBadge, createStatusPill, createTabs, formatNumber, h } from "../lib/dom.js";
import { renderModuleVersionGuard } from "../lib/workbench-helpers.js";
import {
  addChannelStatus,
  can,
  canAccessTool,
  createContentFolder,
  getState,
  getTenantSlice,
  moveAssetToTrash,
  moveContentToFolder,
  requestAssetPermission,
  resolvePermissionRequest,
  restoreAssetFromTrash,
  setAssetProtection,
  syncTriliumReadyNotes
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let activeTab = "organizer";
let organizerMode = "folders"; // "folders" | "tree" | "timeline" | "today" | "day" | "weekly"
let organizerScenario = "all"; // "all" | "article" | "video" | "podcast" | "music" | "social"
let hubScopeMode = "role"; // "role" | "team"
let selectedFolderId = "__all__"; // "__all__" | "__root__" | folderId
let selectedOrgDate = "2026-11-25";
let articleFolderFilter = "__all__";
let videoFormatFilter = "all"; // "all" | "16:9" | "9:16"
let podcastPlaying = false;
let podcastProgressSec = 312;

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDurationSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

function parseIsoDate(iso) {
  const [y, m, d] = String(iso || "2026-11-25").split("-").map(Number);
  return new Date(Date.UTC(y || 2026, (m || 11) - 1, d || 25));
}

function toIsoDate(dt) {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function addDaysIso(iso, days) {
  const dt = parseIsoDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIsoDate(dt);
}

function getMondayIso(iso) {
  const dt = parseIsoDate(iso);
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return toIsoDate(dt);
}

function getFolderName(folderId, folders) {
  if (!folderId) return "Unfiled Root";
  return folders.find((f) => f.id === folderId)?.name ?? "Unfiled Root";
}

function createFolderMoveControl(item, folders, canEdit) {
  if (!item.movable || !canEdit) {
    return h("span", { class: "mono-meta" }, `Folder: ${getFolderName(item.folderId, folders)}`);
  }
  const sel = h(
    "select",
    {
      class: "select",
      style: "max-inline-size:210px;padding:0.25rem 0.45rem;font-size:var(--text-xs);",
      "aria-label": `Move "${item.title}" to folder`,
      onChange: (e) => {
        const nextFolder = e.target.value === "__root__" ? null : e.target.value;
        moveContentToFolder({ kind: item.kind, itemId: item.id, folderId: nextFolder });
        showToast(`Moved "${item.title}" → ${getFolderName(nextFolder, folders)}`, { tone: "ok" });
      }
    },
    h("option", { value: "__root__", selected: !item.folderId }, "Unfiled Root"),
    ...folders.map((f) => h("option", { value: f.id, selected: item.folderId === f.id }, f.name))
  );
  return h("div", { style: "display:flex;align-items:center;gap:0.35rem;" },
    h("span", { class: "mono-meta" }, "Folder:"),
    sel
  );
}

function collectUnifiedAssets(slice, ctx, todayIso) {
  const chMap = new Map(ctx.channels.map((c) => [c.id, c.name]));
  const items = [];

  for (const art of slice.articles ?? []) {
    const dateIso = art.publishedAt || (art.updatedAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? todayIso);
    items.push({
      id: art.id,
      kind: "article",
      movable: true,
      scenario: "article",
      title: art.title,
      subtitle: `${art.words ?? 0} words · SEO ${art.seoScore ?? 92} · ${art.excerpt || ""}`,
      channelId: art.channelId,
      channelName: chMap.get(art.channelId) ?? ctx.workspace.name,
      folderId: art.folderId || null,
      dateIso,
      status: art.status || "Published",
      protection: art.protection || "Normal",
      formatLabel: "Article",
      targets: art.publishedTargets ?? [],
      studioHref: "/studio?scenario=article"
    });
  }

  for (const vid of slice.videos ?? []) {
    items.push({
      id: vid.id,
      kind: "video",
      movable: true,
      scenario: "video",
      title: vid.title,
      subtitle: `${vid.format || "16:9 Full Video"} · ${fmtDurationSec(vid.durationSec)} · ${vid.fps || 60}fps`,
      channelId: vid.channelId,
      channelName: chMap.get(vid.channelId) ?? ctx.workspace.name,
      folderId: vid.folderId || null,
      dateIso: vid.publishedAt || todayIso,
      status: vid.status || "Rendered",
      protection: vid.protection || "Normal",
      formatLabel: vid.format || "16:9 Full Video",
      targets: vid.targets ?? [],
      studioHref: "/studio?scenario=video"
    });
  }

  for (const ep of slice.podcasts ?? []) {
    items.push({
      id: ep.id,
      kind: "podcast",
      movable: true,
      scenario: "podcast",
      title: `Ep. ${ep.episodeNumber} — ${ep.title}`,
      subtitle: `${ep.duration || "45:00"} · ${formatNumber(ep.downloads ?? 0)} plays · ${ep.rssStatus || "Castopod RSS"}`,
      channelId: ep.channelId,
      channelName: chMap.get(ep.channelId) ?? ctx.workspace.name,
      folderId: ep.folderId || null,
      dateIso: ep.publishedAt || todayIso,
      status: ep.rssStatus || "Published",
      formatLabel: "Podcast",
      targets: ["Castopod RSS", "YouTube Live VOD"],
      studioHref: "/studio?scenario=podcast"
    });
  }

  for (const rel of slice.musicReleases ?? []) {
    items.push({
      id: rel.id,
      kind: "music",
      movable: true,
      scenario: "music",
      title: rel.title,
      subtitle: `${rel.key || "Studio Master"} · ${rel.bpm || 94} BPM · ${rel.duration || "03:45"}`,
      channelId: rel.channelId,
      channelName: chMap.get(rel.channelId) ?? ctx.workspace.name,
      folderId: rel.folderId || null,
      dateIso: rel.publishedAt || rel.releaseDate || todayIso,
      status: rel.status || "Master Ready",
      formatLabel: "Music",
      targets: ["FLAC Master", "Lyrics Hub"],
      studioHref: "/studio?scenario=music"
    });
  }

  for (const st of slice.channelStatuses ?? []) {
    const isShort = (st.mediaType || "").toLowerCase().includes("short");
    const inferredDate = st.createdAt?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? todayIso;
    items.push({
      id: st.id,
      kind: "status",
      movable: false,
      scenario: isShort ? "video" : "social",
      title: st.title,
      subtitle: st.body,
      channelId: st.channelId,
      channelName: chMap.get(st.channelId) ?? ctx.workspace.name,
      folderId: null,
      dateIso: inferredDate,
      status: st.status || "Published",
      formatLabel: st.mediaType || "Status",
      targets: st.publishedToSocial ?? [],
      studioHref: isShort ? "/studio?scenario=video" : "/studio?scenario=social"
    });
  }

  return items;
}

function renderAssetRowCard(item, folders, canEdit) {
  const snap = getState();
  const ctx = getTenantSlice(snap).ctx;
  const isOwnerOrAdmin = ctx.isGodMode || ctx.role.id === "tenant_admin" || canAccessTool(`studio:${item.scenario}`, snap);
  const reqSel = h("select", { class: "select", style: "max-inline-size:145px;padding:0.2rem 0.4rem;font-size:var(--text-xs);" },
    h("option", { value: "Read & Write" }, "Read & Write"),
    h("option", { value: "Read Only" }, "Read Only"),
    h("option", { value: "Archive" }, "Archive"),
    h("option", { value: "Protected" }, "Protected")
  );
  const prot = item.protection || "Normal";

  return h(
    "article",
    { class: "card", style: "padding:0.75rem;gap:0.45rem;" },
    h(
      "div",
      { class: "card-header" },
      h("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;" },
        createScenarioBadge(item.scenario, SCENARIOS),
        h("strong", { style: "font-size:var(--text-sm);" }, item.title)
      ),
      h("div", { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
        prot !== "Normal" ? createStatusPill(prot, prot === "Protected" ? "warn" : "info") : null,
        createStatusPill(item.formatLabel, "info"),
        createStatusPill(item.status, "ok")
      )
    ),
    h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, item.subtitle),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;" },
        h("span", { class: "mono-meta" }, `${item.channelName} · ${item.dateIso}`),
        ...(item.targets ?? []).slice(0, 3).map((t) => h("span", { class: "tag" }, t))
      ),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;" },
        createFolderMoveControl(item, folders, canEdit && prot !== "Protected"),
        item.movable && isOwnerOrAdmin
          ? h("select", {
              class: "select",
              style: "max-inline-size:120px;padding:0.2rem 0.4rem;font-size:var(--text-xs);",
              "aria-label": `Protection for ${item.title}`,
              onChange: (e) => {
                setAssetProtection({ kind: item.kind, itemId: item.id, protection: e.target.value });
                showToast(`Updated "${item.title}" → ${e.target.value}`, { tone: "info" });
              }
            },
              h("option", { value: "Normal", selected: prot === "Normal" }, "Normal"),
              h("option", { value: "Protected", selected: prot === "Protected" }, "Protected"),
              h("option", { value: "Archived", selected: prot === "Archived" }, "Archived")
            )
          : null,
        item.movable && isOwnerOrAdmin && prot !== "Protected"
          ? h("button", {
              type: "button",
              class: "btn btn--ghost btn--sm",
              onClick: () => {
                moveAssetToTrash({ kind: item.kind, itemId: item.id });
                showToast(`Moved "${item.title}" to Trashcan`, { tone: "warn" });
              }
            }, "Trash")
          : null,
        !isOwnerOrAdmin
          ? h("div", { style: "display:inline-flex;gap:0.25rem;align-items:center;" },
              reqSel,
              h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: () => {
                  requestAssetPermission({ itemId: item.id, itemTitle: item.title, scenario: item.scenario, accessLevel: reqSel.value });
                  showToast(`Requested ${reqSel.value} access for "${item.title}"`, { tone: "warn" });
                }
              }, "Request Access")
            )
          : h("a", { href: item.studioHref, class: "btn btn--subtle btn--sm" }, "Edit in Studio →")
      )
    )
  );
}

export function renderContentHub() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { ctx } = slice;
  const canSyncTrilium = can("articles:sync", snap);
  const canEdit = can("articles:sync", snap) || can("social:write", snap) || can("pipeline:write", snap);
  const todayIso = snap.watcherConfig?.referenceToday || "2026-11-25";

  const suiteGuard = renderModuleVersionGuard("mod-cms-hub", "Content Hub & Organizer");
  if (!suiteGuard.enabled) {
    return [
      h("header", { class: "page-header" }, h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Content Hub & Organizer")),
      ...suiteGuard.blockedNodes
    ];
  }

  const isTeamWide = ctx.isGodMode || ctx.role.id === "tenant_admin" || hubScopeMode === "team";
  const wsFilter = (row) => !ctx.tenantScoped || !row.workspaceId || row.workspaceId === ctx.workspace.id;
  const rawContent = snap.content ?? {};
  const articles = isTeamWide ? [...(rawContent.articles ?? []).filter(wsFilter), ...(rawContent.triliumReadyQueue ?? []).filter(wsFilter)] : [...slice.articles, ...slice.triliumReadyQueue];
  const videos = isTeamWide ? (rawContent.videos ?? []).filter(wsFilter) : (slice.videos ?? []);
  const podcasts = isTeamWide ? (rawContent.podcasts ?? []).filter(wsFilter) : (slice.podcasts ?? []);
  const statuses = isTeamWide ? (snap.channelStatuses ?? []).filter(wsFilter) : (slice.channelStatuses ?? []);
  const music = isTeamWide ? (rawContent.musicReleases ?? []).filter(wsFilter) : (slice.musicReleases ?? []);
  const folders = slice.folders ?? [];
  const readyCount = slice.triliumReadyQueue.length;
  const totalOrganized = articles.length + videos.length + podcasts.length + music.length + statuses.length;

  const header = h(
    "header",
    { class: "page-header" },
    h(
      "div",
      { class: "page-header-row" },
      h("div", {},
        h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Content Hub & Organizer"),
        h(
          "p",
          { class: "page-subtitle" },
          `Folders, Hierarchical Tree, Timeline & Calendar Organizer across Articles, 16:9 Videos, 9:16 Shorts, Podcasts, Music & Statuses for ${ctx.workspace.name}`
        )
      ),
      h("div", { style: "display:flex;gap:0.5rem;flex-wrap:wrap;" },
        h("div", { class: "segmented", role: "group", "aria-label": "Hub scope" },
          h("button", {
            type: "button",
            class: hubScopeMode === "role" && !ctx.isGodMode && ctx.role.id !== "tenant_admin" ? "is-active" : "",
            onClick: () => { hubScopeMode = "role"; window.dispatchEvent(new CustomEvent("godflow:rerender")); }
          }, `My Scope (${ctx.role.badge})`),
          h("button", {
            type: "button",
            class: isTeamWide ? "is-active" : "",
            onClick: () => { hubScopeMode = "team"; window.dispatchEvent(new CustomEvent("godflow:rerender")); }
          }, `Entire Team (${ctx.workspace.name})`)
        ),
        canSyncTrilium
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--primary",
                onClick: () => {
                  const res = syncTriliumReadyNotes();
                  if (res.syncedCount > 0) {
                    showToast(`Synced ${res.syncedCount} #publish-ready TriliumNext articles → Website & Organizer`, { tone: "ok" });
                  } else {
                    showToast("All #publish-ready notes already synced into Websites & Folders", { tone: "info" });
                  }
                }
              },
              readyCount > 0 ? `Sync TriliumNext #publish-ready (${readyCount})` : "TriliumNext Synced"
            )
          : null,
        canAccessTool("studio:article", snap) ? h("a", { href: "/studio?scenario=article", class: "btn btn--subtle" }, "Article Editor + Sources") : null,
        canAccessTool("studio:video", snap) ? h("a", { href: "/studio?scenario=video", class: "btn btn--subtle" }, "Videos & Shorts Studio") : null
      )
    )
  );

  const kpis = h(
    "section",
    { class: "grid-kpi", "aria-label": "Content hub inventory" },
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, isTeamWide ? "Team Assets" : "My Assets"), h("strong", { class: "kpi-value" }, String(totalOrganized)), h("span", { class: "mono-meta" }, isTeamWide ? `All ${ctx.workspace.name} formats` : `${ctx.role.badge} scope`)),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Articles"), h("strong", { class: "kpi-value" }, String(articles.length)), h("span", { class: "mono-meta" }, `${readyCount} TriliumReady`)),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Videos & Shorts"), h("strong", { class: "kpi-value" }, String(videos.length)), h("span", { class: "mono-meta" }, `${videos.filter((v) => v.aspect === "9:16").length} vertical Shorts`)),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Folders · Audio"), h("strong", { class: "kpi-value" }, `${folders.length} · ${podcasts.length + music.length}`), h("span", { class: "mono-meta" }, `${podcasts.length} Podcasts · ${music.length} Music`))
  );

  function renderOrganizerTab() {
    const allItems = collectUnifiedAssets(slice, ctx, todayIso);
    const filteredByScenario = organizerScenario === "all" ? allItems : allItems.filter((it) => it.scenario === organizerScenario);

    const viewModes = [
      { id: "folders", label: "Folders" },
      { id: "tree", label: "Tree" },
      { id: "timeline", label: "Timeline" },
      { id: "today", label: "Today" },
      { id: "day", label: "Day-wise" },
      { id: "weekly", label: "Weekly" }
    ];

    const typeFilters = [
      { id: "all", label: `All (${allItems.length})` },
      { id: "article", label: "Articles" },
      { id: "video", label: "Videos & Shorts" },
      { id: "podcast", label: "Podcasts" },
      { id: "music", label: "Music" },
      { id: "social", label: "Statuses & Social" }
    ];

    const controlsCard = h(
      "section",
      { class: "card", style: "padding:0.8rem 1rem;gap:0.65rem;" },
      h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.6rem;" },
        h("div", { class: "segmented", role: "group", "aria-label": "Content organizer view style" },
          ...viewModes.map((vm) =>
            h("button", {
              type: "button",
              class: organizerMode === vm.id ? "is-active" : "",
              "aria-pressed": String(organizerMode === vm.id),
              onClick: () => {
                organizerMode = vm.id;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            }, vm.label)
          )
        ),
        h("div", { class: "filter-bar" },
          ...typeFilters.map((tf) =>
            h("button", {
              type: "button",
              class: "filter-pill",
              "aria-pressed": String(organizerScenario === tf.id),
              onClick: () => {
                organizerScenario = tf.id;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            }, tf.label)
          )
        )
      )
    );

    let viewBody = null;

    if (organizerMode === "folders") {
      const folderNameIn = h("input", { id: "org-new-folder-name", class: "input", type: "text", placeholder: "New folder name..." });
      const folderScenSel = h(
        "select",
        { id: "org-new-folder-scen", class: "select" },
        h("option", { value: "all" }, "All Content Types"),
        h("option", { value: "article" }, "Articles"),
        h("option", { value: "video" }, "Videos & Shorts"),
        h("option", { value: "podcast" }, "Podcasts"),
        h("option", { value: "music" }, "Music Releases")
      );

      const folderItems =
        selectedFolderId === "__all__"
          ? filteredByScenario
          : selectedFolderId === "__root__"
            ? filteredByScenario.filter((i) => !i.folderId)
            : filteredByScenario.filter((i) => i.folderId === selectedFolderId);

      const folderSidebar = h(
        "aside",
        { class: "card", style: "padding:0.8rem;gap:0.65rem;" },
        h("div", { class: "card-header" },
          h("h2", { class: "card-title", style: "font-size:var(--text-sm);" }, "Content Folders"),
          createStatusPill(`${folders.length} Folders`, "info")
        ),
        h("div", { class: "org-folder-list" },
          h("button", {
            type: "button",
            class: `org-folder-btn${selectedFolderId === "__all__" ? " is-active" : ""}`,
            onClick: () => {
              selectedFolderId = "__all__";
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          }, h("span", {}, "All Organized Assets"), h("span", { class: "mono-meta" }, String(filteredByScenario.length))),
          h("button", {
            type: "button",
            class: `org-folder-btn${selectedFolderId === "__root__" ? " is-active" : ""}`,
            onClick: () => {
              selectedFolderId = "__root__";
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          }, h("span", {}, "Unfiled Root"), h("span", { class: "mono-meta" }, String(filteredByScenario.filter((i) => !i.folderId).length))),
          ...folders.map((fld) => {
            const cnt = filteredByScenario.filter((i) => i.folderId === fld.id).length;
            return h("button", {
              type: "button",
              class: `org-folder-btn${selectedFolderId === fld.id ? " is-active" : ""}`,
              onClick: () => {
                selectedFolderId = fld.id;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            }, h("span", {}, fld.name), h("span", { class: "mono-meta" }, String(cnt)));
          })
        ),
        canEdit
          ? h("form", {
              style: "display:flex;flex-direction:column;gap:0.4rem;padding-top:0.45rem;border-top:1px solid var(--border-subtle);",
              onSubmit: (e) => {
                e.preventDefault();
                if (!folderNameIn.value.trim()) return;
                const created = createContentFolder({ name: folderNameIn.value.trim(), scenario: folderScenSel.value });
                if (created) {
                  selectedFolderId = created.id;
                  showToast(`Created folder "${created.name}"`, { tone: "ok" });
                }
              }
            },
              h("span", { class: "mono-meta" }, "+ Create Organizer Folder"),
              h("label", { class: "visually-hidden", for: "org-new-folder-name" }, "Folder name"),
              folderNameIn,
              h("label", { class: "visually-hidden", for: "org-new-folder-scen" }, "Folder category"),
              folderScenSel,
              h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Create Folder")
            )
          : null
      );

      const folderLabel =
        selectedFolderId === "__all__"
          ? "All Organized Content"
          : selectedFolderId === "__root__"
            ? "Unfiled Root Items"
            : getFolderName(selectedFolderId, folders);

      const folderMain = h(
        "div",
        { style: "display:flex;flex-direction:column;gap:0.75rem;" },
        h("section", { class: "card", style: "padding:0.7rem 0.9rem;" },
          h("div", { class: "card-header" },
            h("h2", { class: "card-title" }, `Folder: ${folderLabel}`),
            createStatusPill(`${folderItems.length} items`, "ok")
          )
        ),
        ...(folderItems.length
          ? folderItems.map((it) => renderAssetRowCard(it, folders, canEdit))
          : [h("section", { class: "card" }, h("p", { class: "mono-meta" }, "No assets inside this folder yet — move any Article, Video, Short, Podcast, or Track into it from another folder."))])
      );

      viewBody = h("div", { class: "org-layout" }, folderSidebar, folderMain);
    } else if (organizerMode === "tree") {
      const branches = ctx.channels.map((ch) => {
        const chItems = filteredByScenario.filter((it) => it.channelId === ch.id);
        const byScenario = ["article", "video", "podcast", "music", "social"]
          .map((scId) => {
            const meta = SCENARIOS.find((s) => s.id === scId);
            const list = chItems.filter((it) => it.scenario === scId);
            return { scId, label: meta?.label || scId, items: list };
          })
          .filter((grp) => grp.items.length > 0);

        return h(
          "details",
          { class: "org-tree-branch", open: true },
          h("summary", {},
            h("span", {}, `${ch.name} (${ch.domain})`),
            createStatusPill(`${chItems.length} assets`, "info")
          ),
          h("div", { class: "org-tree-children" },
            ...(byScenario.length
              ? byScenario.map((grp) => {
                  const byFolder = new Map();
                  for (const item of grp.items) {
                    const key = item.folderId || "__root__";
                    if (!byFolder.has(key)) byFolder.set(key, []);
                    byFolder.get(key).push(item);
                  }
                  return h(
                    "details",
                    { class: "org-tree-branch", open: true },
                    h("summary", {},
                      h("span", { style: "display:inline-flex;align-items:center;gap:0.4rem;" },
                        createScenarioBadge(grp.scId, SCENARIOS),
                        grp.label
                      ),
                      h("span", { class: "mono-meta" }, `${grp.items.length} items`)
                    ),
                    h("div", { class: "org-tree-children" },
                      ...[...byFolder.entries()].map(([fKey, list]) => {
                        const fLabel = fKey === "__root__" ? "Root / General" : getFolderName(fKey, folders);
                        return h(
                          "details",
                          { class: "org-tree-branch", open: true },
                          h("summary", {},
                            h("span", {}, fLabel),
                            h("span", { class: "mono-meta" }, `${list.length}`)
                          ),
                          h("div", { class: "org-tree-children" },
                            ...list.map((it) => renderAssetRowCard(it, folders, canEdit))
                          )
                        );
                      })
                    )
                  );
                })
              : [h("p", { class: "mono-meta" }, "No assets match current category filter.")])
          )
        );
      });
      viewBody = h("section", { style: "display:flex;flex-direction:column;gap:0.75rem;" }, ...branches);
    } else if (organizerMode === "timeline") {
      const sorted = [...filteredByScenario].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
      viewBody = h(
        "section",
        { class: "card", style: "gap:0.75rem;" },
        h("div", { class: "card-header" },
          h("h2", { class: "card-title" }, "Chronological Content Timeline"),
          createStatusPill(`${sorted.length} Assets Newest First`, "info")
        ),
        h(
          "div",
          { class: "org-timeline" },
          ...(sorted.length
            ? sorted.map((it) =>
                h("article", { class: "org-timeline-item" },
                  h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.4rem;" },
                    h("div", { style: "display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;" },
                      h("span", { class: "mono-meta", style: "font-weight:700;" }, it.dateIso === todayIso ? `${it.dateIso} (TODAY)` : it.dateIso),
                      createScenarioBadge(it.scenario, SCENARIOS),
                      h("strong", { style: "font-size:var(--text-sm);" }, it.title)
                    ),
                    createStatusPill(it.formatLabel, "ok")
                  ),
                  h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, it.subtitle),
                  h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.4rem;" },
                    h("span", { class: "mono-meta" }, `${it.channelName} · Folder: ${getFolderName(it.folderId, folders)} · ${(it.targets ?? []).join(", ")}`),
                    h("a", { href: it.studioHref, class: "btn btn--subtle btn--sm" }, "Open Studio →")
                  )
                )
              )
            : [h("p", { class: "mono-meta" }, "No assets match your filter in timeline.")])
        )
      );
    } else if (organizerMode === "today") {
      const todayItems = filteredByScenario.filter((it) => it.dateIso === todayIso);
      const todayWork = (slice.workEvents ?? []).filter((w) => w.date === todayIso);
      viewBody = h(
        "section",
        { style: "display:flex;flex-direction:column;gap:0.75rem;" },
        h("section", { class: "card", style: "padding:0.75rem 1rem;" },
          h("div", { class: "card-header" },
            h("h2", { class: "card-title" }, `Today Focus — ${todayIso}`),
            createStatusPill(`${todayItems.length} Content Drops · ${todayWork.length} Production Blocks`, "ok")
          )
        ),
        ...(todayItems.length
          ? todayItems.map((it) => renderAssetRowCard(it, folders, canEdit))
          : [h("section", { class: "card" }, h("p", { class: "mono-meta" }, `No content scheduled specifically for ${todayIso} under this filter.`))]),
        todayWork.length
          ? h("section", { class: "card" },
              h("div", { class: "card-header" }, h("h3", { class: "card-title", style: "font-size:var(--text-sm);" }, `Active Production Schedule (${todayIso})`)),
              h("ul", { class: "feed-list" },
                ...todayWork.map((ev) =>
                  h("li", { class: "feed-row" },
                    h("div", { class: "feed-row-main" },
                      h("span", { style: "font-size:var(--text-xs);font-weight:600;" }, ev.title),
                      h("span", { class: "mono-meta" }, `${String(Math.floor(ev.startHour)).padStart(2, "0")}:00 (${ev.durationHours}h) · ${ev.tool}`)
                    ),
                    createStatusPill(ev.status, ev.status === "Live Tracking" ? "ok" : "info")
                  )
                )
              )
            )
          : null
      );
    } else if (organizerMode === "day") {
      const dayItems = filteredByScenario.filter((it) => it.dateIso === selectedOrgDate);
      const uniqueDates = [...new Set(allItems.map((i) => i.dateIso))].sort();
      const dateInput = h("input", {
        id: "org-day-picker",
        class: "input input--mono",
        type: "date",
        value: selectedOrgDate,
        style: "max-inline-size:170px;",
        onChange: (e) => {
          if (!e.target.value) return;
          selectedOrgDate = e.target.value;
          window.dispatchEvent(new CustomEvent("godflow:rerender"));
        }
      });

      viewBody = h(
        "section",
        { style: "display:flex;flex-direction:column;gap:0.75rem;" },
        h("section", { class: "card", style: "padding:0.75rem 1rem;gap:0.55rem;" },
          h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
            h("div", { style: "display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;" },
              h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { selectedOrgDate = addDaysIso(selectedOrgDate, -1); window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "← Prev Day"),
              dateInput,
              h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { selectedOrgDate = addDaysIso(selectedOrgDate, 1); window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Next Day →"),
              h("button", { type: "button", class: "btn btn--primary btn--sm", onClick: () => { selectedOrgDate = todayIso; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Jump Today")
            ),
            createStatusPill(`${selectedOrgDate} · ${dayItems.length} Items`, dayItems.length ? "ok" : "info")
          ),
          h("div", { class: "filter-bar" },
            h("span", { class: "mono-meta" }, "Active Dates:"),
            ...uniqueDates.map((d) =>
              h("button", {
                type: "button",
                class: "filter-pill",
                "aria-pressed": String(selectedOrgDate === d),
                onClick: () => {
                  selectedOrgDate = d;
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              }, d === todayIso ? `${d} (Today)` : d)
            )
          )
        ),
        ...(dayItems.length
          ? dayItems.map((it) => renderAssetRowCard(it, folders, canEdit))
          : [h("section", { class: "card" }, h("p", { class: "mono-meta" }, `No content scheduled on ${selectedOrgDate}. Click any active date above or open a studio to publish for today.`))])
      );
    } else {
      const mondayIso = getMondayIso(selectedOrgDate);
      const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(mondayIso, i));
      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      viewBody = h(
        "section",
        { class: "card", style: "gap:0.75rem;" },
        h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
          h("div", {},
            h("h2", { class: "card-title" }, `Weekly Content Calendar (${weekDates[0]} → ${weekDates[6]})`),
            h("span", { class: "mono-meta" }, "Click any day header to inspect that day's items in Day-wise view")
          ),
          h("div", { style: "display:flex;gap:0.4rem;" },
            h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { selectedOrgDate = addDaysIso(selectedOrgDate, -7); window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "← Prev Week"),
            h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { selectedOrgDate = todayIso; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "This Week"),
            h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { selectedOrgDate = addDaysIso(selectedOrgDate, 7); window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Next Week →")
          )
        ),
        h(
          "div",
          { class: "cal-week-grid" },
          ...weekDates.map((iso, idx) => {
            const dayItems = filteredByScenario.filter((it) => it.dateIso === iso);
            const isToday = iso === todayIso;
            return h(
              "div",
              { class: `cal-week-col${isToday ? " is-today" : ""}` },
              h("button", {
                type: "button",
                class: "btn btn--ghost btn--sm",
                style: "width:100%;justify-content:space-between;padding:0.25rem 0.4rem;",
                onClick: () => {
                  selectedOrgDate = iso;
                  organizerMode = "day";
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              },
                h("strong", {}, `${dayLabels[idx]} ${iso.slice(5)}`),
                h("span", { class: "mono-meta" }, String(dayItems.length))
              ),
              ...dayItems.map((it) =>
                h("a", {
                  href: it.studioHref,
                  class: "cal-event-chip",
                  dataset: { scenario: it.scenario },
                  style: "text-decoration:none;color:inherit;"
                },
                  h("strong", {}, it.title),
                  h("span", { class: "mono-meta" }, `${it.formatLabel} · ${it.channelName}`)
                )
              )
            );
          })
        )
      );
    }

    return h("div", { style: "display:flex;flex-direction:column;gap:0.85rem;" }, controlsCard, viewBody);
  }

  function renderArticlesTab() {
    const filteredArticles =
      articleFolderFilter === "__all__"
        ? articles
        : articleFolderFilter === "__root__"
          ? articles.filter((a) => !a.folderId)
          : articles.filter((a) => a.folderId === articleFolderFilter);

    const folderBar = h(
      "section",
      { class: "card", style: "padding:0.75rem 1rem;" },
      h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
        h("div", { class: "filter-bar" },
          h("span", { class: "mono-meta" }, "Article Folders:"),
          h("button", { type: "button", class: "filter-pill", "aria-pressed": String(articleFolderFilter === "__all__"), onClick: () => { articleFolderFilter = "__all__"; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, `All (${articles.length})`),
          ...folders
            .filter((f) => f.scenario === "article" || f.scenario === "all")
            .map((f) =>
              h("button", { type: "button", class: "filter-pill", "aria-pressed": String(articleFolderFilter === f.id), onClick: () => { articleFolderFilter = f.id; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, f.name)
            )
        ),
        h("a", { href: "/studio?scenario=article", class: "btn btn--primary btn--sm" }, "Open Article Editor + Sources →")
      )
    );

    return h(
      "div",
      { style: "display:grid;gap:0.85rem;" },
      folderBar,
      ...filteredArticles.map((art) => {
        const channel = ctx.channels.find((c) => c.id === art.channelId);
        const frontmatter = `---\ntitle: "${art.title}"\nslug: "${art.slug}"\nchannel: "${channel?.name ?? ctx.workspace.name}"\ntracking_slug: "${art.affiliateProps?.slug ?? ""}"\nsponsor: "${art.sponsorProps?.sponsor ?? ""}"\n---`;
        return h(
          "article",
          { class: "card" },
          h("div", { class: "card-header" },
            h("div", {},
              h("h2", { class: "card-title" }, art.title),
              h("span", { class: "mono-meta" }, `${channel?.domain ?? ctx.workspace.domain}/articles/${art.slug} · ${art.triliumNoteId ?? "tril-draft"} · SEO ${art.seoScore ?? 92}/100 · Folder: ${getFolderName(art.folderId, folders)}`)
            ),
            createStatusPill(art.status, art.status === "Published" ? "ok" : "warn")
          ),
          h("p", { style: "margin:0;font-size:var(--text-sm);color:var(--text-secondary);" }, art.excerpt),
          h("div", { style: "display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;" },
            h("span", { class: "mono-meta" }, `${art.words} words`),
            ...(art.publishedTargets ?? []).map((tgt) => h("span", { class: "tag" }, tgt))
          ),
          h("div", { class: "grid-2" },
            h("section", { class: "card", style: "background:var(--bg-canvas);padding:0.75rem;" },
              h("div", { class: "card-header" },
                h("strong", { style: "font-size:var(--text-xs);" }, "MDX Affiliate Callout Props"),
                createStatusPill(`/go/${art.affiliateProps?.slug}`, "ok")
              ),
              h("strong", { style: "font-size:var(--text-sm);" }, art.affiliateProps?.title ?? "Recommended Partner"),
              h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, art.affiliateProps?.summary ?? ""),
              h("span", { class: "mono-meta" }, art.affiliateProps?.commission ?? "")
            ),
            h("section", { class: "card", style: "background:var(--bg-canvas);padding:0.75rem;" },
              h("div", { class: "card-header" },
                h("strong", { style: "font-size:var(--text-xs);" }, "Sponsor Inline Ad Props"),
                createStatusPill(art.sponsorProps?.sponsor ?? "Sponsor", "info")
              ),
              h("strong", { style: "font-size:var(--text-sm);" }, art.sponsorProps?.headline ?? "Partner Spotlight"),
              h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, art.sponsorProps?.copy ?? "")
            )
          ),
          h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
            createFolderMoveControl({ id: art.id, kind: "article", movable: true, title: art.title, folderId: art.folderId }, folders, canEdit),
            h("div", { style: "display:flex;gap:0.5rem;flex-wrap:wrap;" },
              channel ? h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => openChannelWebsiteModal(channel.id) }, `Preview on ${channel.domain}`) : null,
              h("button", {
                type: "button",
                class: "btn btn--subtle btn--sm",
                onClick: async () => {
                  const ok = await copyText(frontmatter);
                  showToast(ok ? "Copied EmDash MDX Frontmatter" : "Frontmatter preview ready", { tone: "info" });
                }
              }, "Copy MDX Frontmatter")
            )
          )
        );
      })
    );
  }

  function renderVideosTab() {
    const filteredVids =
      videoFormatFilter === "all"
        ? videos
        : videos.filter((v) => v.aspect === videoFormatFilter);

    return h(
      "div",
      { style: "display:grid;gap:0.85rem;" },
      h("section", { class: "card", style: "padding:0.75rem 1rem;" },
        h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
          h("div", { class: "filter-bar" },
            h("span", { class: "mono-meta" }, "Video Format:"),
            h("button", { type: "button", class: "filter-pill", "aria-pressed": String(videoFormatFilter === "all"), onClick: () => { videoFormatFilter = "all"; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, `All (${videos.length})`),
            h("button", { type: "button", class: "filter-pill", "aria-pressed": String(videoFormatFilter === "16:9"), onClick: () => { videoFormatFilter = "16:9"; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "16:9 Full Videos"),
            h("button", { type: "button", class: "filter-pill", "aria-pressed": String(videoFormatFilter === "9:16"), onClick: () => { videoFormatFilter = "9:16"; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "9:16 Vertical Shorts")
          ),
          h("a", { href: "/studio?scenario=video", class: "btn btn--primary btn--sm" }, "+ Produce Video / Short →")
        )
      ),
      ...filteredVids.map((vid) => {
        const ch = ctx.channels.find((c) => c.id === vid.channelId);
        return h(
          "article",
          { class: "card" },
          h("div", { class: "card-header" },
            h("div", {},
              h("h2", { class: "card-title" }, vid.title),
              h("span", { class: "mono-meta" }, `${ch?.name ?? ctx.workspace.name} · ${vid.publishedAt} · ${fmtDurationSec(vid.durationSec)} @ ${vid.fps || 60}fps · ${getFolderName(vid.folderId, folders)}`)
            ),
            h("div", { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
              createStatusPill(vid.aspect || "16:9", vid.aspect === "9:16" ? "warn" : "info"),
              createStatusPill(vid.status, "ok")
            )
          ),
          vid.hookLine ? h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, `Hook: "${vid.hookLine}"`) : null,
          h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
            h("div", { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" }, ...(vid.targets ?? []).map((t) => h("span", { class: "tag" }, t))),
            h("div", { style: "display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;" },
              createFolderMoveControl({ id: vid.id, kind: "video", movable: true, title: vid.title, folderId: vid.folderId }, folders, canEdit),
              h("a", { href: "/studio?scenario=video", class: "btn btn--subtle btn--sm" }, "Edit in Video Studio →")
            )
          )
        );
      })
    );
  }

  function renderStatusesTab() {
    const canStatusWrite = can("social:write", snap) || can("articles:sync", snap);
    const chSel = h("select", { id: "st-ch", class: "select", disabled: !canStatusWrite },
      ...ctx.channels.map((c) => h("option", { value: c.id }, `${c.name} (${c.domain})`))
    );
    const typeSel = h("select", { id: "st-type", class: "select", disabled: !canStatusWrite },
      h("option", { value: "Short Video + Status" }, "Short Video (9:16) + Status"),
      h("option", { value: "Text Status + Article Teaser" }, "Text Status + Article Teaser"),
      h("option", { value: "Live Desk Notice" }, "Live Stream / Broadcast Notice"),
      h("option", { value: "Animated GIF + Thread" }, "Animated GIF + Social Thread")
    );
    const titleIn = h("input", { id: "st-title", class: "input", type: "text", required: true, disabled: !canStatusWrite, placeholder: "e.g., 3 Calm Workspace Tweaks (00:45 Short)" });
    const bodyIn = h("textarea", { id: "st-body", class: "textarea", required: true, disabled: !canStatusWrite, placeholder: "Write channel status update + short caption synced to website & social..." });

    const composeForm = h(
      "form",
      {
        class: "card",
        onSubmit: (e) => {
          e.preventDefault();
          if (!titleIn.value.trim() || !bodyIn.value.trim()) return;
          addChannelStatus({
            title: titleIn.value.trim(),
            body: bodyIn.value.trim(),
            channelId: chSel.value,
            mediaType: typeSel.value,
            publishToWebsite: true,
            publishToSocial: ["YouTube Shorts", "X", "Instagram Reels"]
          });
          showToast(`Published status & short update to website + social`, { tone: "ok" });
        }
      },
      h("div", { class: "card-header" }, h("h2", { class: "card-title" }, "Publish New Channel Status & Short Update"), createStatusPill("Web + Social Sync", "ok")),
      h("div", { class: "form-grid" },
        h("div", { class: "field" }, h("label", { class: "field-label", for: "st-ch" }, "Channel Website"), chSel),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "st-type" }, "Update Type"), typeSel)
      ),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "st-title" }, "Headline"), titleIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "st-body" }, "Status / Short Caption"), bodyIn),
      h("div", { style: "display:flex;justify-content:flex-end;" },
        h("button", { type: "submit", class: "btn btn--primary", disabled: !canStatusWrite }, "Publish to Channel Website + Social →")
      )
    );

    const statusCards = statuses.map((st) => {
      const ch = ctx.channels.find((c) => c.id === st.channelId);
      return h(
        "article",
        { class: "card" },
        h("div", { class: "card-header" },
          h("div", {},
            h("strong", {}, st.title),
            h("div", { class: "mono-meta" }, `${ch?.name ?? ctx.workspace.name} · ${st.mediaType} · ${st.createdAt}`)
          ),
          createStatusPill(st.status, st.status === "Published" ? "ok" : "warn")
        ),
        h("p", { style: "margin:0;font-size:var(--text-sm);color:var(--text-secondary);" }, st.body),
        h("div", { class: "kpi-foot" },
          h("div", { style: "display:flex;gap:0.35rem;flex-wrap:wrap;" },
            st.websitePath ? h("span", { class: "tag" }, st.websitePath.replace("https://", "")) : null,
            ...(st.publishedToSocial ?? []).map((p) => h("span", { class: "tag" }, p))
          ),
          h("span", { class: "mono-meta" }, st.engagementLabel)
        )
      );
    });

    return h("div", { style: "display:grid;gap:0.85rem;" }, composeForm, ...statusCards);
  }

  function renderPodcastTab() {
    if (!podcasts.length) {
      return h("section", { class: "card" }, h("p", { class: "mono-meta" }, "No podcast episodes available under this scope."));
    }
    const ep = podcasts[0];
    const channel = ctx.channels.find((c) => c.id === ep.channelId);
    const scrubber = h("input", {
      id: "pod-scrubber",
      type: "range",
      min: "0",
      max: String(ep.durationSec || 2400),
      value: String(podcastProgressSec),
      "aria-label": "Podcast playback timeline position",
      style: "inline-size:100%;"
    });
    const timeLabel = h("span", { id: "pod-time-readout", class: "mono-meta" }, `${fmtTime(podcastProgressSec)} / ${ep.duration}`);
    scrubber.addEventListener("input", () => {
      podcastProgressSec = Number(scrubber.value);
      timeLabel.textContent = `${fmtTime(podcastProgressSec)} / ${ep.duration}`;
    });

    return h(
      "div",
      { style: "display:grid;gap:0.85rem;" },
      ...podcasts.map((episode, idx) =>
        h(
          "article",
          { class: "card" },
          h("div", { class: "card-header" },
            h("div", {},
              h("h2", { class: "card-title" }, `Episode ${episode.episodeNumber}: ${episode.title}`),
              h("span", { class: "mono-meta" }, `${channel?.name ?? ctx.workspace.name} · ${episode.publishedAt} · ${episode.rssUrl} · ${formatNumber(episode.downloads)} plays`)
            ),
            createStatusPill(episode.rssStatus, "ok")
          ),
          idx === 0
            ? h(
                "section",
                { class: "card", style: "background:var(--bg-canvas);padding:0.85rem;" },
                h("div", { class: "audio-player-controls" },
                  h("button", {
                    type: "button",
                    class: "btn btn--primary btn--sm",
                    onClick: () => {
                      podcastPlaying = !podcastPlaying;
                      window.dispatchEvent(new CustomEvent("godflow:rerender"));
                    }
                  }, podcastPlaying ? "Pause" : "Play Episode"),
                  scrubber,
                  timeLabel
                )
              )
            : null,
          h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
            createFolderMoveControl({ id: episode.id, kind: "podcast", movable: true, title: episode.title, folderId: episode.folderId }, folders, canEdit),
            h("a", { href: "/studio?scenario=podcast", class: "btn btn--subtle btn--sm" }, "Script & Live Simulcast →")
          )
        )
      )
    );
  }

  function renderMusicTab() {
    if (!music.length) {
      return h("section", { class: "card" }, h("p", { class: "mono-meta" }, "No music releases found under current scope."));
    }
    return h(
      "div",
      { style: "display:grid;gap:0.85rem;" },
      ...music.map((rel) =>
        h(
          "article",
          { class: "card" },
          h("div", { class: "card-header" },
            h("div", {},
              h("h2", { class: "card-title" }, rel.title),
              h("span", { class: "mono-meta" }, `${rel.key} · ${rel.bpm} BPM · ${rel.duration} · ISRC ${rel.isrc}`)
            ),
            createStatusPill(rel.status, "ok")
          ),
          h("pre", { style: "margin:0;padding:0.75rem;border-radius:var(--radius-sm);background:var(--bg-canvas);font-size:var(--text-xs);white-space:pre-wrap;font-family:var(--font-sans);" }, rel.lyrics),
          h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
            createFolderMoveControl({ id: rel.id, kind: "music", movable: true, title: rel.title, folderId: rel.folderId }, folders, canEdit),
            h("a", { href: "/studio?scenario=music", class: "btn btn--subtle btn--sm" }, "Open Music & Lyrics Studio →")
          )
        )
      )
    );
  }

  function renderPermissionsTab() {
    const canApprove = ctx.isGodMode || ctx.role.id === "tenant_admin";
    const reqs = (snap.content?.permissionRequests ?? []).filter((r) => !ctx.tenantScoped || r.workspaceId === ctx.workspace.id);
    const titleIn = h("input", { class: "input", type: "text", placeholder: "Asset or Thumbnail/Video title..." });
    const scenSel = h("select", { class: "select" }, ...SCENARIOS.map((s) => h("option", { value: s.id }, s.label)));
    const levelSel = h("select", { class: "select" },
      h("option", { value: "Read & Write" }, "Read & Write"),
      h("option", { value: "Read Only" }, "Read Only"),
      h("option", { value: "Archive" }, "Archive"),
      h("option", { value: "Protected" }, "Protected")
    );

    return h("div", { style: "display:grid;gap:0.85rem;" },
      h("form", {
        class: "card",
        style: "padding:0.75rem 1rem;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!titleIn.value.trim()) return;
          requestAssetPermission({ itemId: `custom-${Date.now()}`, itemTitle: titleIn.value.trim(), scenario: scenSel.value, accessLevel: levelSel.value });
          showToast(`Submitted ${levelSel.value} permission request`, { tone: "ok" });
        }
      },
        h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:end;" },
          h("div", { class: "field", style: "flex:1;" }, h("label", { class: "field-label" }, "Cross-Team Asset"), titleIn),
          h("div", { class: "field" }, h("label", { class: "field-label" }, "Team / Workflow"), scenSel),
          h("div", { class: "field" }, h("label", { class: "field-label" }, "Requested Access"), levelSel),
          h("button", { type: "submit", class: "btn btn--primary btn--sm" }, "Request Permission →")
        )
      ),
      ...(reqs.length
        ? reqs.map((r) =>
            h("article", { class: "card", style: "padding:0.75rem;" },
              h("div", { class: "card-header" },
                h("div", {},
                  h("strong", {}, `${r.requesterName} (${r.requesterRole}) → ${r.itemTitle}`),
                  h("div", { class: "mono-meta" }, `Scope: ${r.scenario} · Level: ${r.accessLevel} · ${r.createdAt}`)
                ),
                createStatusPill(r.status, r.status === "Approved" ? "ok" : r.status === "Denied" ? "warn" : "info")
              ),
              canApprove && r.status === "Pending"
                ? h("div", { style: "display:flex;gap:0.4rem;" },
                    h("button", { type: "button", class: "btn btn--primary btn--sm", onClick: () => resolvePermissionRequest(r.id, true) }, "Approve"),
                    h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => resolvePermissionRequest(r.id, false) }, "Deny")
                  )
                : null
            )
          )
        : [h("section", { class: "card" }, h("p", { class: "mono-meta" }, "No cross-team permission requests yet."))])
    );
  }

  function renderTrashAndLogTab() {
    const trashItems = (snap.content?.trashcan ?? []).filter((t) => !ctx.tenantScoped || t.workspaceId === ctx.workspace.id);
    const logs = (snap.auditLog ?? []).filter((l) => !ctx.tenantScoped || l.workspace === ctx.workspace.id);

    return h("div", { style: "display:grid;gap:0.85rem;" },
      h("section", { class: "card" },
        h("div", { class: "card-header" },
          h("h2", { class: "card-title" }, `Trashcan (${trashItems.length})`),
          createStatusPill("Protected items cannot be trashed", "info")
        ),
        ...(trashItems.length
          ? trashItems.map((t) =>
              h("div", { class: "feed-row" },
                h("div", { class: "feed-row-main" },
                  h("strong", { style: "font-size:var(--text-xs);" }, `${t.item?.title || t.id} (${t.kind})`),
                  h("span", { class: "mono-meta" }, `Deleted by ${t.deletedBy} at ${t.deletedAt}`)
                ),
                h("button", {
                  type: "button",
                  class: "btn btn--subtle btn--sm",
                  onClick: () => {
                    restoreAssetFromTrash(t.id);
                    showToast(`Restored "${t.item?.title}"`, { tone: "ok" });
                  }
                }, "Restore →")
              )
            )
          : [h("p", { class: "mono-meta" }, "Trashcan is empty.")])
      ),
      h("section", { class: "card" },
        h("div", { class: "card-header" },
          h("h2", { class: "card-title" }, `Tenant & User Activity Log (${logs.length})`),
          createStatusPill(ctx.workspace.name, "ok")
        ),
        h("ul", { class: "feed-list" },
          ...logs.slice(0, 15).map((l) =>
            h("li", { class: "feed-row" },
              h("div", { class: "feed-row-main" },
                h("strong", { style: "font-size:var(--text-xs);" }, `${l.actor} (${l.role})`),
                h("span", { class: "mono-meta" }, l.action)
              ),
              createStatusPill(l.time, l.tone || "info")
            )
          )
        )
      )
    );
  }

  const tabDefs = [
    { id: "organizer", label: "Organizer (Folders · Tree · Calendar)", count: totalOrganized, render: renderOrganizerTab },
    ...(articles.length && (isTeamWide || canAccessTool("hub:articles", snap)) ? [{ id: "articles", label: "Articles (Website)", count: articles.length, render: renderArticlesTab }] : []),
    ...(videos.length && (isTeamWide || canAccessTool("hub:videos", snap) || canAccessTool("hub:social", snap))
      ? [{ id: "videos", label: "Videos & Shorts", count: videos.length, render: renderVideosTab }]
      : []),
    ...(statuses.length && (isTeamWide || canAccessTool("hub:articles", snap) || canAccessTool("distribution:social", snap))
      ? [{ id: "statuses", label: "Statuses & Shorts", count: statuses.length, render: renderStatusesTab }]
      : []),
    ...(podcasts.length && (isTeamWide || canAccessTool("hub:podcast", snap)) ? [{ id: "podcast", label: "Podcast Episodes", count: podcasts.length, render: renderPodcastTab }] : []),
    ...(music.length && (isTeamWide || canAccessTool("hub:music", snap)) ? [{ id: "music", label: "Music Releases", count: music.length, render: renderMusicTab }] : []),
    { id: "permissions", label: "Permissions & Requests", count: (snap.content?.permissionRequests ?? []).filter((r) => !ctx.tenantScoped || r.workspaceId === ctx.workspace.id).length, render: renderPermissionsTab },
    { id: "trash", label: "Trashcan & Log", count: (snap.content?.trashcan ?? []).filter((t) => !ctx.tenantScoped || t.workspaceId === ctx.workspace.id).length, render: renderTrashAndLogTab }
  ];

  const validInitial = tabDefs.some((t) => t.id === activeTab) ? activeTab : tabDefs[0]?.id;
  const tabs = createTabs({
    ariaLabel: "Content Hub & Organizer sections",
    tabs: tabDefs,
    initialId: validInitial,
    onChange: (nextId) => {
      activeTab = nextId;
    }
  });

  return [header, ...(suiteGuard.bannerNode ? [suiteGuard.bannerNode] : []), kpis, tabs];
}
