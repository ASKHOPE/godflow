import { showToast } from "./toast.js";

export async function copyText(text, triggerButton, toastMessage = "Copied to clipboard") {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }

  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.append(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }

  if (triggerButton) {
    const prev = triggerButton.textContent;
    triggerButton.textContent = ok ? "Copied" : "Failed";
    setTimeout(() => {
      if (triggerButton.isConnected) triggerButton.textContent = prev;
    }, 1300);
  }

  showToast(ok ? toastMessage : "Clipboard blocked — copy manually from field", {
    tone: ok ? "ok" : "warn"
  });
  return ok;
}
