import { SCENARIOS } from "../data/seed.js";
import { openPipelineDrawer } from "../components/drawer.js";
import { createScenarioBadge, createStatusPill, h } from "../lib/dom.js";
import { renderModuleVersionGuard } from "../lib/workbench-helpers.js";
import {
  addWorkEvent,
  can,
  canEditScenario,
  getState,
  getTenantSlice,
  setWatcherSpeed,
  toggleGlobalWatcher,
  toggleUserWatcher
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let calMode = "month"; // "month" | "week" | "day" | "custom" | "watcher"
let anchorDate = "2026-11-25";
let customStart = "2026-11-18";
let customEnd = "2026-11-30";
let scenarioFilter = "all";
let userFilter = "all";

export function formatHms(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec || 0));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatHours(totalSec) {
  return `${((totalSec || 0) / 3600).toFixed(1)}h`;
}

function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso, days) {
  const dt = parseIsoDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIsoDate(dt);
}

function getMondayIso(iso) {
  const dt = parseIsoDate(iso);
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return toIsoDate(dt);
}

function getMonthGridDays(iso) {
  const dt = parseIsoDate(iso);
  const first = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1));
  const firstDow = first.getUTCDay(); // 0=Sun..6=Sat
  const offset = firstDow === 0 ? -6 : 1 - firstDow;
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() + offset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(start);
    cur.setUTCDate(start.getUTCDate() + i);
    days.push({
      iso: toIsoDate(cur),
      dayNum: cur.getUTCDate(),
      inMonth: cur.getUTCMonth() === dt.getUTCMonth()
    });
  }
  return days;
}

function formatMonthTitle(iso) {
  const dt = parseIsoDate(iso);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
}

function formatShortDay(iso) {
  const dt = parseIsoDate(iso);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(dt);
}

export function updateCalendarLiveTimers() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const todayIso = snap.watcherConfig?.referenceToday ?? "2026-11-25";

  // Update per-teammate HH:MM:SS live cells
  for (const w of slice.activeWatchers) {
    for (const el of document.querySelectorAll(`[data-live-user-hms="${w.userId}"]`)) {
      el.textContent = formatHms(w.todaySeconds);
    }
    for (const el of document.querySelectorAll(`[data-live-user-hrs="${w.userId}"]`)) {
      el.textContent = formatHours(w.todaySeconds);
    }
  }

  // Update Today Team Hours KPI
  const totalTodaySec = slice.activeWatchers.reduce((s, w) => s + w.todaySeconds, 0);
  const kpiToday = document.querySelector('[data-live-kpi="today-hours"]');
  if (kpiToday) kpiToday.textContent = formatHms(totalTodaySec);

  const todayEvents = slice.workEvents.filter((e) => e.date === todayIso && e.status === "Live Tracking");
  for (const ev of todayEvents) {
    for (const el of document.querySelectorAll(`[data-live-event-hrs="${ev.id}"]`)) {
      el.textContent = formatHours(ev.trackedSeconds);
    }
  }
}

