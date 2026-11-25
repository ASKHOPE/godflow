const toastTimers = new WeakMap();

export function announce(message) {
  if (typeof document.ariaNotify === "function") {
    document.ariaNotify(message);
    return;
  }
  const announcer = document.getElementById("sr-announcer");
  if (!announcer) return;
  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

export function showToast(message, { tone = "info", duration = 3600 } = {}) {
  // Per modern-web-guidance: do not surface toasts behind an open modal dialog
  if (document.querySelector("dialog[open]")) {
    announce(message);
    return;
  }

  const region = document.getElementById("toast-region");
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.setAttribute("popover", "manual");

  const body = document.createElement("div");
  body.className = "toast-body";

  const pill = document.createElement("span");
  pill.className = `status-pill status-pill--${tone}`;
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");
  const tagLabel = tone === "ok" ? "Done" : tone === "warn" ? "Alert" : tone === "err" ? "Error" : "Info";
  pill.append(dot, tagLabel);

  const text = document.createElement("span");
  text.textContent = message;
  body.append(pill, text);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn btn--ghost btn--sm";
  closeBtn.setAttribute("aria-label", "Dismiss notification");
  closeBtn.textContent = "Close";

  function dismiss() {
    clearTimeout(toastTimers.get(toast));
    const wasFocused = toast.contains(document.activeElement);
    try {
      if (typeof toast.hidePopover === "function") {
        toast.hidePopover();
      }
    } catch {
      /* ignore */
    }
    toast.classList.remove(":popover-open");
    const nextToast = toast.nextElementSibling ?? toast.previousElementSibling;
    toast.remove();
    if (wasFocused && nextToast) {
      nextToast.querySelector("button")?.focus();
    }
  }

  closeBtn.addEventListener("click", dismiss);
  toast.append(body, closeBtn);
  region.append(toast);

  if (typeof toast.showPopover === "function") {
    try {
      toast.showPopover();
    } catch {
      toast.classList.add(":popover-open");
    }
  } else {
    toast.classList.add(":popover-open");
  }

  announce(message);

  let timer = setTimeout(dismiss, duration);
  toastTimers.set(toast, timer);

  toast.addEventListener("focusin", () => clearTimeout(toastTimers.get(toast)));
  toast.addEventListener("mouseenter", () => clearTimeout(toastTimers.get(toast)));
  toast.addEventListener("focusout", () => {
    clearTimeout(toastTimers.get(toast));
    timer = setTimeout(dismiss, 2200);
    toastTimers.set(toast, timer);
  });
  toast.addEventListener("mouseleave", () => {
    clearTimeout(toastTimers.get(toast));
    timer = setTimeout(dismiss, 2200);
    toastTimers.set(toast, timer);
  });
}
