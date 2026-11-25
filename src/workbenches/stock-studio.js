import { copyText } from "../lib/clipboard.js";
import { createStatusPill, h } from "../lib/dom.js";
import { getActiveContext, getState, logWorkbenchAction } from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import {
  createBrainstormPane,
  createSourceGatheringCard,
  createStudioTabs,
  createToolCard,
  createWhiteboardPane
} from "../lib/workbench-helpers.js";
import { renderGamingStudio } from "./gaming-studio.js";

let activeObsScene = "Live Broadcast 4K";
let liveProfileMode = "broadcast";
let streamLive = false;
let selectedSourceId = null;
let watchlist = [
  { symbol: "NVDA", price: "148.20", delta: "+2.4%", level: "Pivot 145.50 / Target 152.00" },
  { symbol: "SPY", price: "601.45", delta: "+0.6%", level: "VWAP 599.80 · Gamma Call Wall 605" },
  { symbol: "QQQ", price: "512.80", delta: "+0.9%", level: "Support 509.20 · Opening Range High" },
  { symbol: "BTC-USD", price: "93,410", delta: "+1.8%", level: "Shelf 91,800 · Funding Neutral" },
  { symbol: "TLT", price: "91.60", delta: "-0.3%", level: "10Y Yield Watch 4.28%" }
];

