import { createStatusPill, h } from "../lib/dom.js";
import { getActiveContext, getState, logWorkbenchAction, saveVideoProject } from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import {
  createBrainstormPane,
  createFaderControl,
  createSourceGatheringCard,
  createStudioTabs,
  createToolCard,
  createWhiteboardPane
} from "../lib/workbench-helpers.js";

let selectedSourceId = null;

export function renderVideoStudio() {
  const snap = getState();
  const ctx = getActiveContext(snap);
  const wb = snap.workbenchData;
  const vs = wb.videoStudio ?? {
    mode: "long",
    title: "How One Multi-Tenant Studio Powers Every Format",
    channelId: ctx.channels[0]?.id || "",
    hookLine: "00:00–00:04 Hook: Show final workflow result before explaining setup",
    script: "## Hook (0:00-0:15)\nStart with the finished publish flow across Website + YouTube.\n\n## Walkthrough (0:15-4:30)\nShow Research Sources -> Script -> B-Roll -> Export.",
    srtCaptions: "1\n00:00:00,000 --> 00:00:03,200\nHere is how we turn one research brief into 16:9 videos and 9:16 Shorts.\n\n2\n00:00:03,200 --> 00:00:07,000\nFirst gather verified links on the left desk, then cut cleanly for each feed.",
    aspect: "16:9",
    fps: 60,
    durationSec: 420
  };

  const sources = wb.researchSources ?? [];
  if (!selectedSourceId || !sources.some((s) => s.id === selectedSourceId)) {
    selectedSourceId = sources[0]?.id ?? null;
  }

  // Column 1: Reference Sources & B-Roll Gathering (shared helper)
  const sourcesCol = createSourceGatheringCard({
    idPrefix: "vid-src",
    title: "1. Video Sources, Links & B-Roll Gathering",
    sources,
    selectedId: selectedSourceId,
    onSelect: (id) => {
      selectedSourceId = id;
    },
    citeLabel: "Cite Source into Video Script",
    onCite: (src) => {
      const updated = `${vs.script || ""}\n\n[Source: ${src.title} (${src.domain})]\n- Key stat: ${src.summary}`;
      saveVideoProject({ ...vs, script: updated });
      showToast(`Inserted "${src.domain}" reference into Video Script`, { tone: "ok" });
    }
  });

  // Column 2: Format Mode (Normal Long 16:9 vs Vertical Shorts/Reels 9:16) + Script + SRT Captions
  const isShort = vs.mode === "short";
  const titleIn = h("input", { id: "vid-title", class: "input", type: "text", value: vs.title });
  const channelSel = h(
    "select",
    { id: "vid-channel", class: "select" },
    ...ctx.channels.map((c) => h("option", { value: c.id, selected: c.id === vs.channelId }, `${c.name} (${c.domain})`))
  );
  const hookIn = h("input", { id: "vid-hook", class: "input", type: "text", value: vs.hookLine || "" });

  const scriptArea = h("textarea", {
    id: "vid-script",
    class: "textarea",
    style: "min-block-size:170px;"
  });
  scriptArea.value = vs.script || "";

  const srtArea = h("textarea", {
    id: "vid-srt",
    class: "textarea input--mono",
    style: "min-block-size:120px;font-size:var(--text-xs);"
  });
  srtArea.value = vs.srtCaptions || "";

  const collectFormValues = () => ({
    mode: vs.mode,
    title: titleIn.value.trim() || "Untitled Video Project",
    channelId: channelSel.value,
    hookLine: hookIn.value.trim(),
    script: scriptArea.value,
    srtCaptions: srtArea.value,
    aspect: isShort ? "9:16" : vs.aspect || "16:9",
    fps: vs.fps || 60,
    durationSec: isShort ? Math.min(60, Number(vs.durationSec) || 48) : Math.max(90, Number(vs.durationSec) || 420)
  });

  const scriptCol = createToolCard(
    "2. Video / Shorts Script & Captions Editor",
    isShort ? "9:16 SHORT (≤60s)" : "16:9 FULL VIDEO",
    isShort ? "warn" : "ok",
    h(
      "div",
      { class: "filter-bar", role: "group", "aria-label": "Choose Normal Video or Vertical Shorts mode" },
      h(
        "button",
        {
          type: "button",
          class: "filter-pill",
          "aria-pressed": String(!isShort),
          onClick: () => {
            saveVideoProject({ ...collectFormValues(), mode: "long", aspect: "16:9", durationSec: 480 });
            showToast("Switched to Normal Video (16:9 Long-Form)", { tone: "info" });
          }
        },
        "Normal Video (16:9 Full)"
      ),
      h(
        "button",
        {
          type: "button",
          class: "filter-pill",
          "aria-pressed": String(isShort),
          onClick: () => {
            saveVideoProject({ ...collectFormValues(), mode: "short", aspect: "9:16", durationSec: 45 });
            showToast("Switched to Shorts / Reels (9:16 Vertical)", { tone: "info" });
          }
        },
        "Short / Reel (9:16 ≤60s)"
      )
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "vid-title" }, "Video / Short Title"), titleIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "vid-channel" }, "Publish Channel"), channelSel)
    ),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "vid-hook" }, "Opening 3-Second Visual & Audio Hook"), hookIn),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "vid-script" }, isShort ? "60s Beat Sheet & Script" : "Chapters, Voiceover & Shot-List Script"), scriptArea),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "vid-srt" }, "Subtitles / Burned-In SRT Captions"), srtArea),
    h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
      h("button", {
        type: "button",
        class: "btn btn--subtle",
        onClick: () => {
          saveVideoProject(collectFormValues());
          showToast("Saved Video / Shorts script to SQLite", { tone: "ok" });
        }
      }, "Save Script Draft"),
      h("button", {
        type: "button",
        class: "btn btn--primary",
        onClick: () => {
          const v = collectFormValues();
          saveVideoProject({ ...v, publishToHub: true });
          showToast(`Saved & staged ${isShort ? "Vertical Short" : "16:9 Full Video"} cleanly`, { tone: "ok" });
        }
      }, "Save & Stage Cut →")
    )
  );

  // Column 3: Timeline Specs, Aspect Export & Distribution
  const targetDestSel = h(
    "select",
    { id: "vid-dest", class: "select" },
    ...(isShort
      ? [
          h("option", { value: "YouTube Shorts" }, "YouTube Shorts (9:16 Vertical)"),
          h("option", { value: "Instagram Reels" }, "Instagram Reels (9:16)"),
          h("option", { value: "TikTok" }, "TikTok Vertical"),
          h("option", { value: "X" }, "X / Twitter Vertical Video")
        ]
      : [
          h("option", { value: "YouTube" }, "YouTube Main (4K 16:9)"),
          h("option", { value: "Website Video Hub" }, "Channel Website Video Player"),
          h("option", { value: "X" }, "X Long-Form Video"),
          h("option", { value: "LinkedIn" }, "LinkedIn Native 16:9")
        ])
  );

  const exportCol = createToolCard(
    "3. Timeline Export, Aspect Crop & Publish",
    isShort ? "1080×1920 Vertical" : "3840×2160 4K",
    "info",
    h("div", { class: "feed-row" },
      h("div", { class: "feed-row-main" },
        h("strong", { style: "font-size:var(--text-xs);" }, isShort ? "Vertical Short Timeline" : "Long-Form Master Timeline"),
        h("span", { class: "mono-meta" }, `${vs.aspect || (isShort ? "9:16" : "16:9")} · ${vs.fps || 60}fps · Target ${Math.round((vs.durationSec || 420))}s · -14 LUFS`)
      ),
      createStatusPill(isShort ? "SHORTS READY" : "4K MASTER", "ok")
    ),
    createFaderControl({
      id: "vid-dur-slider",
      label: isShort ? "Short Cut Duration (sec)" : "Main Video Target Length (sec)",
      min: isShort ? 15 : 120,
      max: isShort ? 60 : 1800,
      value: isShort ? Math.min(60, vs.durationSec || 45) : Math.max(120, vs.durationSec || 420),
      unit: "s",
      onInput: (val) => saveVideoProject({ ...collectFormValues(), durationSec: val })
    }),
    h("div", { class: "field" }, h("label", { class: "field-label", for: "vid-dest" }, "Export & Distribution Target"), targetDestSel),
    h("button", {
      type: "button",
      class: "btn btn--primary",
      onClick: () => {
        const v = collectFormValues();
        saveVideoProject({ ...v, publishToHub: true });
        logWorkbenchAction({
          title: `${isShort ? "Exported Short" : "Rendered Video"}: ${v.title}`,
          scenario: "video",
          minutes: isShort ? 25 : 55,
          tool: isShort ? "Vertical 9:16 Shorts Editor" : "4K Video Timeline + Resolve",
          addToSocial: {
            platform: targetDestSel.value,
            title: v.title,
            caption: `${v.hookLine} — Watch full release on ${ctx.workspace.domain}.`,
            scheduledFor: isShort ? "Today · 17:00 EST" : "Tomorrow · 11:00 EST",
            trackingUrl: `https://${ctx.workspace.shortDomain}/watch?utm_source=video`,
            mediaLabel: `${v.aspect} · ${v.fps}fps · ${v.durationSec}s`,
            mediaBadge: isShort ? "9:16 Short + SRT" : "16:9 Master Video"
          }
        });
        showToast(`Rendered & queued ${isShort ? "Short" : "Video"} → ${targetDestSel.value}`, { tone: "ok" });
      }
    }, isShort ? "Render 9:16 Short & Queue →" : "Render 16:9 Video & Publish →"),
    h("a", { href: "/studio?scenario=social", class: "btn btn--subtle btn--sm" }, "Open Thumbnail & GIF Maker →")
  );

  return createStudioTabs({
    ariaLabel: "Videos & Shorts studio workspace tabs",
    initialTab: "editor",
    sourcesNode: sourcesCol,
    brainstormNode: createBrainstormPane({
      idPrefix: "vid-br",
      scenarioLabel: "Videos & Shorts",
      onInsertToEditor: (n) => {
        saveVideoProject({ ...vs, script: `${vs.script || ""}\n\n[${n.tag}] ${n.text}` });
        showToast("Inserted brainstorm idea into Video Script", { tone: "ok" });
      }
    }),
    editorNode: h("div", { class: "grid-2" }, scriptCol, exportCol),
    whiteboardNode: createWhiteboardPane({
      idPrefix: "vid-wb",
      scenarioId: "video",
      onSendToEditor: (it) => {
        saveVideoProject({ ...vs, script: `${vs.script || ""}\n\n[${it.authorName} · ${it.kind}] ${it.text}` });
        showToast("Inserted whiteboard note into Video Script", { tone: "ok" });
      }
    })
  });
}
