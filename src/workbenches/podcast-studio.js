import { createStatusPill, formatNumber, h } from "../lib/dom.js";
import {
  addPodcastScriptSegment,
  getActiveContext,
  getState,
  getTenantSlice,
  logWorkbenchAction,
  savePodcastScript,
  setPodcastLiveScene,
  togglePodcastLivePlatform,
  togglePodcastSimulcastLive,
  updatePodcastAudioMix
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import {
  createBrainstormPane,
  createFaderControl,
  createSourceGatheringCard,
  createStudioTabs,
  createToolCard,
  createWhiteboardPane,
  safeSetHTML
} from "../lib/workbench-helpers.js";

let chapters = [
  { ts: "00:00", title: "Cold Open & Stack Economics" },
  { ts: "11:20", title: "Replacing SaaS with TriliumNext ETAPI" },
  { ts: "28:45", title: "RØDE Mid-Roll & Multi-Platform Q&A" },
  { ts: "41:10", title: "Direct-to-Creator Affiliates & BTCPay Tips" }
];
let selectedTranscriptIdx = 0;
let selectedSourceId = "src-1";
let rawHtmlMode = false;
let teleprompterMode = false;
let activeFormats = { bold: false, italic: false };
let toolbarStatusText = "Ready to compose podcast script and multi-platform broadcast cues.";

function countWords(htmlStr) {
  const plain = String(htmlStr || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return { words: 0, readMins: 0 };
  const words = plain.split(" ").length;
  return { words, readMins: Math.max(1, Math.round(words / 135)) };
}

export function renderPodcastStudio() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const ctx = getActiveContext(snap);
  const { workspace } = ctx;
  const ep = slice.podcasts[0] ?? snap.content.podcasts[0];

  const scriptData = snap.workbenchData?.podcastScript ?? {
    episodeTitle: ep?.title || "Episode Script",
    episodeNumber: ep?.episodeNumber || 92,
    channelId: ctx.channels[0]?.id || "",
    guestName: ep?.guest || "Featured Guest",
    targetDurationMin: 45,
    html: "<h2>Cold Open</h2><p>Welcome to the show.</p>",
    segments: []
  };

  const liveCfg = snap.workbenchData?.podcastLiveConfig ?? {
    isLive: false,
    startedAt: null,
    activeScene: "2-Shot Host + Guest (4K)",
    micGain: 84,
    guestGain: 78,
    soundboardLevel: 62,
    destinations: []
  };

  // --- COLUMN 1: PODCAST SCRIPT & RUN-OF-SHOW COMPOSER ---
  const titleIn = h("input", {
    id: "pod-script-title",
    class: "input",
    type: "text",
    value: scriptData.episodeTitle || ""
  });
  const epNumIn = h("input", {
    id: "pod-script-ep",
    class: "input input--mono",
    type: "number",
    min: "1",
    value: String(scriptData.episodeNumber ?? 92),
    style: "max-inline-size:96px;"
  });
  const guestIn = h("input", {
    id: "pod-script-guest",
    class: "input",
    type: "text",
    value: scriptData.guestName || "",
    placeholder: "Guest name or Solo host"
  });
  const durIn = h("input", {
    id: "pod-script-dur",
    class: "input input--mono",
    type: "number",
    min: "5",
    max: "240",
    value: String(scriptData.targetDurationMin ?? 45),
    style: "max-inline-size:88px;"
  });

  const channelSel = h(
    "select",
    { id: "pod-script-channel", class: "select" },
    ...ctx.channels.map((c) =>
      h("option", { value: c.id, selected: c.id === scriptData.channelId }, `${c.name} (${c.domain})`)
    )
  );

  const metricsBadge = createStatusPill(
    (() => {
      const m = countWords(scriptData.html);
      return `${m.words} words · ~${m.readMins}m read`;
    })(),
    "info"
  );

  const statusNote = h(
    "p",
    { id: "pod-toolbar-status", class: "mono-meta", role: "status", style: "margin:0;" },
    toolbarStatusText
  );

  const editorSurface = h("div", {
    id: "pod-rich-surface",
    class: `rich-editor-surface${teleprompterMode ? " rich-editor-surface--teleprompter" : ""}`,
    contenteditable: "true",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "Podcast script and talking points editor"
  });
  safeSetHTML(editorSurface, scriptData.html || "<p>Start writing your episode script...</p>");

  const rawHtmlArea = h("textarea", {
    id: "pod-raw-html",
    class: "input input--mono",
    rows: "12",
    "aria-label": "Raw HTML source of podcast script",
    value: scriptData.html || ""
  });

  const syncCountsAndStatus = (msg = "") => {
    const htmlNow = rawHtmlMode ? rawHtmlArea.value : editorSurface.innerHTML;
    const m = countWords(htmlNow);
    metricsBadge.textContent = `${m.words} words · ~${m.readMins}m read`;
    if (msg) {
      toolbarStatusText = msg;
      statusNote.textContent = msg;
    }
  };

  editorSurface.addEventListener("input", () => syncCountsAndStatus());
  rawHtmlArea.addEventListener("input", () => syncCountsAndStatus());

  const applyFormat = (cmd, val = null, label = "formatting") => {
    if (rawHtmlMode) {
      showToast("Switch out of Raw HTML mode to apply rich formatting", { tone: "info" });
      return;
    }
    try {
      editorSurface.focus?.();
      document.execCommand?.(cmd, false, val);
    } catch {
      const snippet =
        cmd === "formatBlock" && val === "H2"
          ? "<h2>Section Cue</h2>"
          : cmd === "formatBlock" && val === "BLOCKQUOTE"
            ? "<blockquote>Key talking point</blockquote>"
            : "<p>Cue text</p>";
      editorSurface.append(h("div", {}, snippet));
    }
    if (cmd === "bold") activeFormats.bold = !activeFormats.bold;
    if (cmd === "italic") activeFormats.italic = !activeFormats.italic;
    syncCountsAndStatus(`Applied ${label} in podcast script.`);
  };

  const insertScriptCueHtml = (snippet, msg) => {
    if (rawHtmlMode) {
      rawHtmlArea.value = `${rawHtmlArea.value}\n${snippet}`;
      syncCountsAndStatus(msg);
      return;
    }
    const curHtml = editorSurface.innerHTML || "";
    safeSetHTML(editorSurface, `${curHtml}\n${snippet}`);
    syncCountsAndStatus(msg);
  };

  const boldBtn = h("button", {
    type: "button",
    class: "btn btn--ghost btn--sm",
    "aria-pressed": String(activeFormats.bold),
    "aria-label": "Bold text",
    onClick: () => {
      applyFormat("bold", null, "bold");
      boldBtn.setAttribute("aria-pressed", String(activeFormats.bold));
    }
  }, "B");

  const italicBtn = h("button", {
    type: "button",
    class: "btn btn--ghost btn--sm",
    "aria-pressed": String(activeFormats.italic),
    "aria-label": "Italic text",
    onClick: () => {
      applyFormat("italic", null, "italic");
      italicBtn.setAttribute("aria-pressed", String(activeFormats.italic));
    }
  }, "I");

  const rawBtn = h("button", {
    type: "button",
    class: "btn btn--subtle btn--sm",
    "aria-pressed": String(rawHtmlMode),
    onClick: () => {
      rawHtmlMode = !rawHtmlMode;
      if (!rawHtmlMode) {
        safeSetHTML(editorSurface, rawHtmlArea.value);
      }
      toolbarStatusText = rawHtmlMode ? "Raw HTML script view enabled." : "Rich script view restored.";
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  }, "Raw HTML");

  const prompterBtn = h("button", {
    type: "button",
    class: "btn btn--subtle btn--sm",
    "aria-pressed": String(teleprompterMode),
    onClick: () => {
      teleprompterMode = !teleprompterMode;
      toolbarStatusText = teleprompterMode ? "Teleprompter mode active (large cadence text)." : "Teleprompter mode off.";
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  }, "Teleprompter");

  const scriptToolbar = h(
    "div",
    {
      class: "rich-toolbar",
      role: "toolbar",
      "aria-label": "Podcast script formatting and cue controls",
      focusgroup: "toolbar wrap"
    },
    h("div", { role: "group", "aria-label": "Text formatting", style: "display:flex;gap:0.25rem;" },
      boldBtn,
      italicBtn,
      h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => applyFormat("formatBlock", "H2", "Segment Heading") }, "Segment H2"),
      h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => applyFormat("insertUnorderedList", null, "Talking Points List") }, "Bullets"),
      h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => applyFormat("formatBlock", "BLOCKQUOTE", "Host Callout") }, "Quote")
    ),
    h("span", { role: "separator", "aria-orientation": "vertical" }),
    h("div", { role: "group", "aria-label": "Insert podcast cues", style: "display:flex;gap:0.25rem;" },
      h("button", {
        type: "button",
        class: "btn btn--subtle btn--sm",
        onClick: () => insertScriptCueHtml("<h3>[SPONSOR MID-ROLL · 60s]</h3><blockquote>Read sponsor talking points + unique /go tracking code.</blockquote>", "Inserted 60s Sponsor Mid-Roll block.")
      }, "+ Sponsor Cue"),
      h("button", {
        type: "button",
        class: "btn btn--subtle btn--sm",
        onClick: () => insertScriptCueHtml("<p><strong>[SFX CUE · Transition Sting]</strong> Switch to 2-Shot scene &amp; poll livestream chat.</p>", "Inserted SFX & Livestream Chat prompt.")
      }, "+ SFX / Live Q")
    ),
    h("span", { role: "separator", "aria-orientation": "vertical" }),
    h("div", { role: "group", "aria-label": "Script display modes", style: "display:flex;gap:0.25rem;" },
      rawBtn,
      prompterBtn
    )
  );

  // Quick Run-of-Show Segment Adder
  const segTsIn = h("input", { id: "pod-seg-ts", class: "input input--mono", type: "text", value: "42:00", style: "max-inline-size:84px;" });
  const segTitleIn = h("input", { id: "pod-seg-title", class: "input", type: "text", placeholder: "Segment Title", style: "max-inline-size:150px;" });
  const segCueIn = h("input", { id: "pod-seg-cue", class: "input", type: "text", placeholder: "Host / livestream cue note..." });

  const scriptCol = createToolCard(
    "1. Podcast Script & Run-of-Show Studio",
    `Ep. ${scriptData.episodeNumber ?? 92}`,
    "info",
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:space-between;align-items:center;" },
      h("span", { class: "mono-meta" }, "Write talking points, mid-roll sponsor scripts, and live teleprompter cues"),
      metricsBadge
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-script-title" }, "Episode Script Title"), titleIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-script-channel" }, "Channel"), channelSel)
    ),
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-script-ep" }, "Ep #"), epNumIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-script-dur" }, "Min"), durIn),
      h("div", { class: "field", style: "flex:1;" }, h("label", { class: "field-label", for: "pod-script-guest" }, "Guest / Co-Host"), guestIn)
    ),
    scriptToolbar,
    rawHtmlMode ? rawHtmlArea : editorSurface,
    statusNote,
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
      h("button", {
        type: "button",
        class: "btn btn--subtle",
        onClick: () => {
          const html = rawHtmlMode ? rawHtmlArea.value : editorSurface.innerHTML;
          savePodcastScript({
            episodeTitle: titleIn.value.trim() || "Untitled Podcast Episode",
            episodeNumber: Number(epNumIn.value) || 92,
            channelId: channelSel.value,
            guestName: guestIn.value.trim(),
            targetDurationMin: Number(durIn.value) || 45,
            html,
            publishToHub: false
          });
          showToast("Saved Podcast Script to workspace & SQLite DB", { tone: "ok" });
        }
      }, "Save Script Draft"),
      h("button", {
        type: "button",
        class: "btn btn--primary",
        onClick: () => {
          const html = rawHtmlMode ? rawHtmlArea.value : editorSurface.innerHTML;
          savePodcastScript({
            episodeTitle: titleIn.value.trim() || "Untitled Podcast Episode",
            episodeNumber: Number(epNumIn.value) || 92,
            channelId: channelSel.value,
            guestName: guestIn.value.trim(),
            targetDurationMin: Number(durIn.value) || 45,
            html,
            publishToHub: true
          });
          showToast("Published Podcast Script & queued episode to Castopod Hub (+35m logged)", { tone: "ok" });
        }
      }, "Publish Script → Castopod Hub")
    ),
    h("div", { style: "border-block-start:1px solid var(--border-subtle);padding-block-start:0.65rem;display:flex;flex-direction:column;gap:0.45rem;" },
      h("strong", { style: "font-size:var(--text-xs);" }, `Run-of-Show Segment Cues (${(scriptData.segments ?? []).length})`),
      h("ul", { class: "feed-list" },
        ...(scriptData.segments ?? []).map((seg) =>
          h("li", { class: "feed-row" },
            h("div", { class: "feed-row-main" },
              h("span", { style: "font-size:var(--text-xs);font-weight:600;" }, `[${seg.ts}] ${seg.title}`),
              h("span", { class: "mono-meta" }, seg.cue)
            ),
            createStatusPill(seg.ts, "info")
          )
        )
      ),
      h("form", {
        style: "display:flex;flex-wrap:wrap;gap:0.4rem;align-items:end;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!segTitleIn.value.trim() && !segCueIn.value.trim()) return;
          addPodcastScriptSegment({
            ts: segTsIn.value.trim() || "42:00",
            title: segTitleIn.value.trim() || "Run-of-Show Segment",
            cue: segCueIn.value.trim() || segTitleIn.value.trim()
          });
          showToast("Added run-of-show segment cue", { tone: "ok" });
        }
      },
        h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-seg-ts" }, "Time"), segTsIn),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-seg-title" }, "Segment"), segTitleIn),
        h("div", { class: "field", style: "flex:1;" }, h("label", { class: "field-label", for: "pod-seg-cue" }, "Cue Note"), segCueIn),
        h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Cue")
      )
    )
  );

  // --- COLUMN 2: MULTI-PLATFORM LIVE SIMULCAST & AUDIO CONSOLE ---
  const destinations = liveCfg.destinations ?? [];
  const enabledDests = destinations.filter((d) => d.enabled);
  const totalViewers = liveCfg.isLive ? enabledDests.reduce((sum, d) => sum + (d.viewers || 0), 0) : 0;
  const scenes = ["2-Shot Host + Guest (4K)", "Solo Script Teleprompter", "Screen Share + Pipeline", "Intro Bumper"];

  const simulcastCol = createToolCard(
    "2. Multi-Platform Podcast Live Stream",
    liveCfg.isLive ? `LIVE ON ${enabledDests.length} PLATFORMS` : `${enabledDests.length}/${destinations.length} Armed`,
    liveCfg.isLive ? "ok" : "info",
    h("div", { class: "feed-row" },
      h("div", { class: "feed-row-main" },
        h("strong", { style: "font-size:var(--text-xs);" }, liveCfg.isLive ? `Simulcasting · ${formatNumber(totalViewers)} live viewers` : "Simulcast RTMP / WebRTC Relay Standby"),
        h("span", { class: "mono-meta" }, liveCfg.isLive ? `Started ${liveCfg.startedAt || "Now"} · Scene: ${liveCfg.activeScene}` : `Active Scene: ${liveCfg.activeScene} · Audio -16 LUFS`)
      ),
      createStatusPill(liveCfg.isLive ? "ON AIR" : "STANDBY", liveCfg.isLive ? "ok" : "warn")
    ),
    h("div", { style: "display:flex;flex-direction:column;gap:0.4rem;" },
      h("strong", { style: "font-size:var(--text-xs);" }, "Simulcast Destinations (Toggle Live Platforms)"),
      ...destinations.map((dest) => {
        const chk = h("input", {
          type: "checkbox",
          switch: "",
          checked: Boolean(dest.enabled),
          "aria-label": `Stream live to ${dest.platform}`,
          onChange: () => {
            togglePodcastLivePlatform(dest.id);
            showToast(`${dest.platform} ${!dest.enabled ? "armed" : "muted"} for podcast simulcast`, { tone: "info" });
          }
        });
        return h("div", { class: "feed-row" },
          h("div", { class: "feed-row-main" },
            h("strong", { style: "font-size:var(--text-xs);" }, dest.platform),
            h("span", { class: "mono-meta" }, `${dest.endpoint} · ${dest.status}${liveCfg.isLive && dest.enabled ? ` · ${formatNumber(dest.viewers)} watching` : ""}`)
          ),
          h("div", { style: "display:flex;align-items:center;gap:0.45rem;" },
            createStatusPill(liveCfg.isLive && dest.enabled ? "LIVE" : dest.enabled ? "Armed" : "Off", liveCfg.isLive && dest.enabled ? "ok" : dest.enabled ? "info" : "warn"),
            h("label", { class: "switch-label" }, chk)
          )
        );
      })
    ),
    h("div", { style: "display:flex;flex-direction:column;gap:0.35rem;" },
      h("span", { class: "field-label" }, "Broadcast Scene Switcher"),
      h("div", { class: "filter-bar", role: "group", "aria-label": "Podcast broadcast scenes" },
        ...scenes.map((sc) =>
          h("button", {
            type: "button",
            class: "filter-pill",
            "aria-pressed": String(liveCfg.activeScene === sc),
            onClick: () => {
              setPodcastLiveScene(sc);
              showToast(`Switched live podcast scene → ${sc}`, { tone: "info" });
            }
          }, sc)
        )
      )
    ),
    h("div", { style: "display:flex;flex-direction:column;gap:0.45rem;" },
      h("strong", { style: "font-size:var(--text-xs);" }, "Simulcast Audio Mix (LUFS Safe)"),
      createFaderControl({
        id: "pod-mic-gain",
        label: "Host Shure SM7B Gain",
        min: 0,
        max: 100,
        value: liveCfg.micGain ?? 84,
        unit: "%",
        onInput: (v) => updatePodcastAudioMix({ micGain: v })
      }),
      createFaderControl({
        id: "pod-guest-gain",
        label: "Remote Guest WebRTC Feed",
        min: 0,
        max: 100,
        value: liveCfg.guestGain ?? 78,
        unit: "%",
        onInput: (v) => updatePodcastAudioMix({ guestGain: v })
      }),
      createFaderControl({
        id: "pod-sfx-gain",
        label: "Intro Bumper & Soundboard",
        min: 0,
        max: 100,
        value: liveCfg.soundboardLevel ?? 62,
        unit: "%",
        onInput: (v) => updatePodcastAudioMix({ soundboardLevel: v })
      })
    ),
    h("button", {
      type: "button",
      class: liveCfg.isLive ? "btn btn--subtle" : "btn btn--primary",
      onClick: () => {
        const res = togglePodcastSimulcastLive({
          episodeTitle: titleIn.value.trim() || scriptData.episodeTitle,
          channelId: channelSel.value
        });
        if (res.isLive) {
          showToast(`LIVE SIMULCAST STARTED across ${res.activeDestinations.map((d) => d.platform).join(", ")} (+45m logged)`, { tone: "ok" });
        } else {
          showToast("Ended multi-platform podcast live stream & archived replay", { tone: "info" });
        }
      }
    }, liveCfg.isLive ? "End Multi-Platform Live Broadcast" : `Go Live on ${Math.max(1, enabledDests.length)} Social Platforms →`)
  );

  // --- COLUMN 3: CHAPTER MARKERS & WHISPERX SHORT CLIP EXTRACTOR ---
  const chapTsIn = h("input", { id: "pod-ch-ts", class: "input input--mono", type: "text", value: "48:30", style: "max-inline-size:90px;" });
  const chapLblIn = h("input", { id: "pod-ch-lbl", class: "input", type: "text", placeholder: "New chapter marker..." });

  const transcriptLines = ep?.transcript ?? [];
  const chosenLine = transcriptLines[selectedTranscriptIdx] ?? transcriptLines[0];
  const clipChanSel = h(
    "select",
    { id: "pod-clip-chan", class: "select" },
    h("option", { value: "YouTube Shorts" }, "YouTube Shorts (9:16)"),
    h("option", { value: "X" }, "X / Twitter Vertical Clip (9:16)"),
    h("option", { value: "Instagram" }, "Instagram Reel (9:16)"),
    h("option", { value: "LinkedIn" }, "LinkedIn Native Clip (1:1)")
  );

  const liveClipperCol = createToolCard(
    "3. Live Chapter Logger & WhisperX Clipper",
    `${chapters.length} Chapters · ${transcriptLines.length} Clips`,
    "ok",
    h("div", { class: "feed-row" },
      h("div", { class: "feed-row-main" },
        h("strong", { style: "font-size:var(--text-xs);" }, ep?.title ?? "Latest Recorded Episode"),
        h("span", { class: "mono-meta" }, ep?.rssStatus ?? "Castopod RSS 2.0")
      ),
      createStatusPill("-16 LUFS Ready", "ok")
    ),
    h("ul", { class: "feed-list" },
      ...chapters.map((ch) =>
        h("li", { class: "feed-row" }, h("span", { class: "mono-meta" }, ch.ts), h("span", { style: "font-size:var(--text-xs);font-weight:600;" }, ch.title))
      )
    ),
    h("form", {
      style: "display:flex;gap:0.45rem;align-items:end;",
      onSubmit: (e) => {
        e.preventDefault();
        if (!chapLblIn.value.trim()) return;
        chapters = [...chapters, { ts: chapTsIn.value.trim() || "50:00", title: chapLblIn.value.trim() }];
        showToast("Added live podcast chapter marker", { tone: "ok" });
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "pod-ch-ts" }, "Time"), chapTsIn),
      h("div", { class: "field", style: "flex:1;" }, h("label", { class: "field-label", for: "pod-ch-lbl" }, "Chapter Title"), chapLblIn),
      h("button", { type: "submit", class: "btn btn--subtle btn--sm" }, "+ Marker")
    ),
    h("div", { style: "border-block-start:1px solid var(--border-subtle);padding-block-start:0.65rem;display:flex;flex-direction:column;gap:0.45rem;" },
      h("strong", { style: "font-size:var(--text-xs);" }, "WhisperX Transcript → Short Clip Extractor"),
      h("div", { class: "transcript-box", tabindex: "0", role: "region", "aria-label": "Select transcript quote to clip" },
        ...transcriptLines.map((row, idx) =>
          h("button", {
            type: "button",
            class: "pipeline-card",
            style: idx === selectedTranscriptIdx ? "border-color:var(--accent);background:var(--accent-soft);padding:0.5rem;" : "padding:0.5rem;",
            onClick: () => {
              selectedTranscriptIdx = idx;
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
            h("span", { class: "mono-meta" }, `[${row.ts}] ${row.speaker}`),
            h("span", { style: "font-size:var(--text-xs);" }, row.line)
          )
        )
      ),
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:end;" },
        h("div", { class: "field", style: "flex:1;" }, h("label", { class: "field-label", for: "pod-clip-chan" }, "Destination Clip Channel"), clipChanSel),
        h("button", {
          type: "button",
          class: "btn btn--primary",
          onClick: () => {
            if (!chosenLine) return;
            logWorkbenchAction({
              title: `Clipped ${ep?.title?.slice(0, 22) || "Podcast"} [${chosenLine.ts}] → ${clipChanSel.value}`,
              scenario: "podcast",
              minutes: 20,
              tool: "WhisperX Clip Extractor",
              addToSocial: {
                platform: clipChanSel.value,
                title: `${chosenLine.speaker} — Ep. ${ep?.episodeNumber ?? 92} Highlight`,
                caption: `"${chosenLine.line}" Full episode + live replay via Castopod RSS.`,
                scheduledFor: "Tomorrow · 09:00 EST",
                trackingUrl: `https://${workspace.shortDomain}/ep${ep?.episodeNumber ?? 92}?utm_source=clip`,
                mediaLabel: `0:52 Vertical Waveform [${chosenLine.ts}]`,
                mediaBadge: "WhisperX Auto-Subtitles"
              }
            });
            showToast(`Cut vertical clip [${chosenLine.ts}] -> ${clipChanSel.value} (+20m logged)`, { tone: "ok" });
          }
        }, "Cut & Queue Vertical Clip →")
      )
    )
  );

  const sources = snap.workbenchData?.researchSources ?? [];
  const sourceCard = createSourceGatheringCard({
    idPrefix: "pod-src",
    title: "Online Research & Show-Note Sources",
    sources,
    selectedId: selectedSourceId,
    onSelect: (id) => {
      selectedSourceId = id;
    },
    citeLabel: "Insert Source Quote → Script",
    onCite: (src) => {
      insertScriptCueHtml(
        `<blockquote><p><strong>[SOURCE · ${src.domain}]</strong> ${src.title} — ${src.summary || src.body}</p></blockquote>`,
        `Cited source "${src.title}" inside Podcast Script.`
      );
      showToast(`Inserted "${src.title}" into podcast script`, { tone: "ok" });
    }
  });

  return createStudioTabs({
    ariaLabel: "Podcast studio workspace tabs",
    initialTab: "editor",
    sourcesNode: sourceCard,
    brainstormNode: createBrainstormPane({
      idPrefix: "pod-br",
      scenarioLabel: "Podcast",
      onInsertToEditor: (n) => {
        insertScriptCueHtml(`<blockquote><p><strong>[${n.tag}]</strong> ${n.text}</p></blockquote>`, "Inserted brainstorm idea into Podcast Script.");
        showToast("Inserted brainstorm idea into Podcast Script", { tone: "ok" });
      }
    }),
    editorNode: h("div", { class: "studio-3col" }, scriptCol, simulcastCol, liveClipperCol),
    whiteboardNode: createWhiteboardPane({
      idPrefix: "pod-wb",
      scenarioId: "podcast",
      onSendToEditor: (it) => {
        insertScriptCueHtml(`<blockquote><p><strong>[${it.authorName}]</strong> ${it.text}</p></blockquote>`, "Inserted whiteboard note into Podcast Script.");
        showToast("Inserted whiteboard note into Podcast Script", { tone: "ok" });
      }
    })
  });
}
