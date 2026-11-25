const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Safe DOM element builder. Never parses raw untrusted HTML strings.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") {
      el.className = value;
    } else if (key === "dataset") {
      for (const [dKey, dVal] of Object.entries(value)) {
        if (dVal != null) el.dataset[dKey] = String(dVal);
      }
    } else if (key === "style" && typeof value === "object") {
      for (const [sKey, sVal] of Object.entries(value)) {
        el.style.setProperty(sKey, sVal);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) {
      el.append(child);
    } else {
      el.append(document.createTextNode(String(child)));
    }
  }
  return el;
}

export function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c instanceof Node) el.append(c);
  }
  return el;
}

export function formatCurrency(amount, currency = "USD") {
  if (currency === "BTC") {
    return `₿${Number(amount).toFixed(4)}`;
  }
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: num % 1 === 0 ? 0 : 2
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString()}`;
  }
}

export function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(Number(n) || 0);
}

export function createSparkline(points, label = "Trend") {
  const width = 88;
  const height = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((val, idx) => {
    const x = points.length === 1 ? width : (idx / (points.length - 1)) * width;
    const y = height - 3 - ((val - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = svgEl("polyline", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    points: coords.join(" ")
  });

  const last = coords.at(-1).split(",");
  const dot = svgEl("circle", {
    cx: last[0],
    cy: last[1],
    r: "2.4",
    fill: "currentColor"
  });

  return svgEl(
    "svg",
    {
      class: "sparkline-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": label,
      style: "color: var(--accent)"
    },
    polyline,
    dot
  );
}

export function createScenarioBadge(scenarioId, scenarios) {
  const meta = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  return h(
    "span",
    { class: "badge scen-badge", dataset: { scenario: meta.id } },
    h("span", { class: "status-dot", "aria-hidden": "true" }),
    meta.short
  );
}

export function createStatusPill(label, tone = "info") {
  return h(
    "span",
    { class: `status-pill status-pill--${tone}` },
    h("span", { class: "status-dot", "aria-hidden": "true" }),
    label
  );
}

/**
 * Accessible horizontal tablist widget implementing:
 * - hidden="until-found" + beforematch sync
 * - focusgroup="tablist nomemory" + roving arrow-key fallback when native focusgroup is unavailable
 * - No padding/borders directly on [role="tabpanel"] (wrapped inside .panel-body)
 */
export function createTabs({ ariaLabel, tabs, initialId, onChange }) {
  let activeId = initialId ?? tabs[0]?.id;
  const tabButtons = new Map();
  const tabPanels = new Map();

  const tablist = h("div", {
    class: "tablist",
    role: "tablist",
    focusgroup: "tablist nomemory",
    "aria-label": ariaLabel
  });

  function selectTab(id, { focus = false } = {}) {
    activeId = id;
    for (const t of tabs) {
      const btn = tabButtons.get(t.id);
      const panel = tabPanels.get(t.id);
      const isSelected = t.id === id;
      btn.setAttribute("aria-selected", String(isSelected));
      btn.toggleAttribute("focusgroupstart", isSelected);
      if (!Object.hasOwn(HTMLElement.prototype, "focusGroup")) {
        btn.tabIndex = isSelected ? 0 : -1;
      }
      if (isSelected) {
        panel.hidden = false;
        panel.tabIndex = 0;
        if (focus) btn.focus();
      } else {
        panel.hidden = "until-found";
        panel.removeAttribute("tabindex");
      }
    }
    btnScrollIntoView(tabButtons.get(id));
    onChange?.(id);
  }

  function btnScrollIntoView(btn) {
    try {
      btn?.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
    } catch {
      btn?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  for (const t of tabs) {
    const btnId = `tab-${t.id}`;
    const isInit = t.id === activeId;
    const btn = h(
      "button",
      {
        type: "button",
        role: "tab",
        id: btnId,
        "aria-selected": String(isInit),
        focusgroupstart: isInit,
        onClick: () => selectTab(t.id)
      },
      t.label,
      t.count != null ? h("span", { class: "badge mono" }, String(t.count)) : null
    );

    if (!Object.hasOwn(HTMLElement.prototype, "focusGroup")) {
      btn.tabIndex = isInit ? 0 : -1;
    }

    const panel = h(
      "div",
      {
        role: "tabpanel",
        "aria-labelledby": btnId,
        tabindex: isInit ? "0" : null
      },
      h("div", { class: "panel-body" }, t.render())
    );

    if (!isInit) {
      panel.hidden = "until-found";
    }

    panel.addEventListener("beforematch", () => selectTab(t.id));

    tabButtons.set(t.id, btn);
    tabPanels.set(t.id, panel);
    tablist.append(btn);
  }

  // Fallback roving arrow-key navigation when native focusgroup is unsupported
  if (!Object.hasOwn(HTMLElement.prototype, "focusGroup")) {
    tablist.addEventListener("keydown", (e) => {
      const idx = tabs.findIndex((t) => t.id === activeId);
      if (idx < 0) return;
      let nextIdx = null;
      if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = tabs.length - 1;
      if (nextIdx !== null) {
        e.preventDefault();
        selectTab(tabs[nextIdx].id, { focus: true });
      }
    });
  }

  return h("div", { class: "tabs" }, tablist, ...tabs.map((t) => tabPanels.get(t.id)));
}
