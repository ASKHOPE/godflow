const STORAGE_KEY = "color-scheme";

function getSystemScheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredScheme() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === "light" || val === "dark" ? val : null;
  } catch {
    return null;
  }
}

export function getRenderedScheme() {
  return getStoredScheme() ?? getSystemScheme();
}

export function applyScheme(mode) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (mode === "light" || mode === "dark") {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore storage errors */
    }
    if (meta) meta.content = mode;
  } else {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (meta) meta.content = "light dark";
  }
  syncThemeControls();
}

export function toggleRenderedScheme() {
  const current = getRenderedScheme();
  const target = current === "dark" ? "light" : "dark";
  const system = getSystemScheme();
  if (target === system) {
    applyScheme(null);
  } else {
    applyScheme(target);
  }
  return target;
}

export function syncThemeControls() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  if (toggleBtn) {
    const current = getRenderedScheme();
    const next = current === "dark" ? "light" : "dark";
    toggleBtn.setAttribute("aria-label", `Switch to ${next} mode`);
    const textEl = toggleBtn.querySelector(".theme-toggle-text");
    if (textEl) textEl.textContent = `Switch to ${next} mode`;
  }
  window.dispatchEvent(
    new CustomEvent("godflow:themechange", {
      detail: { rendered: getRenderedScheme(), stored: getStoredScheme() }
    })
  );
}

export function initThemeController() {
  document.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("#theme-toggle-btn")) {
      toggleRenderedScheme();
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      const val = e.newValue;
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.content = val === "light" || val === "dark" ? val : "light dark";
      }
      syncThemeControls();
    }
  });

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", () => {
    syncThemeControls();
  });

  syncThemeControls();
}
