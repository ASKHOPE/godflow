import { createStatusPill, h } from "../lib/dom.js";
import { getActiveContext, getState, logWorkbenchAction } from "../lib/store.js";
import { showToast } from "../lib/toast.js";
import { createFaderControl, createToolCard } from "../lib/workbench-helpers.js";

let gameTitle = "Elden Ring: Shadow of the Erdtree";
let attempts = 14;
let micLevel = 82;
let gameLevel = 68;
let discordLevel = 55;

export function renderGamingStudio() {
  const { workspace } = getActiveContext(getState());

  const gameSel = h(
    "select",
    {
      id: "gm-game",
      class: "select",
      onChange: (e) => {
        gameTitle = e.target.value;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
    h("option", { value: "Elden Ring: Shadow of the Erdtree", selected: gameTitle.includes("Elden") }, "Elden Ring: Shadow of the Erdtree"),
    h("option", { value: "Path of Exile 2", selected: gameTitle.includes("Exile") }, "Path of Exile 2"),
    h("option", { value: "Hades II", selected: gameTitle.includes("Hades") }, "Hades II")
  );

  const overlayPane = createToolCard(
    "1. Gaming OBS Overlay & Replay Clip Trigger",
    `Attempts: ${attempts}`,
    "info",
    h("div", { class: "field" }, h("label", { class: "field-label", for: "gm-game" }, "Active Game Profile"), gameSel),
    h(
      "div",
      { class: "feed-row" },
      h("div", { class: "feed-row-main" }, h("strong", {}, gameTitle), h("span", { class: "mono-meta" }, "Dual-PC NDI 1440p60 · Replay Buffer: 90s rolling")),
      createStatusPill(`Run #${attempts}`, "warn")
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.5rem;" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => { attempts += 1; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "+1 Boss Attempt"),
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => { attempts = 0; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Reset Counter"),
      h(
        "button",
        {
          type: "button",
          class: "btn btn--primary",
          onClick: () => {
            logWorkbenchAction({
              title: `${gameTitle} Highlight Clip #${attempts}`,
              scenario: "gaming",
              minutes: 25,
              tool: "Dual-PC OBS Replay Buffer",
              addToSocial: {
                platform: "YouTube Shorts",
                title: `${gameTitle} Attempt #${attempts} Highlight`,
                caption: `No-hit attempt #${attempts} clipped straight from tonight's stream.`,
                scheduledFor: "Tomorrow · 13:00 EST",
                trackingUrl: `https://${workspace.shortDomain}/gear?utm_source=youtube&utm_medium=gaming-short`,
                mediaLabel: "9:16 Clip · 00:45 · 60fps",
                mediaBadge: "OBS Replay Marker"
              }
            });
            showToast("Saved 45s replay buffer & queued YT Short (+25m tracked)", { tone: "ok" });
          }
        },
        "Drop 45s Replay Clip → Shorts"
      )
    )
  );

  const mixerPane = createToolCard(
    "2. Dual-PC Multi-Track Audio Mixer",
    "3 Tracks Isolated",
    "ok",
    createFaderControl({ id: "gm-mic", label: "PodMic USB (Track 1)", min: 0, max: 100, value: micLevel, unit: "%", onInput: (v) => { micLevel = v; } }),
    createFaderControl({ id: "gm-audio", label: "Game Audio NDI (Track 2)", min: 0, max: 100, value: gameLevel, unit: "%", onInput: (v) => { gameLevel = v; } }),
    createFaderControl({ id: "gm-disc", label: "Discord Squad (Track 3)", min: 0, max: 100, value: discordLevel, unit: "%", onInput: (v) => { discordLevel = v; } }),
    h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, "Isolated tracks write to MKV multitrack recording so copyright music or squad chatter never ruins clip exports.")
  );

  return h("div", { class: "split-pane" }, overlayPane, mixerPane);
}
