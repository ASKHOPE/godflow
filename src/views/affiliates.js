import { openNewLinkModal } from "../components/modal.js";
import { copyText } from "../lib/clipboard.js";
import { createSparkline, createStatusPill, formatCurrency, formatNumber, h } from "../lib/dom.js";
import { renderModuleVersionGuard } from "../lib/workbench-helpers.js";
import { can, getState, getTenantSlice, updateShortLink } from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let categoryFilter = "All";
let editingLinkId = null;

let utmSlug = "broker";
let utmSource = "youtube";
let utmMedium = "video-desc";
let utmCampaign = "premarket-nov25";
let utmContent = "pinned-comment";

export function renderAffiliates() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, activeChannel, role, isGodMode } = slice.ctx;
  const allChannels = snap.workspaces.flatMap((w) => w.channels ?? []);
  const findChannel = (id) => allChannels.find((c) => c.id === id);
  const canEditLinks = can("links:write", snap);
  const showRevenue = isGodMode || can("finance:read", snap) || role.id === "trader_host";
  const categories = ["All", ...new Set(slice.shortLinks.map((l) => l.category))];
  if (!categories.includes(categoryFilter)) categoryFilter = "All";
  const links = slice.shortLinks.filter((l) => categoryFilter === "All" || l.category === categoryFilter);
  const activeDomain = activeChannel?.shortDomain || workspace.shortDomain;

  if (links.length && !links.some((l) => l.slug === utmSlug)) {
    utmSlug = links[0].slug;
  }

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Affiliates & Link Engine"),
      h("p", { class: "page-subtitle" }, `First-party /go/:slug 302 redirect engine on ${activeDomain} with live sparklines & UTM builder`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h("button", { type: "button", class: "btn btn--primary", disabled: !canEditLinks, onClick: () => openNewLinkModal() }, "+ New /go Link")
    )
  );

  const filters = h(
    "div",
    { class: "filter-bar", role: "group", "aria-label": "Filter links by category" },
    ...categories.map((cat) =>
      h(
        "button",
        {
          type: "button",
          class: "filter-pill",
          "aria-pressed": String(categoryFilter === cat),
          onClick: () => {
            categoryFilter = cat;
            window.dispatchEvent(new CustomEvent("godflow:rerender"));
          }
        },
        cat
      )
    )
  );

  const tableRows = links.map((lnk) => {
    const ch = findChannel(lnk.channelId);
    const linkDomain = ch?.shortDomain || workspace.shortDomain;
    const shortUrl = `https://${linkDomain}/${lnk.slug}`;
    const isEditing = editingLinkId === lnk.id && canEditLinks;

    let destCell;
    if (isEditing) {
      const destInput = h("input", { type: "url", class: "input input--mono", value: lnk.destination, "aria-label": `Edit destination URL for /${lnk.slug}` });
      destCell = h(
        "td",
        { dataset: { label: "Destination" } },
        h(
          "div",
          { style: "display:flex;gap:0.4rem;align-items:center;min-inline-size:220px;" },
          destInput,
          h("button", { type: "button", class: "btn btn--primary btn--sm", onClick: () => { const nextDest = destInput.value.trim(); if (!nextDest) return; editingLinkId = null; updateShortLink(lnk.id, { destination: nextDest }); showToast(`Updated destination for /go/${lnk.slug}`, { tone: "ok" }); } }, "Save"),
          h("button", { type: "button", class: "btn btn--ghost btn--sm", onClick: () => { editingLinkId = null; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Cancel")
        )
      );
    } else {
      destCell = h("td", { dataset: { label: "Destination" }, style: "max-inline-size:290px;" }, h("div", { class: "mono-meta truncate" }, lnk.destination));
    }

    return h(
      "tr",
      {},
      h("th", { scope: "row" }, h("div", { style: "display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;" }, ch ? h("span", { class: "tag" }, ch.name) : null, h("span", { class: "mono", style: "font-weight:600;" }, `${linkDomain}/${lnk.slug}`), h("button", { type: "button", class: "btn btn--subtle btn--sm", "aria-label": `Copy short URL for /${lnk.slug}`, onClick: (e) => copyText(shortUrl, e.currentTarget, `Copied ${shortUrl}`) }, "Copy"))),
      destCell,
      h("td", { dataset: { label: "14d Trend" } }, createSparkline(lnk.spark, `${lnk.slug} click trend`)),
      h("td", { dataset: { label: "Clicks" }, class: "mono" }, formatNumber(lnk.clicks)),
      h("td", { dataset: { label: "Est. Rev" }, class: "mono" }, showRevenue ? `${formatCurrency(lnk.estRevenueUsd)} (${lnk.convRate}%)` : "Confidential"),
      h("td", { dataset: { label: "Status" } }, h("button", { type: "button", class: "btn btn--ghost btn--sm", disabled: !canEditLinks, "aria-label": `Toggle active status for /${lnk.slug}`, onClick: () => { updateShortLink(lnk.id, { active: !lnk.active }); showToast(`/${lnk.slug} ${lnk.active ? "paused" : "activated"}`, { tone: "info" }); } }, createStatusPill(lnk.active ? "Active" : "Paused", lnk.active ? "ok" : "warn"))),
      h("td", { dataset: { label: "Actions" } }, !isEditing ? h("button", { type: "button", class: "btn btn--subtle btn--sm", disabled: !canEditLinks, onClick: () => { editingLinkId = lnk.id; window.dispatchEvent(new CustomEvent("godflow:rerender")); } }, "Edit Dest") : null)
    );
  });

  const linksTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "links-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "links-caption" }, `Branded Short Links (${activeDomain})`),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Slug"), h("th", { scope: "col" }, "Destination URL"), h("th", { scope: "col" }, "14d Spark"), h("th", { scope: "col" }, "Clicks"), h("th", { scope: "col" }, "Attribution"), h("th", { scope: "col" }, "State"), h("th", { scope: "col" }, "Edit"))),
      h("tbody", {}, ...tableRows)
    )
  );

  const outputPreview = h("input", { id: "utm-output", class: "input input--mono", type: "text", readonly: true });

  function updateUtmUrl() {
    const selectedLink = slice.shortLinks.find((l) => l.slug === utmSlug);
    const ch = selectedLink ? findChannel(selectedLink.channelId) : null;
    const base = new URL(`https://${ch?.shortDomain || activeDomain}/${utmSlug}`);
    if (utmSource.trim()) base.searchParams.set("utm_source", utmSource.trim());
    if (utmMedium.trim()) base.searchParams.set("utm_medium", utmMedium.trim());
    if (utmCampaign.trim()) base.searchParams.set("utm_campaign", utmCampaign.trim());
    if (utmContent.trim()) base.searchParams.set("utm_content", utmContent.trim());
    outputPreview.value = base.toString();
  }

  const slugSel = h(
    "select",
    { id: "utm-slug", class: "select", onChange: (e) => { utmSlug = e.target.value; updateUtmUrl(); } },
    ...(slice.shortLinks.length ? slice.shortLinks : snap.shortLinks).map((l) => h("option", { value: l.slug, selected: l.slug === utmSlug }, `/${l.slug} — ${l.category}`))
  );

  const srcIn = h("input", { id: "utm-source", class: "input input--mono", type: "text", value: utmSource, onInput: (e) => { utmSource = e.target.value; updateUtmUrl(); } });
  const medIn = h("input", { id: "utm-medium", class: "input input--mono", type: "text", value: utmMedium, onInput: (e) => { utmMedium = e.target.value; updateUtmUrl(); } });
  const campIn = h("input", { id: "utm-campaign", class: "input input--mono", type: "text", value: utmCampaign, onInput: (e) => { utmCampaign = e.target.value; updateUtmUrl(); } });
  const contIn = h("input", { id: "utm-content", class: "input input--mono", type: "text", value: utmContent, onInput: (e) => { utmContent = e.target.value; updateUtmUrl(); } });
  updateUtmUrl();

  const utmBuilder = h(
    "section",
    { class: "card", "aria-labelledby": "utm-heading" },
    h(
      "div",
      { class: "card-header" },
      h("h2", { id: "utm-heading", class: "card-title" }, "UTM Attribution Builder"),
      h(
        "div",
        { class: "filter-bar" },
        ...[{ label: "YT Shorts", s: "youtube", m: "shorts" }, { label: "Listmonk", s: "listmonk", m: "newsletter" }, { label: "X Thread", s: "x", m: "social" }].map((preset) =>
          h("button", { type: "button", class: "filter-pill", onClick: () => { utmSource = preset.s; utmMedium = preset.m; srcIn.value = preset.s; medIn.value = preset.m; updateUtmUrl(); } }, preset.label)
        )
      )
    ),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { class: "field-label", for: "utm-slug" }, "Base /go Slug"), slugSel),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "utm-source" }, "utm_source"), srcIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "utm-medium" }, "utm_medium"), medIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "utm-campaign" }, "utm_campaign"), campIn),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "utm-content" }, "utm_content"), contIn)
    ),
    h(
      "div",
      { style: "display:flex;flex-wrap:wrap;gap:0.6rem;align-items:end;" },
      h("div", { class: "field", style: "flex:1 1 320px;" }, h("label", { class: "field-label", for: "utm-output" }, "Generated Tracking URL"), outputPreview),
      h("button", { type: "button", class: "btn btn--primary", onClick: (e) => copyText(outputPreview.value, e.currentTarget, "Copied UTM tracking URL") }, "Copy Tracking URL")
    )
  );

  const modGuard = renderModuleVersionGuard("mod-growth-links", "Affiliates & /go Link Engine");
  if (!modGuard.enabled) return modGuard.blockedNodes;

  return [header, ...(modGuard.bannerNode ? [modGuard.bannerNode] : []), filters, linksTable, utmBuilder];
}
