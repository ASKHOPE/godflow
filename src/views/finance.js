import { ROLES } from "../data/seed.js";
import { openInvoicePreviewModal, openNewInvoiceModal } from "../components/modal.js";
import { createStatusPill, createTabs, formatCurrency, h } from "../lib/dom.js";
import { renderModuleVersionGuard } from "../lib/workbench-helpers.js";
import {
  addWorkEvent,
  can,
  getDerivedMetrics,
  getState,
  getTenantSlice,
  markInvoicePaid,
  toggleUserWatcher
} from "../lib/store.js";
import { showToast } from "../lib/toast.js";

let ledgerFilter = "All";
let activeFinanceTab = "invoices";

export function renderFinance() {
  const snap = getState();
  const slice = getTenantSlice(snap);
  const { workspace, role } = slice.ctx;
  const metrics = getDerivedMetrics(snap);
  const canEditFinance = can("finance:write", snap);

  const header = h(
    "div",
    { class: "page-head" },
    h(
      "div",
      { class: "page-title-group" },
      h("h1", { id: "main-heading", class: "page-title", tabindex: "-1" }, "Finance & Business Ledger"),
      h("p", { class: "page-subtitle" }, `Multi-currency invoicing, Fiat + BTCPay donations, and P&L for ${workspace.name}`)
    ),
    h(
      "div",
      { class: "page-actions" },
      h("button", { type: "button", class: "btn btn--primary", disabled: !canEditFinance, onClick: () => openNewInvoiceModal() }, "+ New Sponsor Invoice")
    )
  );

  const marginPct = metrics.monthlyRevenueUsd ? ((metrics.netProfitUsd / metrics.monthlyRevenueUsd) * 100).toFixed(1) : "0.0";

  const pnlCards = h(
    "section",
    { class: "grid-kpi", "aria-label": "Monthly profit and loss summary" },
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Gross Income (MTD)"), h("div", { class: "kpi-value" }, formatCurrency(metrics.monthlyRevenueUsd)), h("span", { class: "mono-meta" }, "Sponsors + Affiliates + Donations")),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Studio & Infra OpEx"), h("div", { class: "kpi-value" }, formatCurrency(metrics.expensesUsd)), h("span", { class: "mono-meta" }, "Compute, R2 storage, tools")),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Net Profit (MTD)"), h("div", { class: "kpi-value" }, formatCurrency(metrics.netProfitUsd)), createStatusPill(`${marginPct}% Net Margin`, "ok")),
    h("article", { class: "card kpi-card" }, h("span", { class: "kpi-label" }, "Outstanding B2B A/R"), h("div", { class: "kpi-value" }, formatCurrency(metrics.outstandingInvoicesUsd)), h("span", { class: "mono-meta" }, `${slice.invoices.filter((i) => i.status !== "Paid" && i.status !== "Draft").length} invoices awaiting settlement`))
  );

  const revStreams = [
    { label: "Sponsor Invoices", val: metrics.sponsorSettledUsd },
    { label: "Affiliate Payouts", val: metrics.affiliateRevenueUsd },
    { label: "Stream Donations (Fiat + BTCPay)", val: metrics.donationsRevenueUsd }
  ];
  const mixTotal = revStreams.reduce((s, r) => s + r.val, 0) || 1;

  const mixCard = h(
    "section",
    { class: "card" },
    h("div", { class: "card-header" }, h("h2", { class: "card-title" }, "Revenue Mix Breakdown (MTD)"), !canEditFinance ? createStatusPill(`Read-Only (${role.badge})`, "warn") : null),
    h(
      "div",
      { class: "grid-3" },
      ...revStreams.map((rs) => {
        const pct = Math.round((rs.val / mixTotal) * 100);
        return h(
          "div",
          { class: "bar-row" },
          h("div", { class: "bar-row-head" }, h("span", {}, rs.label), h("strong", { class: "mono" }, `${formatCurrency(rs.val)} (${pct}%)`)),
          h("div", { class: "progress-track" }, h("div", { class: "progress-fill", style: { width: `${pct}%` } }))
        );
      })
    )
  );

  function renderInvoicesTab() {
    return h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "inv-caption" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { id: "inv-caption" }, "Multi-Currency Sponsor Invoices"),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Invoice #"), h("th", { scope: "col" }, "Sponsor"), h("th", { scope: "col" }, "Native Amount"), h("th", { scope: "col" }, "USD Equiv"), h("th", { scope: "col" }, "Rail"), h("th", { scope: "col" }, "Due Date"), h("th", { scope: "col" }, "Status"), h("th", { scope: "col" }, "Actions"))),
        h(
          "tbody",
          {},
          ...slice.invoices.map((inv) => {
            const tone = inv.status === "Paid" ? "ok" : inv.status === "Draft" ? "info" : "warn";
            return h(
              "tr",
              {},
              h("th", { scope: "row", class: "mono" }, inv.number),
              h("td", { dataset: { label: "Sponsor" } }, inv.sponsorName),
              h("td", { dataset: { label: "Amount" }, class: "mono" }, `${formatCurrency(inv.amount, inv.currency)} (${inv.currency})`),
              h("td", { dataset: { label: "USD Equiv" }, class: "mono" }, formatCurrency(inv.usdEquivalent, "USD")),
              h("td", { dataset: { label: "Rail" } }, inv.rail),
              h("td", { dataset: { label: "Due" }, class: "mono" }, inv.dueDate),
              h("td", { dataset: { label: "Status" } }, createStatusPill(inv.status, tone)),
              h(
                "td",
                { dataset: { label: "Actions" } },
                h(
                  "div",
                  { style: "display:flex;gap:0.4rem;flex-wrap:wrap;" },
                  h("button", { type: "button", class: "btn btn--subtle btn--sm", onClick: () => openInvoicePreviewModal(inv.id) }, "Preview PDF"),
                  inv.status !== "Paid"
                    ? h("button", { type: "button", class: "btn btn--ghost btn--sm", disabled: !canEditFinance, onClick: () => { markInvoicePaid(inv.id); showToast(`Settled ${inv.number} in Unified Ledger`, { tone: "ok" }); } }, "Mark Paid")
                    : null
                )
              )
            );
          })
        )
      )
    );
  }

  function renderLedgerTab() {
    const categories = ["All", "Sponsor Invoice", "Stream Donation (Fiat)", "Stream Donation (BTCPay)", "Affiliate Payout"];
    const entries = slice.ledgerEntries.filter((e) => ledgerFilter === "All" || e.category === ledgerFilter);

    const pills = h(
      "div",
      { class: "filter-bar", role: "group", "aria-label": "Filter ledger entries by income stream" },
      ...categories.map((cat) =>
        h(
          "button",
          {
            type: "button",
            class: "filter-pill",
            "aria-pressed": String(ledgerFilter === cat),
            onClick: () => {
              ledgerFilter = cat;
              window.dispatchEvent(new CustomEvent("godflow:rerender"));
            }
          },
          cat
        )
      )
    );

    const table = h(
      "div",
      { class: "table-wrapper", tabindex: "0", role: "region", "aria-labelledby": "ledger-caption" },
      h(
        "table",
        { class: "data-table" },
        h("caption", { id: "ledger-caption" }, "Unified Income Ledger (Sponsors + Donations + Affiliates)"),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Date"), h("th", { scope: "col" }, "Source"), h("th", { scope: "col" }, "Stream"), h("th", { scope: "col" }, "Payment Rail"), h("th", { scope: "col" }, "Native"), h("th", { scope: "col" }, "USD Settled"), h("th", { scope: "col" }, "Status"))),
        h(
          "tbody",
          {},
          ...entries.map((entry) =>
            h(
              "tr",
              {},
              h("th", { scope: "row", class: "mono" }, entry.date),
              h("td", { dataset: { label: "Source" } }, entry.source),
              h("td", { dataset: { label: "Stream" } }, h("span", { class: "badge" }, entry.category)),
              h("td", { dataset: { label: "Rail" } }, entry.rail),
              h("td", { dataset: { label: "Native" }, class: "mono" }, formatCurrency(entry.nativeAmount, entry.currency)),
              h("td", { dataset: { label: "USD" }, class: "mono" }, formatCurrency(entry.usdAmount, "USD")),
              h("td", { dataset: { label: "Status" } }, createStatusPill(entry.status, "ok"))
            )
          )
        )
      )
    );

    return [pills, table];
  }

  const getHourlyRate = (roleId) => {
    if (roleId === "god_mode" || roleId === "tenant_admin") return 85;
    if (roleId === "finance_ops") return 68;
    if (roleId === "guest_viewer") return 0;
    return 60;
  };

  function renderPayrollTab() {
    const rows = slice.teamMembers.map((u) => {
      const uRole = ROLES.find((r) => r.id === u.defaultRoleId);
      const watcher = (slice.activeWatchers ?? []).find((w) => w.userId === u.id);
      const eventSecs = (slice.workEvents ?? []).filter((e) => e.userId === u.id).reduce((s, e) => s + (e.trackedSeconds || 0), 0);
      const totalHours = Number((((watcher?.todaySeconds || 0) + eventSecs) / 3600).toFixed(2));
      const rate = getHourlyRate(u.defaultRoleId);
      const grossPay = Math.round(totalHours * rate);
      return { u, uRole, totalHours, rate, grossPay };
    });
    const totalPayrollUsd = rows.reduce((s, r) => s + r.grossPay, 0);

    return [
      h("section", { class: "card", style: "padding:0.75rem 1rem;" },
        h("div", { style: "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;" },
          h("div", {},
            h("strong", {}, `HR & Payroll Roster (${rows.length} Team Members)`),
            h("div", { class: "mono-meta" }, `Calculated Period Payroll: ${formatCurrency(totalPayrollUsd)} · Based on live tracked work hours`)
          ),
          h("button", {
            type: "button",
            class: "btn btn--primary btn--sm",
            disabled: !canEditFinance,
            onClick: () => showToast(`Approved & queued ${formatCurrency(totalPayrollUsd)} payroll batch for ${rows.length} members`, { tone: "ok" })
          }, "Run Payroll Batch →")
        )
      ),
      h("div", { class: "table-wrapper", tabindex: "0", role: "region", "aria-label": "HR and payroll table" },
        h("table", { class: "data-table" },
          h("thead", {}, h("tr", {},
            h("th", { scope: "col" }, "Team Member"),
            h("th", { scope: "col" }, "Role"),
            h("th", { scope: "col" }, "Hourly Rate"),
            h("th", { scope: "col" }, "Tracked Hours"),
            h("th", { scope: "col" }, "Gross Pay"),
            h("th", { scope: "col" }, "Status")
          )),
          h("tbody", {},
            ...rows.map(({ u, uRole, totalHours, rate, grossPay }) =>
              h("tr", {},
                h("th", { scope: "row" }, h("div", {}, u.name), h("div", { class: "mono-meta" }, u.email)),
                h("td", {}, uRole?.name ?? u.defaultRoleId),
                h("td", { class: "mono" }, rate ? `$${rate}/hr` : "Partner / N/A"),
                h("td", { class: "mono" }, `${totalHours.toFixed(2)}h`),
                h("td", { class: "mono" }, formatCurrency(grossPay)),
                h("td", {}, createStatusPill(rate ? "Payroll Ready" : "External", rate ? "ok" : "info"))
              )
            )
          )
        )
      )
    ];
  }

  function renderTimeTrackingTab() {
    const userSel = h("select", { id: "fin-tt-user", class: "select" },
      ...slice.teamMembers.map((u) => h("option", { value: u.id }, u.name))
    );
    const taskIn = h("input", { id: "fin-tt-task", class: "input", type: "text", placeholder: "Work session description..." });
    const hrsIn = h("input", { id: "fin-tt-hrs", class: "input input--mono", type: "number", step: "0.5", min: "0.5", max: "16", value: "2.0", style: "max-inline-size:90px;" });

    const logForm = h("form", {
      class: "card",
      style: "padding:0.75rem 1rem;",
      onSubmit: (e) => {
        e.preventDefault();
        if (!taskIn.value.trim()) return;
        addWorkEvent({
          title: taskIn.value.trim(),
          scenario: "article",
          userId: userSel.value,
          date: snap.watcherConfig?.referenceToday || "2026-11-25",
          startHour: 10,
          durationHours: Number(hrsIn.value) || 2,
          status: "Completed",
          tool: "Finance Time Tracker"
        });
        showToast("Logged work hours to timesheet & payroll", { tone: "ok" });
      }
    },
      h("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:end;" },
        h("div", { class: "field" }, h("label", { class: "field-label", for: "fin-tt-user" }, "Employee"), userSel),
        h("div", { class: "field", style: "flex:1;" }, h("label", { class: "field-label", for: "fin-tt-task" }, "Task / Deliverable"), taskIn),
        h("div", { class: "field" }, h("label", { class: "field-label", for: "fin-tt-hrs" }, "Hours"), hrsIn),
        h("button", { type: "submit", class: "btn btn--primary btn--sm" }, "+ Log Hours")
      )
    );

    const watchersTable = h("div", { class: "table-wrapper", tabindex: "0", role: "region", "aria-label": "Work hours time tracking" },
      h("table", { class: "data-table" },
        h("thead", {}, h("tr", {},
          h("th", { scope: "col" }, "Employee"),
          h("th", { scope: "col" }, "Active Task"),
          h("th", { scope: "col" }, "Today Tracked"),
          h("th", { scope: "col" }, "Weekly Target"),
          h("th", { scope: "col" }, "Timer")
        )),
        h("tbody", {},
          ...(slice.activeWatchers ?? []).map((w) => {
            const u = slice.teamMembers.find((m) => m.id === w.userId);
            const hrs = ((w.todaySeconds || 0) / 3600).toFixed(2);
            return h("tr", {},
              h("th", { scope: "row" }, u?.name ?? w.userId),
              h("td", {}, w.taskTitle || w.tool),
              h("td", { class: "mono" }, `${hrs}h`),
              h("td", { class: "mono" }, `${w.weekTargetHours || 40}h/wk`),
              h("td", {},
                h("button", {
                  type: "button",
                  class: w.running ? "btn btn--subtle btn--sm" : "btn btn--primary btn--sm",
                  onClick: () => toggleUserWatcher(w.userId)
                }, w.running ? "Pause" : "Start")
              )
            );
          })
        )
      )
    );

    return [logForm, watchersTable];
  }

  const tabs = createTabs({
    ariaLabel: "Finance, HR, Payroll and Time Tracking views",
    initialId: activeFinanceTab,
    onChange: (id) => {
      activeFinanceTab = id;
    },
    tabs: [
      { id: "invoices", label: "Sponsor Invoices", count: slice.invoices.length, render: renderInvoicesTab },
      { id: "ledger", label: "Unified Income Ledger", count: slice.ledgerEntries.length, render: renderLedgerTab },
      { id: "payroll", label: "HR & Payroll", count: slice.teamMembers.length, render: renderPayrollTab },
      { id: "timetracking", label: "Work-Hours Time Tracking", count: (slice.activeWatchers ?? []).length, render: renderTimeTrackingTab }
    ]
  });

  const modGuard = renderModuleVersionGuard("mod-commerce", "Finance & Business Ledger");
  if (!modGuard.enabled) return modGuard.blockedNodes;

  return [header, ...(modGuard.bannerNode ? [modGuard.bannerNode] : []), pnlCards, mixCard, tabs];
}
