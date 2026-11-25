import { openNewSocialModal } from "../components/modal.js";
import { copyText } from "../lib/clipboard.js";
import { createStatusPill, h } from "../lib/dom.js";
import { addBroadcast, can, canAccessTool, getState, getTenantSlice, toggleSocialStatus } from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let socialPlatformFilter = "All";

export function renderDistribution() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, activeChannel } = slice.ctx;
  const allChannels = snap.workspaces.flatMap((w) => w.channels ?? []);
  const findChannel = (id) => allChannels.find((c) => c.id === id);
  const canDistribute = can("distribution:write", snap);
  const showEmail = canAccessTool("distribution:email", snap);
  const showSocial = canAccessTool("distribution:social", snap);

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Distribution"),
      h("p", { class: "page-subtitle" }, `Scoped channels for ${workspace.name}${activeChannel ? ` · ${activeChannel.name} (${activeChannel.domain})` : ""}`)
    ),
    h(
      "div",
      { class: "page-actions" },
      showSocial
        ? h("button", { type: "button", class: "btn btn--primary", disabled: !canDistribute, onClick: () => openNewSocialModal() }, "+ Queue Social Post")
        : null
    )
  );

  const subjIn = h("input", { id: "bc-subject", class: "input", type: "text", required: true, disabled: !canDistribute, placeholder: "Weekly Macro Levels & Sovereign Stack Notes" });
  const segIn = h(
    "select",
    { id: "bc-segment", class: "select", disabled: !canDistribute },
    h("option", { value: `All Subscribers (${workspace.newsletterSubscribers.toLocaleString()})` }, `All Subscribers (${workspace.newsletterSubscribers.toLocaleString()})`),
    h("option", { value: "Macro & Finance Segment" }, "Macro & Finance Segment"),
    h("option", { value: "Music & Audio Drops" }, "Music & Audio Drops"),
    h("option", { value: "Tech & Self-Hosting" }, "Tech & Self-Hosting")
  );
  const dateIn = h("input", { id: "bc-date", class: "input", type: "text", value: "2026-11-28 08:30 EST", required: true, disabled: !canDistribute });
  const linkIn = h(
    "select",
    { id: "bc-link", class: "select", disabled: !canDistribute },
    ...(slice.shortLinks.length ? slice.shortLinks : snap.shortLinks.slice(0, 2)).map((l) => h("option", { value: l.slug }, `/go/${l.slug} (${l.category})`))
  );
  const bodyIn = h("textarea", { id: "bc-body", class: "textarea", required: true, disabled: !canDistribute, placeholder: "Draft newsletter body with {{sponsor}} or {{affiliate}} tokens..." });

  function submitBroadcast(targetStatus) {
    if (!canDistribute) return;
    const subject = subjIn.value.trim();
    const body = bodyIn.value.trim();
    if (!subject || !body) {
      showToast("Enter both Subject and Body to save or schedule", { tone: "warn" });
      return;
    }
    addBroadcast({
      subject,
      segment: segIn.value,
      status: targetStatus,
      scheduledFor: dateIn.value.trim(),
      affiliateSlug: linkIn.value,
      body
    });
    showToast(`Newsletter "${subject}" marked ${targetStatus} in Listmonk`, { tone: "ok" });
  }

  const emailPane = h(
    "section",
    { class: "card", "aria-labelledby": "email-pane-heading" },
    h("div", { class: "card-header" }, h("h2", { id: "email-pane-heading", class: "card-title" }, "Email Broadcasts (Listmonk)"), createStatusPill(`${workspace.newsletterSubscribers.toLocaleString()} Active Subs`, "ok")),
    h(
      "form",
      {
        style: "display:flex;flex-direction:column;gap:0.75rem;",
        onSubmit: (e) => {
          e.preventDefault();
          submitBroadcast("Scheduled");
        }
      },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "bc-subject" }, "Campaign Subject"), subjIn),
      h("div", { class: "form-grid" },
        h("div", { class: "field" }, h("label", { class: "field-label", for: "bc-segment" }, "Audience Segment"), segIn),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "bc-date" }, "Send Window"), dateIn),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "bc-link" }, "Featured /go Link"), linkIn)
      ),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "bc-body" }, "Broadcast Body (Markdown)"), bodyIn),
      h(
        "div",
        { style: "display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:flex-end;" },
        h("button", { type: "button", class: "btn btn--subtle", disabled: !canDistribute, onClick: () => submitBroadcast("Draft") }, "Save Draft"),
        h("button", { type: "submit", class: "btn btn--primary", disabled: !canDistribute }, "Schedule Broadcast")
      )
    ),
    h("h3", { class: "card-title", style: "font-size:var(--text-sm);padding-top:0.35rem;" }, "Recent & Upcoming Campaigns"),
    h(
      "ul",
      { class: "feed-list" },
      ...slice.broadcasts.map((bc) => {
        const tone = bc.status === "Sent" ? "ok" : bc.status === "Scheduled" ? "info" : "warn";
        const ch = findChannel(bc.channelId);
        return h(
          "li",
          { class: "feed-row", style: "align-items:flex-start;" },
          h("div", { class: "feed-row-main" },
            h("div", { style: "display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;" }, ch ? h("span", { class: "tag" }, ch.name) : null, h("strong", { style: "font-size:var(--text-sm);" }, bc.subject)),
            h("span", { class: "mono-meta" }, `${bc.segment} · ${bc.scheduledFor} · /go/${bc.affiliateSlug}`)
          ),
          h("div", { style: "display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0;" }, createStatusPill(bc.status, tone), bc.openRate ? h("span", { class: "mono-meta" }, `${bc.openRate} open`) : null)
        );
      })
    )
  );

  const platforms = ["All", "YouTube Shorts", "X", "LinkedIn", "Instagram"];
  const visibleSocial = slice.socialQueue.filter((s) => socialPlatformFilter === "All" || s.platform === socialPlatformFilter);

  const socialPane = h(
    "section",
    { class: "card", "aria-labelledby": "social-pane-heading" },
    h("div", { class: "card-header" }, h("h2", { id: "social-pane-heading", class: "card-title" }, "Social Scheduler (Postiz Queue)"), h("span", { class: "mono-meta" }, `${slice.socialQueue.filter((s) => s.status === "Queued").length} armed`)),
    h(
      "div",
      { class: "filter-bar", role: "group", "aria-label": "Filter social queue by platform" },
      ...platforms.map((plat) =>
        h(
          "button",
          {
            type: "button",
            class: "filter-pill",
            "aria-pressed": String(socialPlatformFilter === plat),
            onClick: () => {
              socialPlatformFilter = plat;
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          plat
        )
      )
    ),
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:0.75rem;" },
      ...visibleSocial.map((post) => {
        const isQueued = post.status === "Queued" || post.status === "Published";
        const ch = findChannel(post.channelId);
        return h(
          "article",
          { class: "card", style: "background:var(--bg-canvas);" },
          h("div", { class: "card-header" },
            h("div", { style: "display:flex;gap:0.35rem;align-items:center;" }, h("span", { class: "badge" }, post.platform), ch ? h("span", { class: "tag" }, ch.name) : null),
            h("div", { style: "display:flex;align-items:center;gap:0.5rem;" }, h("span", { class: "mono-meta" }, post.scheduledFor), createStatusPill(post.status, isQueued ? "ok" : "warn"))
          ),
          h("div", { class: "social-thumb" }, h("div", { style: "display:flex;justify-content:space-between;align-items:center;" }, h("span", { class: "badge" }, post.mediaBadge), h("span", { class: "mono-meta" }, post.mediaLabel)), h("strong", { style: "font-size:var(--text-base);" }, post.title)),
          h("p", { style: "margin:0;font-size:var(--text-sm);color:var(--text-secondary);" }, post.caption),
          h(
            "div",
            { class: "feed-row", style: "background:var(--bg-surface);" },
            h("span", { class: "mono-meta truncate" }, post.trackingUrl),
            h(
              "div",
              { style: "display:flex;gap:0.4rem;flex-shrink:0;" },
              h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: (e) => copyText(post.trackingUrl, e.currentTarget, "Copied UTM tracking URL") }, "Copy URL"),
              h("button", { type: "button", class: "btn btn--ghost btn--sm", disabled: !canDistribute, onClick: () => { toggleSocialStatus(post.id); showToast(`${post.platform} post ${isQueued ? "paused" : "re-queued"}`, { tone: "info" }); } }, isQueued ? "Pause" : "Resume")
            )
          )
        );
      })
    )
  );

  const panes = [
    ...(showEmail ? [emailPane] : []),
    ...(showSocial ? [socialPane] : [])
  ];
  return [header, panes.length === 2 ? h("div", { class: "split-pane" }, ...panes) : panes[0]];
}