export function renderStockStudio() {
  const snap = getState();
  const { workspace } = getActiveContext(snap);
  const sources = snap.workbenchData?.researchSources ?? [];
  if (!selectedSourceId || !sources.some((s) => s.id === selectedSourceId)) {
    selectedSourceId = sources[0]?.id ?? null;
  }

  const scenes = ["Live Broadcast 4K", "Camera + Screen Split", "Watchlist / Market Overlay", "Dual-PC Replay + Q&A"];

  const symIn = h("input", { id: "st-sym", class: "input input--mono", type: "text", placeholder: "Topic / Symbol" });
  const lvlIn = h("input", { id: "st-lvl", class: "input", type: "text", placeholder: "Show note / key timestamp..." });

  const modeBar = h(
    "div",
    { class: "filter-bar", role: "group", "aria-label": "Live Stream workbench profile" },
    h(
      "button",
      {
        type: "button",
        class: "filter-pill",
        "aria-pressed": String(liveProfileMode === "broadcast"),
        onClick: () => {
          liveProfileMode = "broadcast";
          window.dispatchEvent(new CustomEvent("godflow:rerender"));
        }
      },
      "Live Broadcast & Source Desk"
    ),
    h(
      "button",
      {
        type: "button",
        class: "filter-pill",
        "aria-pressed": String(liveProfileMode === "replay"),
        onClick: () => {
          liveProfileMode = "replay";
          window.dispatchEvent(new CustomEvent("godflow:rerender"));
        }
      },
      "Dual-PC Replay & Audio Mixer"
    )
  );

  if (liveProfileMode === "replay") {
    return h("div", { style: "display:flex;flex-direction:column;gap:0.85rem;" }, modeBar, renderGamingStudio());
  }

  const sourcesPane = createSourceGatheringCard({
    idPrefix: "live-src",
    title: "1. Live Topic & Source Gathering",
    sources,
    selectedId: selectedSourceId,
    onSelect: (id) => {
      selectedSourceId = id;
    },
    citeLabel: "Pin Source → Live Broadcast Rundown",
    onCite: (src) => {
      watchlist = [{ symbol: src.domain.slice(0, 10).toUpperCase(), price: "Source", delta: "LIVE", level: src.title }, ...watchlist];
      showToast(`Pinned "${src.title}" to Live Stream Desk`, { tone: "ok" });
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  });

  const watchlistPane = createToolCard(
    "2. Live Broadcast Watchlist & Show Cues",
    streamLive ? "STREAM LIVE" : "OBS ARMED",
    streamLive ? "ok" : "info",
    h(
      "div",
      { class: "ticker-grid" },
      ...watchlist.map((t) =>
        h(
          "article",
          { class: "card", style: "background:var(--bg-canvas);padding:0.65rem;gap:0.25rem;" },
          h("div", { style: "display:flex;justify-content:space-between;align-items:center;" }, h("strong", { class: "mono" }, t.symbol), createStatusPill(t.delta, t.delta.startsWith("+") || t.delta === "LIVE" ? "ok" : "warn")),
          h("div", { class: "mono", style: "font-size:1.05rem;font-weight:700;" }, t.price),
          h("span", { class: "mono-meta" }, t.level)
        )
      )
    ),
    h(
      "form",
      {
        class: "form-grid",
        style: "align-items:end;padding-top:0.4rem;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!symIn.value.trim()) return;
          watchlist = [{ symbol: symIn.value.trim().toUpperCase(), price: "Live", delta: "+0.0%", level: lvlIn.value.trim() || "Live rundown note" }, ...watchlist];
          showToast(`Added ${symIn.value.trim().toUpperCase()} to Live Stream desk`, { tone: "ok" });
          window.dispatchEvent(new CustomEvent("godflow:rerender"));
        }
      },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "st-sym" }, "Topic / Ticker"), symIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "st-lvl" }, "Thesis / Cue"), lvlIn),
      h("button", { type: "submit", class: "btn btn--subtle" }, "+ Add Cue")
    )
  );

  const chatMacro = `Live Stream Desk & Affiliate Links: https://${workspace.shortDomain}/tradingview | https://${workspace.shortDomain}/broker`;

  const obsPane = createToolCard(
    "3. OBS Live Stream Switcher & Telemetry",
    `Scene: ${activeObsScene}`,
    "ok",
    h(
      "div",
      { class: "filter-bar", role: "group", "aria-label": "OBS Live Stream Scenes" },
      ...scenes.map((sc) =>
        h(
          "button",
          {
            type: "button",
            class: "filter-pill",
            "aria-pressed": String(activeObsScene === sc),
            onClick: () => {
              activeObsScene = sc;
              showToast(`OBS switched → ${sc}`, { tone: "info" });
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          sc
        )
      )
    ),
    h(
      "div",
      { class: "feed-row" },
      h("span", { class: "mono-meta" }, "4K60 NVENC · 18,500 kbps · YouTube + Twitch + Website"),
      createStatusPill("BTCPay Alert Ready", "ok")
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
      h(
        "button",
        {
          type: "button",
          class: `btn ${streamLive ? "btn--subtle" : "btn--primary"}`,
          onClick: () => {
            streamLive = !streamLive;
            logWorkbenchAction({
              title: streamLive ? "Started Live Stream Broadcast" : "Saved Live Stream Replay Markers",
              scenario: "stock",
              minutes: streamLive ? 30 : 60,
              tool: `OBS (${activeObsScene})`
            });
            showToast(streamLive ? "Live stream started (+30m logged)" : "Live stream wrapped & logged (+60m)", { tone: "ok" });
          }
        },
        streamLive ? "End Stream & Save Replay" : "Go Live & Start Watcher"
      ),
      h("button", { type: "button", class: "btn btn--subtle", onClick: (e) => copyText(chatMacro, e.currentTarget, "Copied pinned chat macro") }, "Copy Pinned Chat Links"),
      h("button", { type: "button", class: "btn btn--ghost", onClick: () => showToast("Overlay test: ⚡ 21,000 sats zap triggered on OBS browser source", { tone: "ok" }) }, "Test Tip Overlay")
    )
  );

  return createStudioTabs({
    ariaLabel: "Live Stream studio workspace tabs",
    initialTab: "editor",
    sourcesNode: sourcesPane,
    brainstormNode: createBrainstormPane({ idPrefix: "live-br", scenarioLabel: "Live Stream" }),
    editorNode: h("div", { style: "display:flex;flex-direction:column;gap:0.85rem;" }, modeBar, obsPane),
    whiteboardNode: createWhiteboardPane({ idPrefix: "live-wb", scenarioId: "stock" })
  });
}
