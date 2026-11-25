import { createStatusPill, h } from "../lib/dom.js";
import {
  addResearchSource,
  exportCanvasToSocial,
  exportGifToSocial,
  getActiveContext,
  getState,
  updateGifMaker,
  updateImageCanvas
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import {
  createBrainstormPane,
  createFaderControl,
  createStudioTabs,
  createToolCard,
  createWhiteboardPane
} from "../lib/workbench-helpers.js";

let assetQuery = "";
let assetCategory = "All";
let studioMode = "social"; // "social" | "thumbnail" | "gif"
let gifPlaying = false;
let gifFrameCursor = 0;
let gifTimerId = null;

const RATIO_DIMS = {
  "1280x720": [640, 360], // YouTube Thumbnail 16:9
  "1080x1350": [540, 675], // Portrait Feed / Carousel
  "1200x675": [640, 360], // X Wide Card
  "1080x1080": [540, 540], // Square Post
  "1080x1920": [405, 720] // Vertical Story / Short Cover
};

function drawVisualCanvas(canvas, canvasCfg, asset, { mode = "social", gifFrameText = null, gifFrameIdx = 0, gifTotal = 1 } = {}) {
  if (!canvas || typeof canvas.getContext !== "function") return;
  const targetRatio = mode === "thumbnail" ? "1280x720" : canvasCfg.ratio;
  const [w, hPx] = RATIO_DIMS[targetRatio] ?? [640, 360];
  canvas.width = w;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const palettes = [
    asset?.palette ?? ["#0f172a", "#1e293b", "#38bdf8"],
    ["#1e1b4b", "#312e81", "#fbbf24"],
    ["#064e3b", "#0f766e", "#22d3ee"]
  ];
  const [c1, c2, accent] = mode === "gif" ? palettes[gifFrameIdx % palettes.length] : palettes[0];

  ctx.filter = `brightness(${canvasCfg.brightness}%) contrast(${canvasCfg.contrast}%)`;
  const grad = ctx.createLinearGradient(0, 0, w, hPx);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, hPx);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = 32; x < w; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hPx);
    ctx.stroke();
  }

  // Thumbnail CTR split glow & high-contrast burst
  if (mode === "thumbnail") {
    ctx.fillStyle = "#f43f5e";
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(w * 0.78, hPx * 0.35, w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, w - 16, hPx - 16);
  } else {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(w * 0.84, hPx * 0.2, w * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.filter = "none";

  // Top Badge / CTR Tag
  const badge =
    mode === "gif"
      ? `GIF FRAME ${gifFrameIdx + 1}/${gifTotal}`
      : mode === "thumbnail"
        ? (canvasCfg.ctrBadge || "WATCH THIS FIRST").toUpperCase()
        : (canvasCfg.badgeText || asset?.badge || "GODFLOW").toUpperCase();
  ctx.font = "700 13px monospace";
  const bWidth = ctx.measureText(badge).width + 24;
  ctx.fillStyle = mode === "thumbnail" ? "#facc15" : accent;
  ctx.fillRect(34, 30, bWidth, 28);
  ctx.fillStyle = "#090a0d";
  ctx.fillText(badge, 46, 49);

  // Headline / Animated GIF Frame Text
  const displayHead = mode === "gif" ? (gifFrameText || canvasCfg.headline) : canvasCfg.headline || "CREATOR POST";
  const fSize = Math.round((mode === "thumbnail" ? Math.max(46, canvasCfg.fontSize || 48) : canvasCfg.fontSize || 42) * (w / 560));
  ctx.font = `800 ${fSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  const words = String(displayHead).split(/\s+/);
  let line = "";
  let yPos = Math.round(hPx * (mode === "thumbnail" ? 0.45 : 0.44));
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w - 68 && line) {
      ctx.fillText(line, 34, yPos);
      line = word;
      yPos += fSize * 1.12;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 34, yPos);

  ctx.font = "600 18px Inter, system-ui, sans-serif";
  ctx.fillStyle = mode === "thumbnail" ? "#fde047" : "#cbd5e1";
  ctx.fillText(mode === "gif" ? canvasCfg.subhead || "Animated GIF Loop Preview" : canvasCfg.subhead || "", 34, yPos + 36, w - 68);

  // Bottom Watermark / GIF Timeline bar
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, hPx - 44, w, 44);
  ctx.font = "600 13px monospace";
  ctx.fillStyle = accent;
  ctx.fillText(canvasCfg.watermark || "@godflow · godflow.media", 34, hPx - 17);
}

export function renderSocialStudio() {
  if (gifTimerId) {
    clearInterval(gifTimerId);
    gifTimerId = null;
  }

  const snap = getState();
  const wb = snap.workbenchData;
  const cfg = wb.imageCanvas;
  const gifCfg = wb.gifMaker ?? {
    delayMs: 240,
    loopLabel: "Infinite Loop",
    frames: [
      { id: "gf-1", text: "STOP WASTING 10 HRS/WK", durationMs: 240 },
      { id: "gf-2", text: "1 SOURCE DESK -> ALL FORMATS", durationMs: 240 },
      { id: "gf-3", text: "TRY GODFLOW CREATOR CLOUD ->", durationMs: 320 }
    ]
  };
  const { workspace } = getActiveContext(snap);
  const categories = ["All", "Desk & Gear", "Market Charts", "Music & Audio", "Podcast", "Code & Infra", "Video & Thumbnails"];

  const filteredAssets = wb.stockAssets.filter((a) => {
    const mCat = assetCategory === "All" || a.category.toLowerCase().includes(assetCategory.split(" ")[0].toLowerCase());
    const mQ = !assetQuery.trim() || a.title.toLowerCase().includes(assetQuery.toLowerCase()) || a.category.toLowerCase().includes(assetQuery.toLowerCase());
    return mCat && mQ;
  });

  const activeAsset = wb.stockAssets.find((a) => a.id === cfg.assetId) ?? wb.stockAssets[0];
  const frames = gifCfg.frames ?? [];
  const safeCursor = frames.length ? gifFrameCursor % frames.length : 0;
  const activeFrame = frames[safeCursor];

  const canvasEl = h("canvas", { class: "canvas-preview", "aria-label": `Live edited ${studioMode} preview` });
  drawVisualCanvas(canvasEl, cfg, activeAsset, {
    mode: studioMode,
    gifFrameText: activeFrame?.text,
    gifFrameIdx: safeCursor,
    gifTotal: frames.length || 1
  });

  // Column 1: Visual Assets + Online Reference Source Gathering
  const refTitleIn = h("input", { id: "soc-ref-title", class: "input", type: "text", placeholder: "Inspiration / thumbnail link title..." });
  const refUrlIn = h("input", { id: "soc-ref-url", class: "input input--mono", type: "url", placeholder: "https://..." });

  const searchPane = createToolCard(
    "1. Visual Search & Reference Gathering",
    `${filteredAssets.length} Assets`,
    "info",
    h(
      "div",
      { class: "field" },
      h("label", { class: "visually-hidden", for: "img-search" }, "Search stock, thumbnail and GIF templates"),
      h("input", {
        id: "img-search",
        class: "input",
        type: "search",
        value: assetQuery,
        placeholder: "Search thumbnails, studio photos, diagrams...",
        onInput: (e) => {
          assetQuery = e.target.value;
          window.dispatchEvent(new CustomEvent("godflow:rerender"));
        }
      })
    ),
    h(
      "div",
      { class: "filter-bar" },
      ...categories.map((cat) =>
        h(
          "button",
          {
            type: "button",
            class: "filter-pill",
            "aria-pressed": String(assetCategory === cat),
            onClick: () => {
              assetCategory = cat;
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          cat
        )
      )
    ),
    h(
      "div",
      { class: "asset-thumb-grid" },
      ...filteredAssets.map((a) =>
        h(
          "button",
          {
            type: "button",
            class: "asset-thumb-card",
            "aria-pressed": String(a.id === activeAsset?.id),
            onClick: () => updateImageCanvas({ assetId: a.id, badgeText: a.badge })
          },
          h("div", { style: `block-size:44px;border-radius:4px;background:linear-gradient(135deg,${a.palette[0]},${a.palette[1]});border-bottom:3px solid ${a.palette[2]};` }),
          h("strong", { style: "font-size:0.74rem;" }, a.title),
          h("span", { class: "mono-meta" }, `${a.category} · ${a.ratio}`)
        )
      )
    ),
    h("form", {
      style: "display:flex;flex-direction:column;gap:0.35rem;padding-top:0.35rem;border-top:1px solid var(--border-subtle);",
      onSubmit: (e) => {
        e.preventDefault();
        if (!refTitleIn.value.trim() || !refUrlIn.value.trim()) return;
        addResearchSource({
          title: refTitleIn.value.trim(),
          url: refUrlIn.value.trim(),
          summary: "Visual Thumbnail / GIF reference link saved from Social Studio.",
          body: `Visual design reference from ${refUrlIn.value.trim()}`
        });
        showToast("Saved visual inspiration source (+20m logged)", { tone: "ok" });
      }
    },
      h("span", { class: "mono-meta" }, "+ Gather Inspiration / Asset URL"),
      refTitleIn,
      refUrlIn,
      h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Save Visual Source")
    )
  );

  // Column 2: Social Image, YouTube Thumbnail Maker & Animated GIF Maker
  const liveCfg = { ...cfg };

  const redrawLive = (idx = safeCursor) => {
    drawVisualCanvas(canvasEl, liveCfg, activeAsset, {
      mode: studioMode,
      gifFrameText: frames[idx]?.text,
      gifFrameIdx: idx,
      gifTotal: frames.length || 1
    });
  };

  if (gifPlaying && studioMode === "gif" && frames.length > 1) {
    gifTimerId = setInterval(() => {
      if (!document.getElementById("cv-gif-status")) {
        clearInterval(gifTimerId);
        gifTimerId = null;
        return;
      }
      gifFrameCursor = (gifFrameCursor + 1) % frames.length;
      const statusEl = document.getElementById("cv-gif-status");
      if (statusEl) statusEl.textContent = `Frame ${gifFrameCursor + 1}/${frames.length}: ${frames[gifFrameCursor]?.text}`;
      redrawLive(gifFrameCursor);
    }, Math.max(100, Number(gifCfg.delayMs) || 240));
  }

  const modeTabs = h(
    "div",
    { class: "filter-bar", role: "group", "aria-label": "Choose Image, Thumbnail, or Animated GIF mode" },
    h("button", {
      type: "button",
      class: "filter-pill",
      "aria-pressed": String(studioMode === "social"),
      onClick: () => {
        studioMode = "social";
        gifPlaying = false;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    }, "Social Graphic"),
    h("button", {
      type: "button",
      class: "filter-pill",
      "aria-pressed": String(studioMode === "thumbnail"),
      onClick: () => {
        studioMode = "thumbnail";
        gifPlaying = false;
        updateImageCanvas({ ratio: "1280x720" });
      }
    }, "YouTube Thumbnail (16:9)"),
    h("button", {
      type: "button",
      class: "filter-pill",
      "aria-pressed": String(studioMode === "gif"),
      onClick: () => {
        studioMode = "gif";
        gifPlaying = true;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    }, "Animated GIF Maker")
  );

  const headIn = h("input", {
    id: "cv-head",
    class: "input",
    type: "text",
    value: liveCfg.headline,
    onInput: (e) => {
      liveCfg.headline = e.target.value;
      redrawLive();
    },
    onChange: (e) => updateImageCanvas({ headline: e.target.value })
  });
  const subIn = h("input", {
    id: "cv-sub",
    class: "input",
    type: "text",
    value: liveCfg.subhead,
    onInput: (e) => {
      liveCfg.subhead = e.target.value;
      redrawLive();
    },
    onChange: (e) => updateImageCanvas({ subhead: e.target.value })
  });
  const badgeIn = h("input", {
    id: "cv-badge",
    class: "input input--mono",
    type: "text",
    value: studioMode === "thumbnail" ? liveCfg.ctrBadge || "NEW VIDEO" : liveCfg.badgeText,
    onInput: (e) => {
      if (studioMode === "thumbnail") liveCfg.ctrBadge = e.target.value;
      else liveCfg.badgeText = e.target.value;
      redrawLive();
    },
    onChange: (e) => updateImageCanvas(studioMode === "thumbnail" ? { ctrBadge: e.target.value } : { badgeText: e.target.value })
  });
  const platSel = h(
    "select",
    { id: "cv-plat", class: "select" },
    h("option", { value: studioMode === "thumbnail" ? "YouTube Video" : "X" }, studioMode === "thumbnail" ? "YouTube Video Cover" : "X / Twitter"),
    h("option", { value: "Instagram" }, "Instagram Carousel"),
    h("option", { value: "LinkedIn" }, "LinkedIn"),
    h("option", { value: "YouTube Shorts" }, "YouTube Community / Shorts")
  );
  const ratioSel = h(
    "select",
    {
      id: "cv-ratio",
      class: "select",
      onChange: (e) => updateImageCanvas({ ratio: e.target.value })
    },
    ...Object.keys(RATIO_DIMS).map((r) => h("option", { value: r, selected: r === (studioMode === "thumbnail" ? "1280x720" : cfg.ratio) }, r))
  );

  // GIF Frame Controls when in GIF mode
  const newFrameIn = h("input", { id: "cv-gif-new", class: "input", type: "text", placeholder: "New animated GIF frame caption..." });
  const gifControls = studioMode === "gif"
    ? h("div", { style: "padding:0.65rem;border-radius:var(--radius-sm);background:var(--bg-subtle);display:flex;flex-direction:column;gap:0.5rem;" },
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:0.45rem;" },
          h("span", { id: "cv-gif-status", class: "mono-meta" }, `Frame ${safeCursor + 1}/${frames.length}: ${activeFrame?.text || ""}`),
          h("button", {
            type: "button",
            class: "btn btn--subtle btn--sm",
            "aria-pressed": String(gifPlaying),
            onClick: () => {
              gifPlaying = !gifPlaying;
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          }, gifPlaying ? "Pause GIF Loop" : "Play GIF Preview")
        ),
        createFaderControl({
          id: "cv-gif-delay",
          label: "Frame Delay",
          min: 100,
          max: 800,
          value: gifCfg.delayMs || 240,
          unit: "ms",
          onInput: (v) => updateGifMaker({ delayMs: v })
        }),
        h("div", { style: "display:flex;flex-wrap:wrap;gap:0.3rem;" },
          ...frames.map((fr, idx) =>
            h("button", {
              type: "button",
              class: "filter-pill",
              "aria-pressed": String(idx === safeCursor),
              onClick: () => {
                gifFrameCursor = idx;
                gifPlaying = false;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            }, `#${idx + 1}: ${fr.text.slice(0, 18)}`)
          )
        ),
        h("form", {
          style: "display:flex;gap:0.4rem;",
          onSubmit: (e) => {
            e.preventDefault();
            if (!newFrameIn.value.trim()) return;
            updateGifMaker({
              frames: [...frames, { id: `gf-${Date.now().toString(36)}`, text: newFrameIn.value.trim().toUpperCase(), durationMs: gifCfg.delayMs || 240 }]
            });
            showToast("Added animated GIF frame", { tone: "ok" });
          }
        },
          newFrameIn,
          h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Frame")
        )
      )
    : null;

  const modeBadgeText =
    studioMode === "thumbnail"
      ? "1280×720 YT THUMBNAIL"
      : studioMode === "gif"
        ? `ANIMATED GIF · ${frames.length} FRAMES`
        : cfg.ratio;

  const editorPane = createToolCard(
    "2. Thumbnail, GIF Maker & Canvas Studio",
    modeBadgeText,
    "ok",
    modeTabs,
    h("div", { class: "canvas-stage" }, canvasEl),
    ...(gifControls ? [gifControls] : []),
    h(
      "div",
      { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cv-ratio" }, "Canvas Size"), ratioSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cv-badge" }, studioMode === "thumbnail" ? "Thumbnail CTR Callout" : "Badge Label"), badgeIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cv-plat" }, "Target Channel"), platSel)
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cv-head" }, "Headline Overlay"), headIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cv-sub" }, "Subhead"), subIn)
    ),
    h(
      "div",
      { class: "form-grid" },
      createFaderControl({ id: "cv-bright", label: "Brightness", min: 65, max: 140, value: liveCfg.brightness, unit: "%", onInput: (v) => { liveCfg.brightness = v; redrawLive(); } }),
      createFaderControl({ id: "cv-cont", label: "Contrast", min: 75, max: 150, value: liveCfg.contrast, unit: "%", onInput: (v) => { liveCfg.contrast = v; redrawLive(); } }),
      createFaderControl({ id: "cv-fsize", label: "Headline Size", min: 26, max: 64, value: liveCfg.fontSize, unit: "px", onInput: (v) => { liveCfg.fontSize = v; redrawLive(); } })
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:flex-end;" },
      h(
        "button",
        {
          type: "button",
          class: "btn btn--subtle",
          onClick: () => {
            updateImageCanvas(liveCfg);
            const a = document.createElement("a");
            a.href = canvasEl.toDataURL("image/png");
            a.download = `godflow-${studioMode}-${liveCfg.ratio}.png`;
            a.click();
            showToast(`Downloaded ${studioMode === "thumbnail" ? "YouTube Thumbnail PNG" : "Canvas Frame PNG"}`, { tone: "ok" });
          }
        },
        studioMode === "gif" ? "Download Frame PNG" : "Download PNG"
      ),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary",
          onClick: () => {
            updateImageCanvas(liveCfg);
            if (studioMode === "gif") {
              exportGifToSocial({
                platform: platSel.value,
                title: frames.map((f) => f.text).slice(0, 2).join(" → ") || liveCfg.headline,
                delayMs: gifCfg.delayMs || 240,
                frameCount: frames.length
              });
              showToast(`Encoded & queued Animated GIF (${frames.length} frames) → ${platSel.value} (+25m tracked)`, { tone: "ok" });
              return;
            }
            exportCanvasToSocial({
              platform: platSel.value,
              title: studioMode === "thumbnail" ? `[THUMBNAIL] ${liveCfg.headline}` : liveCfg.headline,
              caption: `${liveCfg.headline} — ${liveCfg.subhead}`,
              trackingUrl: `https://${workspace.shortDomain}/gear?utm_source=${platSel.value.toLowerCase().replace(/\s+/g, "-")}&utm_medium=${studioMode}`,
              mediaBadge: studioMode === "thumbnail" ? "1280×720 Thumbnail" : liveCfg.badgeText
            });
            showToast(`Exported ${studioMode === "thumbnail" ? "YouTube Thumbnail" : "Social Graphic"} to ${platSel.value} (+25m tracked)`, { tone: "ok" });
          }
        },
        studioMode === "gif" ? "Export Animated GIF → Social Queue" : studioMode === "thumbnail" ? "Publish 16:9 Thumbnail → Queue" : "Export → Postiz Social Queue"
      )
    )
  );

  return createStudioTabs({
    ariaLabel: "Thumbnails, GIFs & Social studio workspace tabs",
    initialTab: "editor",
    sourcesNode: searchPane,
    brainstormNode: createBrainstormPane({
      idPrefix: "soc-br",
      scenarioLabel: "Thumbnails & GIFs",
      onInsertToEditor: (n) => {
        updateImageCanvas({ subhead: n.text.slice(0, 72) });
        showToast("Applied brainstorm line to Canvas subhead", { tone: "ok" });
      }
    }),
    editorNode: editorPane,
    whiteboardNode: createWhiteboardPane({ idPrefix: "soc-wb", scenarioId: "social" })
  });
}
