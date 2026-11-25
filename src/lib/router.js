import { navigate } from "astro:transitions/client";

export const ROUTES = [
  { id: "command", path: "/", title: "Command Center" },
  { id: "subscriptions", path: "/subscriptions", title: "Manage Subscriptions" },
  { id: "suite", path: "/suite", title: "Suite Modules & Versions" },
  { id: "emulate", path: "/emulate", title: "Emulate & Sandbox" },
  { id: "studio", path: "/studio", title: "Scenario Workbenches" },
  { id: "calendar", path: "/calendar", title: "Mega Calendar" },
  { id: "pipeline", path: "/pipeline", title: "Production Pipeline" },
  { id: "hub", path: "/hub", title: "Content Hub & Organizer" },
  { id: "distribution", path: "/distribution", title: "Distribution" },
  { id: "affiliates", path: "/affiliates", title: "Affiliates & /go Engine" },
  { id: "sponsors", path: "/sponsors", title: "Sponsors & Collabs" },
  { id: "finance", path: "/finance", title: "Finance & Ledger" },
  { id: "system", path: "/system", title: "System & Infrastructure Health" },
  { id: "team", path: "/team", title: "Teams, Leads & Role Delegation" },
  { id: "admin", path: "/admin", title: "Ultimate Master & Multi-Tenancy" },
  { id: "newlifecorp", path: "/newlifecorp", title: "NewLifeCorp SaaS Portal" },
  { id: "register", path: "/register", title: "Register Company — NewLifeCorp" }
];

export function parseRouteFromLocation() {
  const main = document.getElementById("workspace-main");
  const dataRoute = main?.dataset?.route;
  const pathname = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
  const match =
    ROUTES.find((r) => r.id === dataRoute) ??
    ROUTES.find((r) => r.path === pathname) ??
    ROUTES[0];

  return {
    route: match.id,
    meta: match,
    params: new URLSearchParams(window.location.search)
  };
}

export function navigateTo(routeId, queryObj = null) {
  const target = ROUTES.find((r) => r.id === routeId) ?? ROUTES[0];
  const qs = queryObj ? `?${new URLSearchParams(queryObj).toString()}` : "";
  const url = `${target.path}${qs}`;
  try {
    navigate(url);
  } catch {
    window.location.assign(url);
  }
}
