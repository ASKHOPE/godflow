import { createStatusPill, h } from "../lib/dom.js";
import { getState, logWorkbenchAction } from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import {
  createBrainstormPane,
  createSourceGatheringCard,
  createStudioTabs,
  createToolCard,
  createWhiteboardPane
} from "../lib/workbench-helpers.js";

let stems = [
  { id: "st-1", name: "Lead Vocal (Ribbon)", gain: 84, muted: false, solo: false },
  { id: "st-2", name: "Chorus Harmony Double", gain: 66, muted: false, solo: false },
  { id: "st-3", name: "Hollowbody Acoustic", gain: 74, muted: false, solo: false },
  { id: "st-4", name: "Prophet-6 Analog Pad", gain: 58, muted: false, solo: false },
  { id: "st-5", name: "Studio Room Condenser", gain: 42, muted: true, solo: false }
];
let metronomeOn = false;
let selectedSourceId = null;
let draftLyrics = `[Verse 1]\nBlue glow on the monitor glass, 4 AM on the tape\nEvery chord hanging cleanly in the studio space\n\n[Chorus]\nNeon static on the studio wall\nLeave the red light burning till the shadows fall`;

export function renderMusicStudio() {
  const snap = getState();
  const sources = snap.workbenchData?.researchSources ?? [];
  if (!selectedSourceId || !sources.some((s) => s.id === selectedSourceId)) {
    selectedSourceId = sources[0]?.id ?? null;
  }

  const sourcesCol = createSourceGatheringCard({
    idPrefix: "mus-src",
    title: "1. Chord, Lyric & Mix Reference Gathering",
    sources,
    selectedId: selectedSourceId,
    onSelect: (id) => {
      selectedSourceId = id;
    },
    citeLabel: "Cite Reference → Lyrics / Notes",
    onCite: (src) => {
      draftLyrics = `${draftLyrics}\n\n[Reference: ${src.title} (${src.domain})]\n${src.summary}`;
      showToast(`Clipped "${src.domain}" reference to Lyrics Pad`, { tone: "ok" });
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  });

  const stemPane = createToolCard(
    "2. Multi-Track Vocal & Stem Mixer",
    "24-bit / 48kHz",
    "warn",
    h(
      "div",
      { style: "display:flex;justify-content:space-between;align-items:center;gap:0.5rem;" },
      h("span", { class: "mono-meta" }, "Key: F# Minor · 94 BPM · -14 LUFS Master Bus"),
      h(
        "button",
        {
          type: "button",
          class: "filter-pill",
          "aria-pressed": String(metronomeOn),
          onClick: () => {
            metronomeOn = !metronomeOn;
            window.dispatchEvent(new CustomEvent("godflow:rerender"));
          }
        },
        metronomeOn ? "Click: ON (94 BPM)" : "Click: OFF"
      )
    ),
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:0.45rem;" },
      ...stems.map((st) =>
        h(
          "div",
          { class: "mixer-lane" },
          h("strong", { style: "font-size:var(--text-xs);" }, st.name),
          h("button", { type: "button", class: "filter-pill", "aria-pressed": String(st.muted), onClick: () => { st.muted = !st.muted; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "M"),
          h("button", { type: "button", class: "filter-pill", "aria-pressed": String(st.solo), onClick: () => { st.solo = !st.solo; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "S"),
          h("input", {
            type: "range",
            min: "0",
            max: "100",
            value: String(st.gain),
            "aria-label": `${st.name} fader level`,
            onInput: (e) => {
              st.gain = Number(e.target.value);
            }
          }),
          h("span", { class: "mono-meta" }, `${st.gain}%`)
        )
      )
    )
  );

  const lyricsArea = h("textarea", {
    id: "mus-lyrics",
    class: "textarea",
    style: "min-block-size:210px;",
    onInput: (e) => {
      draftLyrics = e.target.value;
    }
  });
  lyricsArea.value = draftLyrics;

  const lyricsPane = createToolCard(
    "3. Singing Lyrics Editor & R2 FLAC Bounce",
    "Master Ready",
    "ok",
    h("div", { class: "field" }, h("label", { class: "field-label", for: "mus-lyrics" }, "Vocal Take Lyrics, Notes & References"), lyricsArea),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
      createStatusPill("ISRC US-GF2-26-00419", "info"),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary",
          onClick: () => {
            logWorkbenchAction({
              title: "Bounced 24-bit FLAC Vocal Master + Lyrics",
              scenario: "music",
              minutes: 45,
              tool: "Logic Pro → Cloudflare R2"
            });
            showToast("Bounced lossless FLAC master to R2 (+45m studio time logged)", { tone: "ok" });
          }
        },
        "Bounce 24-bit FLAC → R2"
      )
    )
  );

  return createStudioTabs({
    ariaLabel: "Music studio workspace tabs",
    initialTab: "editor",
    sourcesNode: sourcesCol,
    brainstormNode: createBrainstormPane({
      idPrefix: "mus-br",
      scenarioLabel: "Music",
      onInsertToEditor: (n) => {
        draftLyrics = `${draftLyrics}\n\n[${n.tag}] ${n.text}`;
        showToast("Inserted idea into Lyrics Pad", { tone: "ok" });
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    }),
    editorNode: h("div", { class: "grid-2" }, stemPane, lyricsPane),
    whiteboardNode: createWhiteboardPane({ idPrefix: "mus-wb", scenarioId: "music" })
  });
}
