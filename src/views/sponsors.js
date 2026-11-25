import { SPONSOR_STAGES } from "../data/seed.js";
import { openMediaKitModal, openNewSponsorModal } from "../components/modal.js";
import { createStatusPill, formatCurrency, h } from "../lib/dom.js";
import { can, getState, getTenantSlice, toggleGuestRelease, updateSponsorStage } from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let sponsorStageFilter = "All";

export function renderSponsors() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, role } = slice.ctx;
  const canEditSponsors = can("sponsors:write", snap);
  const isGuestPortal = role.id === "guest_viewer";
  const isPodcastGuestsOnly = role.id === "podcast_producer";
  const stages = ["All", ...SPONSOR_STAGES];

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, isGuestPortal ? "Partner Deliverables & Media Kit" : isPodcastGuestsOnly ? "Podcast Guest Releases & Media Kit" : "Sponsors & Collabs"),
      h("p", { class: "page-subtitle" }, isGuestPortal ? `Scoped external partner view (${workspace.name}) — financial terms & sibling deals confidential` : `Deal pipeline & guest releases for ${workspace.name}`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h("button", { type: "button", class: "btn btn--subtle", onClick: () => openMediaKitModal() }, "Live Media Kit"),
      canEditSponsors ? h("button", { type: "button", class: "btn btn--primary", onClick: () => openNewSponsorModal() }, "+ New Deal") : null
    )
  );

  if (isPodcastGuestsOnly) {
    const guestOnlyTable = h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "guests-caption" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { id: "guests-caption" }, "Podcast Guest Collaboration & Release Tracker (Sponsor financials hidden)"),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Guest"), h("th", { scope: "col" }, "Production Slot"), h("th", { scope: "col" }, "Prep & Assets"), h("th", { scope: "col" }, "Release Form"), h("th", { scope: "col" }, "Status"))),
        h(
          "tbody",
          {},
          ...slice.guests.map((g) =>
            h(
              "tr",
              {},
              h("th", { scope: "row" }, h("div", {}, g.name), h("div", { class: "mono-meta" }, g.role)),
              h("td", { dataset: { label: "Slot" } }, g.slot),
              h("td", { dataset: { label: "Prep Notes" }, style: "max-inline-size:320px;" }, g.prepNotes),
              h("td", { dataset: { label: "Release" } }, h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => { toggleGuestRelease(g.id); showToast(`Updated release status for ${g.name}`, { tone: "info" }); } }, g.releaseSigned ? "Signed ✓" : "Mark Signed")),
              h("td", { dataset: { label: "Status" } }, createStatusPill(g.status, g.releaseSigned ? "ok" : "warn"))
            )
          )
        )
      )
    );
    return [header, guestOnlyTable];
  }

  const byStage = Object.groupBy(slice.sponsors, (s) => s.stage);

  const stageSummary = h(
    "section",
    { class: "grid-kpi", "aria-label": "Deal pipeline stage totals" },
    ...SPONSOR_STAGES.map((stage) => {
      const deals = byStage[stage] ?? [];
      const totalVal = deals.reduce((s, d) => s + d.value, 0);
      return h(
        "article",
        { class: "card kpi-card" },
        h("span", { class: "kpi-label" }, stage),
        h("div", { class: "kpi-value", style: "font-size:1.25rem;" }, formatCurrency(totalVal)),
        h("span", { class: "mono-meta" }, `${deals.length} ${deals.length === 1 ? "deal" : "deals"}`)
      );
    })
  );

  const filterBar = h(
    "div",
    { class: "filter-bar", role: "group", "aria-label": "Filter sponsor deals by stage" },
    ...stages.map((st) =>
      h(
        "button",
        {
          type: "button",
          class: "filter-pill",
          "aria-pressed": String(sponsorStageFilter === st),
          onClick: () => {
            sponsorStageFilter = st;
            window.dispatchEvent(new CustomEvent("godflow:rerender"));
          }
        },
        st
      )
    )
  );

  const visibleDeals = slice.sponsors.filter((s) => sponsorStageFilter === "All" || s.stage === sponsorStageFilter);

  const dealsGrid = h(
    "section",
    { class: "grid-2", "aria-label": "Sponsor deal profiles" },
    ...visibleDeals.map((sp) => {
      const tone = sp.stage === "Paid" ? "ok" : sp.stage === "Deliverables Live" || sp.stage === "SOW Signed" ? "info" : "warn";

      const stageSel = h(
        "select",
        {
          class: "select",
          disabled: !canEditSponsors,
          style: "max-inline-size:170px;",
          "aria-label": `Pipeline stage for ${sp.company}`,
          onChange: (e) => {
            updateSponsorStage(sp.id, e.target.value);
            showToast(`${sp.company} moved to ${e.target.value}`, { tone: "ok" });
          }
        },
        ...SPONSOR_STAGES.map((st) => h("option", { value: st, selected: st === sp.stage }, st))
      );

      return h(
        "article",
        { class: "card" },
        h("div", { class: "card-header" }, h("div", {}, h("h2", { class: "card-title" }, sp.company), h("span", { class: "mono-meta" }, `${sp.contactName} · ${sp.contactEmail}`)), h("strong", { class: "mono", style: "font-size:1.1rem;" }, isGuestPortal ? "Confidential" : formatCurrency(sp.value, sp.currency))),
        h("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:0.45rem;" }, createStatusPill(sp.contractStatus, tone), h("span", { class: "badge mono" }, `/go/${sp.affiliateSlug}`), h("span", { class: "mono-meta" }, `Due ${sp.dueDate}`)),
        h("p", { style: "margin:0;font-size:var(--text-sm);" }, sp.deliverables),
        h("p", { style: "margin:0;font-size:var(--text-xs);color:var(--text-secondary);" }, sp.notes),
        canEditSponsors
          ? h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:auto;padding-top:0.4rem;" }, h("span", { class: "mono-meta" }, "Deal Stage:"), stageSel)
          : null
      );
    })
  );

  if (isGuestPortal) {
    return [header, dealsGrid];
  }

  const guestTable = h(
    "div",
    { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "guests-caption" },
    h(
      "table",
      { class: "data-table" },
      h("caption", { id: "guests-caption" }, "Podcast & Stream Guest Collaboration Tracker"),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Guest"), h("th", { scope: "col" }, "Production Slot"), h("th", { scope: "col" }, "Prep & Assets"), h("th", { scope: "col" }, "Release Form"), h("th", { scope: "col" }, "Status"))),
      h(
        "tbody",
        {},
        ...slice.guests.map((g) =>
          h(
            "tr",
            {},
            h("th", { scope: "row" }, h("div", {}, g.name), h("div", { class: "mono-meta" }, g.role)),
            h("td", { dataset: { label: "Slot" } }, g.slot),
            h("td", { dataset: { label: "Prep Notes" }, style: "max-inline-size:320px;" }, g.prepNotes),
            h("td", { dataset: { label: "Release" } }, h("button", { type: "button", class: "btn btn--subtle btn--sm", disabled: !canEditSponsors, onClick: () => { toggleGuestRelease(g.id); showToast(`Updated release status for ${g.name}`, { tone: "info" }); } }, g.releaseSigned ? "Signed ✓" : "Mark Signed")),
            h("td", { dataset: { label: "Status" } }, createStatusPill(g.status, g.releaseSigned ? "ok" : "warn"))
          )
        )
      )
    )
  );

  return [header, stageSummary, filterBar, dealsGrid, guestTable];
}