export function renderMegaCalendar() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, isGodMode } = slice.ctx;
  const todayIso = snap.watcherConfig?.referenceToday ?? "2026-11-25";
  const canLog = can("pipeline:write", snap);

  const filteredEvents = slice.workEvents.filter((ev) => {
    const matchScen = scenarioFilter === "all" || ev.scenario === scenarioFilter;
    const matchUser = userFilter === "all" || ev.userId === userFilter;
    return matchScen && matchUser;
  });

  // Compute active date range for window metrics
  let rangeStart = anchorDate;
  let rangeEnd = anchorDate;
  if (calMode === "month") {
    const dt = parseIsoDate(anchorDate);
    rangeStart = toIsoDate(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1)));
    rangeEnd = toIsoDate(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)));
  } else if (calMode === "week" || calMode === "watcher") {
    rangeStart = getMondayIso(anchorDate);
    rangeEnd = addDaysIso(rangeStart, 6);
  } else if (calMode === "custom") {
    rangeStart = customStart <= customEnd ? customStart : customEnd;
    rangeEnd = customEnd >= customStart ? customEnd : customStart;
  }

  const windowEvents = filteredEvents.filter((ev) => ev.date >= rangeStart && ev.date <= rangeEnd);
  const windowTrackedSeconds = windowEvents.reduce(
    (s, ev) => s + (ev.trackedSeconds || Math.round((ev.durationHours || 0) * 3600)),
    0
  );
  const totalTodaySec = slice.activeWatchers.reduce((s, w) => s + w.todaySeconds, 0);
  const runningCount = slice.activeWatchers.filter((w) => w.running).length;

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Mega Calendar & Auto Work-Watcher"),
      h("p", { class: "page-subtitle" }, `Unified schedule & automatic teammate working-hours tracker (${workspace.name})`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h(
        "button",
        {
          type: "button",
          class: `btn btn--sm ${snap.watcherConfig.enabled ? "btn--primary" : "btn--subtle"}`,
          "aria-pressed": String(snap.watcherConfig.enabled),
          onClick: () => {
            toggleGlobalWatcher();
            showToast(snap.watcherConfig.enabled ? "Auto-Watcher paused" : "Auto-Watcher live", { tone: "info" });
          }
        },
        h("span", { class: `live-dot ${snap.watcherConfig.enabled ? "is-pulsing" : ""}`, "aria-hidden": "true" }),
        snap.watcherConfig.enabled ? "Watcher: LIVE" : "Watcher: PAUSED"
      ),
      h(
        "label",
        { class: "switcher-chip" },
        h("span", { class: "mono-meta" }, "SPEED"),
        h(
          "select",
          {
            class: "switcher-select",
            "aria-label": "Work-watcher time emulation speed",
            onChange: (e) => {
              setWatcherSpeed(e.target.value);
              showToast(`Emulation speed set to ${e.target.value}x`, { tone: "info" });
            }
          },
          ...[
            { val: 1, label: "1x (Real-time)" },
            { val: 60, label: "60x (1m/sec)" },
            { val: 600, label: "600x (10m/sec)" },
            { val: 3600, label: "3600x (1h/sec)" }
          ].map((opt) =>
            h("option", { value: String(opt.val), selected: snap.watcherConfig.speedMultiplier === opt.val }, opt.label)
          )
        )
      )
    )
  );

  // Top 4 Watcher KPI Cards
  const kpis = h(
    "section",
    { class: "grid-kpi", "aria-label": "Work watcher metrics" },
    h(
      "article",
      { class: "card kpi-card" },
      h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Active Watchers Now"), createStatusPill(`${runningCount} / ${slice.activeWatchers.length} Tracking`, "ok")),
      h("div", { class: "kpi-value" }, `${runningCount} Live`),
      h("span", { class: "mono-meta" }, `Auto-detecting OBS, Resolve, Logic & Trilium`)
    ),
    h(
      "article",
      { class: "card kpi-card" },
      h("div", { class: "kpi-top" }, h("span", { class: "kpi-label" }, "Today Team Working Time"), createStatusPill(`${snap.watcherConfig.speedMultiplier}x Emul`, "info")),
      h("div", { class: "kpi-value", dataset: { liveKpi: "today-hours" } }, formatHms(totalTodaySec)),
      h("span", { class: "mono-meta" }, `Auto-accumulated across ${slice.activeWatchers.length} teammates`)
    ),
    h(
      "article",
      { class: "card kpi-card" },
      h("span", { class: "kpi-label" }, "Window Actual Hours"),
      h("div", { class: "kpi-value" }, formatHours(windowTrackedSeconds)),
      h("span", { class: "mono-meta" }, `${rangeStart} → ${rangeEnd} (${windowEvents.length} blocks)`)
    ),
    h(
      "article",
      { class: "card kpi-card" },
      h("span", { class: "kpi-label" }, "Scheduled Upcoming"),
      h("div", { class: "kpi-value" }, String(windowEvents.filter((e) => e.status === "Scheduled").length)),
      h("span", { class: "mono-meta" }, "Streams, drops, newsletters & posts")
    )
  );

  // Toolbar: View Switcher + Date Nav + Custom Dates + Scenario/User Filter
  const modeButtons = [
    { id: "month", label: "Monthly" },
    { id: "week", label: "Weekly" },
    { id: "day", label: "Daily" },
    { id: "custom", label: "Custom Dates" },
    { id: "watcher", label: "Mega Watcher" }
  ];

  function shiftDate(dir) {
    if (calMode === "month") {
      const dt = parseIsoDate(anchorDate);
      dt.setUTCMonth(dt.getUTCMonth() + dir);
      anchorDate = toIsoDate(dt);
    } else if (calMode === "week" || calMode === "watcher") {
      anchorDate = addDaysIso(anchorDate, dir * 7);
    } else {
      anchorDate = addDaysIso(anchorDate, dir);
    }
    window.dispatchEvent(new CustomEvent("godflow:rerender"));
  }

  const periodLabel =
    calMode === "month"
      ? formatMonthTitle(anchorDate)
      : calMode === "week" || calMode === "watcher"
      ? `Week of ${formatShortDay(rangeStart)} – ${formatShortDay(rangeEnd)}`
      : calMode === "day"
      ? formatShortDay(anchorDate)
      : `${rangeStart} → ${rangeEnd}`;

  const fromIn = h("input", {
    id: "cal-from",
    class: "input input--mono",
    type: "date",
    value: customStart,
    style: "inline-size:150px;",
    onChange: (e) => {
      customStart = e.target.value || customStart;
      calMode = "custom";
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  });
  const toIn = h("input", {
    id: "cal-to",
    class: "input input--mono",
    type: "date",
    value: customEnd,
    style: "inline-size:150px;",
    onChange: (e) => {
      customEnd = e.target.value || customEnd;
      calMode = "custom";
      window.dispatchEvent(new CustomEvent("godflow:rerender"));
    }
  });

  const userSel = h(
    "select",
    {
      id: "cal-user-filter",
      class: "select",
      style: "max-inline-size:200px;",
      "aria-label": "Filter calendar by teammate",
      onChange: (e) => {
        userFilter = e.target.value;
        window.dispatchEvent(new CustomEvent("godflow:rerender"));
      }
    },
    h("option", { value: "all", selected: userFilter === "all" }, "All Teammates"),
    ...slice.teamMembers.map((u) => h("option", { value: u.id, selected: u.id === userFilter }, u.name))
  );

  const toolbarCard = h(
    "section",
    { class: "card", style: "gap:0.75rem;" },
    h(
      "div",
      { class: "cal-toolbar" },
      h(
        "div",
        { class: "filter-bar", role: "group", "aria-label": "Calendar view mode" },
        ...modeButtons.map((m) =>
          h(
            "button",
            {
              type: "button",
              class: "filter-pill",
              "aria-pressed": String(calMode === m.id),
              onClick: () => {
                calMode = m.id;
                window.dispatchEvent(new CustomEvent("godflow:rerender"));
              }
            },
            m.label
          )
        )
      ),
      h(
        "div",
        { style: "display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;" },
        h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => shiftDate(-1) }, "← Prev"),
        h("strong", { class: "mono", style: "font-size:var(--text-sm);padding-inline:0.35rem;" }, periodLabel),
        h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { anchorDate = todayIso; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Today"),
        h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => shiftDate(1) }, "Next →")
      )
    ),
    h(
      "div",
      { class: "cal-toolbar" },
      h(
        "div",
        { class: "cal-custom-range" },
        h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-from" }, "Custom From"), fromIn),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-to" }, "Custom To"), toIn),
        h(
          "button",
          {
            type: "button",
            class: "btn btn--subtle btn--sm",
            onClick: () => {
              customStart = "2026-11-17";
              customEnd = "2026-11-29";
              calMode = "custom";
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          "Nov Sprint"
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn--subtle btn--sm",
            onClick: () => {
              customStart = todayIso;
              customEnd = addDaysIso(todayIso, 6);
              calMode = "custom";
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          "Next 7 Days"
        )
      ),
      h(
        "div",
        { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;" },
        userSel
      )
    ),
    h(
      "div",
      { class: "filter-bar", role: "group", "aria-label": "Filter calendar by 6 scenarios" },
      h(
        "button",
        {
          type: "button",
          class: "filter-pill",
          "aria-pressed": String(scenarioFilter === "all"),
          onClick: () => {
            scenarioFilter = "all";
            window.dispatchEvent(new CustomEvent("godflow:rerender"));
          }
        },
        "All Scenarios"
      ),
      ...SCENARIOS.map((sc) =>
        h(
          "button",
          {
            type: "button",
            class: "filter-pill",
            "aria-pressed": String(scenarioFilter === sc.id),
            onClick: () => {
              scenarioFilter = sc.id;
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          sc.short
        )
      )
    )
  );

  // Quick Inline Work Logger (emulates manual log override or new scheduled block)
  const logTitleIn = h("input", { id: "cal-log-title", class: "input", type: "text", required: true, disabled: !canLog, placeholder: "Log work session or schedule stream/edit block..." });
  const logScenIn = h("select", { id: "cal-log-scen", class: "select", disabled: !canLog }, ...SCENARIOS.map((s) => h("option", { value: s.id }, s.short)));
  const logUserIn = h("select", { id: "cal-log-user", class: "select", disabled: !canLog }, ...slice.teamMembers.map((u) => h("option", { value: u.id, selected: u.id === slice.ctx.activeUser.id }, u.name)));
  const logDateIn = h("input", { id: "cal-log-date", class: "input input--mono", type: "date", value: anchorDate, disabled: !canLog });
  const logHrsIn = h("input", { id: "cal-log-hrs", class: "input input--mono", type: "number", step: "0.5", min: "0.5", max: "16", value: "2.0", disabled: !canLog });

  const quickLogCard = h(
    "section",
    { class: "card" },
    h("div", { class: "card-header" }, h("h2", { class: "card-title" }, "Log Work Session / Schedule Calendar Block"), h("span", { class: "mono-meta" }, "Automatically syncs to Teammate Hours Counter")),
    h(
      "form",
      {
        class: "form-grid",
        style: "align-items:end;",
        onSubmit: (e) => {
          e.preventDefault();
          if (!canLog) return;
          const t = logTitleIn.value.trim();
          if (!t) return;
          addWorkEvent({
            title: t,
            scenario: logScenIn.value,
            userId: logUserIn.value,
            date: logDateIn.value,
            startHour: 10,
            durationHours: Number(logHrsIn.value),
            status: logDateIn.value > todayIso ? "Scheduled" : "Completed",
            tool: "GodFlow Tracker"
          });
          logTitleIn.value = "";
          showToast(`Logged ${logHrsIn.value}h block to Mega Calendar`, { tone: "ok" });
        }
      },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-log-title" }, "Task / Stream"), logTitleIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-log-scen" }, "Scenario"), logScenIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-log-user" }, "Teammate"), logUserIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-log-date" }, "Date"), logDateIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "cal-log-hrs" }, "Hours"), logHrsIn),
      h("button", { type: "submit", class: "btn btn--primary", disabled: !canLog }, "Add to Calendar")
    )
  );

  function renderEventChip(ev) {
    const user = snap.users.find((u) => u.id === ev.userId);
    const hrs = ev.trackedSeconds > 0 ? formatHours(ev.trackedSeconds) : `${ev.durationHours}h`;
    return h(
      "button",
      {
        type: "button",
        class: "cal-event-chip",
        dataset: { scenario: ev.scenario },
        onClick: () => {
          if (ev.pipelineId) {
            openPipelineDrawer(ev.pipelineId);
          } else {
            showToast(`${ev.title} · ${user?.name ?? ""} (${hrs} · ${ev.status})`, { tone: "info" });
          }
        }
      },
      h("span", { class: "truncate" }, `${user?.initials ?? "TM"} · ${ev.title}`),
      h("span", { class: "mono-meta", dataset: ev.status === "Live Tracking" ? { liveEventHrs: ev.id } : {} }, hrs)
    );
  }

  // Main Calendar Canvas by Mode
  let calendarViewNode;

  if (calMode === "month") {
    const days = getMonthGridDays(anchorDate);
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const byDate = Object.groupBy(filteredEvents, (e) => e.date);

    calendarViewNode = h(
      "section",
      { class: "cal-month-grid", "aria-label": `Monthly calendar for ${formatMonthTitle(anchorDate)}` },
      ...weekdays.map((wd) => h("div", { class: "cal-weekday-head" }, wd)),
      ...days.map((d) => {
        const dayEvs = byDate[d.iso] ?? [];
        const daySec = dayEvs.reduce((s, e) => s + (e.trackedSeconds || Math.round(e.durationHours * 3600)), 0);
        return h(
          "div",
          { class: `cal-day-cell ${d.inMonth ? "" : "is-outside"} ${d.iso === todayIso ? "is-today" : ""}` },
          h(
            "div",
            { class: "cal-day-top" },
            h(
              "button",
              {
                type: "button",
                class: "cal-day-num",
                "aria-label": `Open daily view for ${d.iso}`,
                onClick: () => {
                  anchorDate = d.iso;
                  calMode = "day";
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              },
              d.iso === todayIso ? `${d.dayNum} · TODAY` : String(d.dayNum)
            ),
            daySec > 0 ? h("span", { class: "mono-meta" }, formatHours(daySec)) : null
          ),
          ...dayEvs.slice(0, 3).map(renderEventChip),
          dayEvs.length > 3
            ? h(
                "button",
                {
                  type: "button",
                  class: "btn btn--ghost btn--sm",
                  style: "min-block-size:22px;padding:0 0.35rem;font-size:0.68rem;",
                  onClick: () => {
                    anchorDate = d.iso;
                    calMode = "day";
                    window.dispatchEvent(new CustomEvent("godflow:rerender"));
                  }
                },
                `+${dayEvs.length - 3} more`
              )
            : null
        );
      })
    );
  } else if (calMode === "week") {
    const monIso = getMondayIso(anchorDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDaysIso(monIso, i));
    const byDate = Object.groupBy(filteredEvents, (e) => e.date);

    calendarViewNode = h(
      "section",
      { class: "cal-week-grid", "aria-label": "Weekly 7-day timeline" },
      ...weekDays.map((iso) => {
        const dayEvs = (byDate[iso] ?? []).toSorted((a, b) => a.startHour - b.startHour);
        const daySec = dayEvs.reduce((s, e) => s + (e.trackedSeconds || Math.round(e.durationHours * 3600)), 0);
        return h(
          "div",
          { class: `cal-week-col ${iso === todayIso ? "is-today" : ""}` },
          h(
            "div",
            { class: "card-header" },
            h(
              "button",
              {
                type: "button",
                class: "cal-day-num",
                onClick: () => {
                  anchorDate = iso;
                  calMode = "day";
                  window.dispatchEvent(new CustomEvent("godflow:rerender"));
                }
              },
              formatShortDay(iso)
            ),
            h("span", { class: "mono-meta" }, formatHours(daySec))
          ),
          ...(dayEvs.length
            ? dayEvs.map((ev) => {
                const user = snap.users.find((u) => u.id === ev.userId);
                return h(
                  "article",
                  { class: "pipeline-card", style: "padding:0.55rem;" },
                  h("div", { style: "display:flex;justify-content:space-between;align-items:center;" }, createScenarioBadge(ev.scenario, SCENARIOS), createStatusPill(ev.status, ev.status === "Live Tracking" ? "ok" : ev.status === "Completed" ? "info" : "warn")),
                  h(
                    "button",
                    {
                      type: "button",
                      style: "border:0;background:none;padding:0;text-align:start;color:inherit;cursor:pointer;font-family:inherit;font-weight:600;font-size:var(--text-xs);",
                      onClick: () => (ev.pipelineId ? openPipelineDrawer(ev.pipelineId) : null)
                    },
                    ev.title
                  ),
                  h("div", { class: "mono-meta" }, `${String(ev.startHour).padStart(2, "0")}:00 · ${user?.name ?? "Studio"} · ${ev.durationHours}h`)
                );
              })
            : [h("p", { class: "page-subtitle", style: "font-size:var(--text-xs);" }, "No blocks logged")])
        );
      })
    );
  } else if (calMode === "day") {
    const dayEvents = filteredEvents.filter((e) => e.date === anchorDate).toSorted((a, b) => a.startHour - b.startHour);
    const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00..22:00

    calendarViewNode = h(
      "section",
      { class: "cal-day-timeline", "aria-label": `Daily schedule for ${anchorDate}` },
      ...hours.map((hr) => {
        const slotEvents = dayEvents.filter((e) => Math.floor(e.startHour) === hr);
        return h(
          "div",
          { class: "cal-hour-row" },
          h("div", { class: "cal-hour-label" }, `${String(hr).padStart(2, "0")}:00`),
          h(
            "div",
            { class: "cal-hour-lane" },
            ...(slotEvents.length
              ? slotEvents.map((ev) => {
                  const user = snap.users.find((u) => u.id === ev.userId);
                  return h(
                    "button",
                    {
                      type: "button",
                      class: "cal-event-chip",
                      style: "inline-size:auto;min-inline-size:240px;padding:0.4rem 0.6rem;",
                      dataset: { scenario: ev.scenario },
                      onClick: () => (ev.pipelineId ? openPipelineDrawer(ev.pipelineId) : null)
                    },
                    h("span", {}, `${user?.name ?? "Team"}: ${ev.title} (${ev.tool})`),
                    createStatusPill(ev.status === "Live Tracking" ? `LIVE ${formatHours(ev.trackedSeconds)}` : `${ev.durationHours}h · ${ev.status}`, ev.status === "Live Tracking" ? "ok" : "info")
                  );
                })
              : [h("span", { class: "mono-meta", style: "opacity:0.4;" }, "—")])
          )
        );
      })
    );
  } else if (calMode === "custom") {
    const sorted = windowEvents.toSorted((a, b) => (a.date + a.startHour).localeCompare(b.date + b.startHour));
    calendarViewNode = h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "custom-range-caption" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { id: "custom-range-caption" }, `Custom Date Range Schedule (${rangeStart} → ${rangeEnd})`),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Date & Time"), h("th", { scope: "col" }, "Teammate"), h("th", { scope: "col" }, "Scenario"), h("th", { scope: "col" }, "Work Item"), h("th", { scope: "col" }, "Tool Detected"), h("th", { scope: "col" }, "Actual Hours"), h("th", { scope: "col" }, "State"))),
        h(
          "tbody",
          {},
          ...(sorted.length
            ? sorted.map((ev) => {
                const user = snap.users.find((u) => u.id === ev.userId);
                return h(
                  "tr",
                  {},
                  h("th", { scope: "row", class: "mono" }, `${ev.date} · ${String(ev.startHour).padStart(2, "0")}:00`),
                  h("td", { dataset: { label: "Teammate" } }, user?.name ?? ev.userId),
                  h("td", { dataset: { label: "Scenario" } }, createScenarioBadge(ev.scenario, SCENARIOS)),
                  h("td", { dataset: { label: "Work" } }, ev.title),
                  h("td", { dataset: { label: "Tool" }, class: "mono-meta" }, ev.tool),
                  h("td", { dataset: ev.status === "Live Tracking" ? { label: "Hours", liveEventHrs: ev.id } : { label: "Hours" }, class: "mono" }, ev.trackedSeconds > 0 ? formatHours(ev.trackedSeconds) : `${ev.durationHours}h (est)`),
                  h("td", { dataset: { label: "State" } }, createStatusPill(ev.status, ev.status === "Live Tracking" ? "ok" : ev.status === "Completed" ? "info" : "warn"))
                );
              })
            : [h("tr", {}, h("td", { colspan: "7", style: "text-align:center;padding:1.25rem;" }, "No events match this custom range & filter."))])
        )
      )
    );
  } else {
    // "watcher" — Teammate Swimlane / Auto Work-Watcher Matrix
    calendarViewNode = h(
      "div",
      { class: "grid-3" },
      ...slice.activeWatchers.map((w) => {
        const user = snap.users.find((u) => u.id === w.userId);
        const userWindowSec = windowEvents
          .filter((ev) => ev.userId === w.userId)
          .reduce((s, ev) => s + (ev.trackedSeconds || 0), 0);
        const targetPct = Math.min(100, Math.round((((userWindowSec + w.todaySeconds) / 3600) / w.weekTargetHours) * 100));

        return h(
          "article",
          { class: "card" },
          h(
            "div",
            { class: "card-header" },
            h(
              "div",
              { style: "display:flex;align-items:center;gap:0.5rem;" },
              h("span", { class: "creator-avatar", style: "margin:0;" }, user?.initials ?? "TM"),
              h("div", {}, h("h3", { class: "card-title", style: "font-size:var(--text-sm);" }, user?.name ?? w.userId), h("span", { class: "mono-meta" }, user?.title ?? ""))
            ),
            createStatusPill(w.running ? "Auto-Tracking" : "Paused", w.running ? "ok" : "warn")
          ),
          createScenarioBadge(w.scenario, SCENARIOS),
          h("div", { style: "font-size:var(--text-xs);font-weight:600;" }, w.taskTitle),
          h("div", { class: "mono-meta" }, `Detected App: ${w.tool}`),
          h(
            "div",
            { class: "feed-row" },
            h("span", { class: "mono-meta" }, "Today Live:"),
            h("strong", { class: "mono", style: "font-size:var(--text-md);", dataset: { liveUserHms: w.userId } }, formatHms(w.todaySeconds))
          ),
          h(
            "div",
            { class: "bar-row" },
            h("div", { class: "bar-row-head" }, h("span", {}, `Window + Today vs ${w.weekTargetHours}h target`), h("span", { class: "mono" }, `${targetPct}%`)),
            h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${targetPct}%` } }))
          ),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--subtle btn--sm",
              disabled: !isGodMode && !can("team:write", snap) && slice.ctx.activeUser.id !== w.userId,
              onClick: () => toggleUserWatcher(w.userId)
            },
            w.running ? "Pause Auto-Tracker" : "Resume Auto-Tracker"
          )
        );
      })
    );
  }

  // Always show the Live Teammate Working Hours Ledger Table at bottom across all calendar views
  const hoursTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "watcher-hours-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "watcher-hours-caption" }, `Automatic Teammate Working Hours Ledger (${rangeStart} → ${rangeEnd})`),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { scope: "col" }, "Teammate"),
          h("th", { scope: "col" }, "Auto-Detected Tool"),
          h("th", { scope: "col" }, "Primary Scenario"),
          h("th", { scope: "col" }, "Today Live (HH:MM:SS)"),
          h("th", { scope: "col" }, "Window Actual Hours"),
          h("th", { scope: "col" }, "Weekly Target"),
          h("th", { scope: "col" }, "Watcher Control")
        )
      ),
      h(
        "tbody",
        {},
        ...slice.activeWatchers.map((w) => {
          const user = snap.users.find((u) => u.id === w.userId);
          const windowSec = filteredEvents
            .filter((ev) => ev.userId === w.userId && ev.date >= rangeStart && ev.date <= rangeEnd)
            .reduce((s, ev) => s + (ev.trackedSeconds || 0), 0);
          const canToggle = isGodMode || can("team:write", snap) || slice.ctx.activeUser.id === w.userId;

          return h(
            "tr",
            {},
            h("th", { scope: "row" }, h("div", {}, user?.name ?? w.userId), h("div", { class: "mono-meta" }, w.taskTitle)),
            h("td", { dataset: { label: "Tool" }, class: "mono-meta" }, w.tool),
            h("td", { dataset: { label: "Scenario" } }, createScenarioBadge(w.scenario, SCENARIOS)),
            h(
              "td",
              { dataset: { label: "Today Live" }, class: "mono" },
              h("span", { dataset: { liveUserHms: w.userId } }, formatHms(w.todaySeconds)),
              " (",
              h("span", { dataset: { liveUserHrs: w.userId } }, formatHours(w.todaySeconds)),
              ")"
            ),
            h("td", { dataset: { label: "Window Hours" }, class: "mono" }, formatHours(windowSec)),
            h("td", { dataset: { label: "Target" }, class: "mono" }, `${w.weekTargetHours}h / wk`),
            h(
              "td",
              { dataset: { label: "Control" } },
              h(
                "button",
                {
                  type: "button",
                  class: "btn btn--subtle btn--sm",
                  disabled: !canToggle,
                  onClick: () => toggleUserWatcher(w.userId)
                },
                w.running ? "Tracking · Pause" : "Paused · Start"
              )
            )
          );
        })
      )
    )
  );

  const modGuard = renderModuleVersionGuard("mod-calendar", "Mega Work Watcher & Calendar");
  if (!modGuard.enabled) return modGuard.blockedNodes;

  return [
    header,
    ...(modGuard.bannerNode ? [modGuard.bannerNode] : []),
    kpis,
    toolbarCard,
    calendarViewNode,
    quickLogCard,
    hoursTable
  ];
}
