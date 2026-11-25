import { ROLES, TEAM_UNITS, createInitialSeed } from "../data/seed.js";

const STATE_STORAGE_KEY = "godflow:state:v12";

const PERSISTED_DOMAIN_KEYS = [
  "platformData",
  "workspaces",
  "users",
  "infraServices",
  "bullQueues",
  "failedJobs",
  "workflowsToday",
  "pipelineItems",
  "content",
  "socialQueue",
  "channelStatuses",
  "shortLinks",
  "sponsors",
  "invoices",
  "ledgerEntries",
  "automationEvents",
  "workEvents",
  "activeWatchers",
  "watcherConfig",
  "workbenchData",
  "auditLog"
];

let dbStatus = {
  connected: false,
  engine: "Browser LocalStorage Cache",
  dbPath: "data/godflow.sqlite",
  schemaVersion: "11",
  seedCount: 0,
  saveCount: 0,
  updatedAt: null,
  counts: null
};

let dbSyncTimer = null;
let dbDirtyPending = false;
let hydrationInFlight = null;

function canUseHttpDbApi() {
  return (
    typeof fetch === "function" &&
    typeof window !== "undefined" &&
    /^https?:$/i.test(window.location?.protocol || "")
  );
}

function extractDomainPayload(src = state) {
  const out = {};
  for (const key of PERSISTED_DOMAIN_KEYS) {
    if (key in src) {
      out[key] = src[key];
    }
  }
  return out;
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return createInitialSeed();
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !parsed.session ||
      !("activeChannelId" in parsed.session) ||
      !("waterfallLevel" in parsed.session) ||
      !parsed.platformData ||
      !Array.isArray(parsed.platformData.suitePlugins) ||
      !Array.isArray(parsed.platformData.suiteModules) ||
      !Array.isArray(parsed.workspaces) ||
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.channelStatuses) ||
      !Array.isArray(parsed.workEvents) ||
      !Array.isArray(parsed.activeWatchers) ||
      !parsed.watcherConfig ||
      !parsed.workbenchData ||
      !parsed.workbenchData.podcastScript ||
      !parsed.workbenchData.podcastLiveConfig ||
      !parsed.workbenchData.videoStudio ||
      !parsed.workbenchData.gifMaker ||
      !Array.isArray(parsed.content?.videos) ||
      !Array.isArray(parsed.content?.folders) ||
      !parsed.sandbox
    ) {
      return createInitialSeed();
    }
    return parsed;
  } catch {
    return createInitialSeed();
  }
}

let state = loadPersistedState();
const listeners = new Set();

function nowStamp() {
  return new Date().toTimeString().slice(0, 8);
}

function shouldSyncReasonToDb(reason = "") {
  if (state.sandbox?.active) return false;
  if (
    reason === "reset" ||
    reason === "db:hydrate" ||
    reason.startsWith("sandbox:") ||
    reason.startsWith("watcher:") ||
    reason.startsWith("session:") ||
    reason.startsWith("waterfall:")
  ) {
    return reason === "sandbox:commit";
  }
  return true;
}

async function flushDomainStateToSqlite() {
  if (!canUseHttpDbApi() || state.sandbox?.active) return;
  dbDirtyPending = false;
  try {
    const res = await fetch("/api/db/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: extractDomainPayload(state) })
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.ok) {
      dbStatus = {
        connected: true,
        engine: data.engine || "node:sqlite (DatabaseSync WAL)",
        dbPath: data.dbPath || "data/godflow.sqlite",
        schemaVersion: data.schemaVersion || "11",
        seedCount: data.seedCount ?? dbStatus.seedCount,
        saveCount: data.saveCount ?? dbStatus.saveCount,
        updatedAt: data.updatedAt || null,
        counts: data.counts ?? dbStatus.counts
      };
    }
  } catch {
    /* keep working cleanly offline / in static mode */
  }
}

function scheduleSqliteSync() {
  if (!canUseHttpDbApi() || state.sandbox?.active) return;
  dbDirtyPending = true;
  if (dbSyncTimer) clearTimeout(dbSyncTimer);
  dbSyncTimer = setTimeout(() => {
    dbSyncTimer = null;
    void flushDomainStateToSqlite();
  }, 90);
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pagehide", () => {
    if (!dbDirtyPending || state.sandbox?.active || typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return;
    }
    try {
      const blob = new Blob([JSON.stringify({ state: extractDomainPayload(state) })], { type: "application/json" });
      navigator.sendBeacon("/api/db/state", blob);
      dbDirtyPending = false;
    } catch {
      /* ignore */
    }
  });
}

export function getDbStatus() {
  return structuredClone(dbStatus);
}

export async function hydrateStateFromSqlite() {
  if (!canUseHttpDbApi()) return false;
  if (hydrationInFlight) return hydrationInFlight;

  hydrationInFlight = (async () => {
    try {
      const res = await fetch("/api/db/state", { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.ok || !data?.state || !Array.isArray(data.state.workspaces)) return false;

      dbStatus = {
        connected: true,
        engine: data.engine || "node:sqlite (DatabaseSync WAL)",
        dbPath: data.dbPath || "data/godflow.sqlite",
        schemaVersion: data.schemaVersion || "11",
        seedCount: data.seedCount ?? 1,
        saveCount: data.saveCount ?? 0,
        updatedAt: data.updatedAt || null,
        counts: data.counts ?? null
      };

      // Do not overwrite an active interactive Sandbox session mid-edit
      if (!state.sandbox?.active) {
        const hasModernTeams = data.state.workspaces.some((w) => w.teams?.some((t) => Array.isArray(t.assignments)));
        const hasLegacyGaming = data.state.workspaces.some((w) => (w.activeScenarios ?? []).includes("gaming"));
        const hasModernStudioSchema =
          Boolean(data.state.workbenchData?.videoStudio && data.state.workbenchData?.gifMaker) &&
          Array.isArray(data.state.content?.videos) &&
          Array.isArray(data.state.content?.folders) &&
          (data.state.platformData?.saasPlans?.length ?? 0) === 4;
        if (!hasModernTeams || hasLegacyGaming || !hasModernStudioSchema) {
          await flushDomainStateToSqlite();
          return true;
        }
        for (const key of PERSISTED_DOMAIN_KEYS) {
          if (key in data.state) {
            state[key] = data.state[key];
          }
        }
        // Validate active session references exist cleanly in hydrated DB
        if (!state.workspaces.some((w) => w.id === state.session.activeWorkspaceId)) {
          state.session.activeWorkspaceId = state.workspaces[0]?.id ?? "ws-godflow";
          state.session.activeChannelId = "all";
        }
        if (!state.users.some((u) => u.id === state.session.activeUserId)) {
          state.session.activeUserId = state.users[0]?.id ?? "usr-master";
        }
        if (!state.users.some((u) => u.id === state.session.realUserId)) {
          state.session.realUserId = state.users[0]?.id ?? "usr-master";
        }
        try {
          localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
        } catch {
          /* ignore */
        }
        const snapshot = getState();
        for (const fn of listeners) {
          fn(snapshot, "db:hydrate");
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      hydrationInFlight = null;
    }
  })();

  return hydrationInFlight;
}

function buildDefaultSuiteSubscriptions(snapshot = state) {
  const subs = {};
  for (const mod of snapshot?.platformData?.suiteModules ?? []) {
    const track = mod.defaultTrack || "current";
    const meta = mod.versions?.[track] ?? mod.versions?.current;
    subs[mod.id] = {
      enabled: mod.enabledGlobally !== false,
      track,
      installedVersion: meta?.version ?? "1.0.0",
      autoUpgrade: true
    };
  }
  return subs;
}

function recordAudit(action, tone = "info", snapshot = state) {
  const actor = snapshot.users.find((u) => u.id === snapshot.session.activeUserId)?.name ?? "System";
  snapshot.auditLog = [
    {
      id: `aud-${Date.now().toString(36)}`,
      time: nowStamp(),
      actor,
      role: snapshot.session.activeRoleId,
      workspace: snapshot.session.activeWorkspaceId,
      action: snapshot.sandbox?.active ? `[SANDBOX] ${action}` : action,
      tone
    },
    ...(snapshot.auditLog ?? []).slice(0, 24)
  ];
}

function persistAndNotify(reason = "update") {
  if (
    state.sandbox?.active &&
    !reason.startsWith("sandbox:") &&
    !reason.startsWith("watcher:") &&
    reason !== "reset" &&
    reason !== "db:hydrate"
  ) {
    state.sandbox.changesCount = (state.sandbox.changesCount || 0) + 1;
  }
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  if (shouldSyncReasonToDb(reason)) {
    scheduleSqliteSync();
  }
  const snapshot = getState();
  for (const fn of listeners) {
    fn(snapshot, reason);
  }
}

export function getState() {
  return structuredClone(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState() {
  state = createInitialSeed();
  persistAndNotify("reset");
  if (canUseHttpDbApi()) {
    fetch("/api/db/reset", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) {
          dbStatus = {
            connected: true,
            engine: data.engine || "node:sqlite (DatabaseSync WAL)",
            dbPath: data.dbPath || "data/godflow.sqlite",
            schemaVersion: data.schemaVersion || "11",
            seedCount: data.seedCount ?? dbStatus.seedCount,
            saveCount: data.saveCount ?? 0,
            updatedAt: data.updatedAt || null,
            counts: data.counts ?? dbStatus.counts
          };
        }
      })
      .catch(() => {});
  }
}

/* Session, Multi-Tenancy, Multi-Channel & RBAC Selectors */
export function getActiveContext(snapshot = state) {
  const workspace =
    snapshot.workspaces.find((w) => w.id === snapshot.session.activeWorkspaceId) ??
    snapshot.workspaces[0];
  const activeUser =
    snapshot.users.find((u) => u.id === snapshot.session.activeUserId) ?? snapshot.users[0];
  const realUser =
    snapshot.users.find((u) => u.id === snapshot.session.realUserId) ?? snapshot.users[0];
  const role = ROLES.find((r) => r.id === snapshot.session.activeRoleId) ?? ROLES[0];
  const isUltimateMaster =
    Boolean(snapshot.session.ultimateModeEnabled) ||
    role.id === "ultimate_master" ||
    role.permissions.includes("platform:master");
  const isUltimateMaintenance =
    !isUltimateMaster &&
    (role.id === "ultimate_maintenance" || role.permissions.includes("platform:maintenance"));
  const isPlatformOperator = isUltimateMaster || isUltimateMaintenance;
  const isGodMode =
    isUltimateMaster ||
    Boolean(snapshot.session.godModeEnabled) ||
    role.id === "god_mode" ||
    role.permissions.includes("*");
  const isImpersonating =
    snapshot.session.activeUserId !== snapshot.session.realUserId ||
    snapshot.session.activeRoleId !== activeUser.defaultRoleId;

  const tenantScoped = !isGodMode || !snapshot.session.crossTenantView;
  const allChannels = tenantScoped
    ? workspace.channels ?? []
    : snapshot.workspaces.flatMap((w) => w.channels ?? []);

  const isUnrestricted = isGodMode || role.id === "tenant_admin";
  const userChannelIds = activeUser.channelIds ?? [];
  const hasChannelAssignment = userChannelIds.some((cid) => allChannels.some((c) => c.id === cid));
  const channels =
    !isUnrestricted && hasChannelAssignment
      ? allChannels.filter((c) => userChannelIds.includes(c.id))
      : allChannels;

  const requestedChannelId = snapshot.session.activeChannelId || "all";
  let activeChannel =
    requestedChannelId !== "all" ? channels.find((c) => c.id === requestedChannelId) ?? null : null;

  if (!activeChannel && !isUnrestricted && hasChannelAssignment && channels.length === 1) {
    activeChannel = channels[0];
  }

  const channelScoped = Boolean(activeChannel);

  const rawDepth = snapshot.session.waterfallLevel || (isPlatformOperator ? "platform" : "tenant");
  const waterfallLevel = isImpersonating
    ? "user"
    : isPlatformOperator
      ? rawDepth
      : rawDepth === "platform"
        ? "tenant"
        : rawDepth;
  const isMasterPlatformScope = isPlatformOperator && !isImpersonating && waterfallLevel === "platform";

  const isSandbox = Boolean(snapshot.sandbox?.active);
  const sandboxChangesCount = snapshot.sandbox?.changesCount || 0;
  const sandboxLabel = snapshot.sandbox?.label || "Production Live";

  return {
    session: snapshot.session,
    workspace,
    channels,
    activeChannel,
    channelScoped,
    hasChannelRestriction: !isUnrestricted && hasChannelAssignment,
    activeUser,
    realUser,
    role,
    isUltimateMaster,
    isUltimateMaintenance,
    isPlatformOperator,
    isGodMode,
    isImpersonating,
    isSandbox,
    sandboxChangesCount,
    sandboxLabel,
    waterfallLevel,
    isMasterPlatformScope,
    tenantScoped
  };
}

export function getTenantModuleStatus(moduleId, workspaceId = null, snapshot = state) {
  const mod = (snapshot.platformData?.suiteModules ?? []).find((m) => m.id === moduleId);
  if (!mod) return null;
  const ctx = getActiveContext(snapshot);
  const ws = (workspaceId ? snapshot.workspaces.find((w) => w.id === workspaceId) : ctx.workspace) ?? ctx.workspace;
  const fallbackTrack = mod.defaultTrack || "current";
  const fallbackVersion = mod.versions?.[fallbackTrack]?.version ?? "1.0.0";
  const sub = ws?.suiteSubscriptions?.[moduleId] ?? {
    enabled: mod.enabledGlobally !== false,
    track: fallbackTrack,
    installedVersion: fallbackVersion,
    autoUpgrade: true
  };
  const track = ["experimental", "current", "lts"].includes(sub.track) ? sub.track : "current";
  const activeMeta = mod.versions?.[track] ?? mod.versions?.current;
  const globallyEnabled = mod.enabledGlobally !== false;
  const enabled = globallyEnabled && Boolean(sub.enabled);
  const availableVersion = activeMeta?.version ?? sub.installedVersion;
  const installedVersion = sub.installedVersion || availableVersion;
  const upgradeAvailable = Boolean(availableVersion && installedVersion !== availableVersion);

  return {
    module: mod,
    workspace: ws,
    subscription: sub,
    enabled,
    globallyEnabled,
    tenantEnabled: Boolean(sub.enabled),
    track,
    trackLabel: activeMeta?.label ?? track,
    installedVersion,
    availableVersion,
    upgradeAvailable,
    activeMeta,
    autoUpgrade: Boolean(sub.autoUpgrade),
    tone: track === "experimental" ? "warn" : track === "lts" ? "info" : "ok"
  };
}

export function getScopedUsersAndRoles(snapshot = state) {
  const ctx = getActiveContext(snapshot);
  if (ctx.isMasterPlatformScope) {
    return {
      scopedUsers: snapshot.users.filter((u) => u.userScope === "platform"),
      scopedRoles: ROLES.filter((r) => r.scope === "platform")
    };
  }
  const wsUsers = snapshot.users.filter(
    (u) => u.userScope !== "platform" && u.workspaceIds.includes(ctx.workspace.id)
  );
  const tenantRoles = ROLES.filter((r) => r.scope === "tenant");
  if (!ctx.isUltimateMaster && !ctx.isUltimateMaintenance && !ctx.isGodMode && ctx.role.id !== "tenant_admin") {
    return {
      scopedUsers: [ctx.activeUser],
      scopedRoles: [ctx.role]
    };
  }
  return {
    scopedUsers: wsUsers,
    scopedRoles: tenantRoles
  };
}

export function getTenantTeams(workspaceId, snapshot = state) {
  const ws = snapshot.workspaces.find((w) => w.id === workspaceId);
  if (!ws) return [];
  const wsUsers = snapshot.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(ws.id));
  const unitToneMap = Object.fromEntries(TEAM_UNITS.map((u) => [u.id, u.tone]));

  const rawTeams = ws.teams?.length
    ? ws.teams
    : [
        {
          id: `tm-${ws.id}-default`,
          name: `${ws.name} Operations Section`,
          scenario: ws.activeScenarios?.[0] || "article",
          channelIds: (ws.channels ?? []).map((c) => c.id),
          memberIds: wsUsers.map((u) => u.id),
          leadUserId: wsUsers[0]?.id ?? null,
          focus: "Core studio workflows",
          assignments: wsUsers.map((u, idx) => ({
            userId: u.id,
            unit: idx === 0 ? "Team Lead" : "Content Team",
            subRole: idx === 0 ? "Section Lead & Approvals" : u.title || "Content Contributor"
          }))
        }
      ];

  return rawTeams.map((t) => {
    const existingAssigns = Array.isArray(t.assignments) ? t.assignments : [];
    const byUid = new Map(existingAssigns.map((a) => [a.userId, a]));

    const orderedIds = [...new Set([...(t.leadUserId ? [t.leadUserId] : []), ...existingAssigns.map((a) => a.userId), ...(t.memberIds ?? [])])];

    const assignments = orderedIds
      .map((uid) => {
        const user = wsUsers.find((u) => u.id === uid);
        if (!user) return null;
        const rawAssign = byUid.get(uid);
        const isLead = uid === t.leadUserId || rawAssign?.unit === "Team Lead";
        const unit = isLead ? "Team Lead" : rawAssign?.unit || "Content Team";
        const unitMeta = TEAM_UNITS.find((u) => u.id === unit);
        const role = ROLES.find((r) => r.id === user.defaultRoleId) ?? ROLES[ROLES.length - 1];
        return {
          user,
          role,
          unit,
          subRole: rawAssign?.subRole || unitMeta?.defaultSubRole || user.title || role.name,
          isLead,
          unitTone: unitToneMap[unit] || "info"
        };
      })
      .filter(Boolean);

    const teamChannels = (t.channelIds ?? [])
      .map((cid) => (ws.channels ?? []).find((c) => c.id === cid))
      .filter(Boolean);

    const leadUser = assignments.find((a) => a.isLead)?.user ?? assignments[0]?.user ?? null;

    return {
      ...t,
      scenario: t.scenario || "article",
      leadUser,
      channels: teamChannels,
      assignments,
      members: assignments.map((a) => ({
        user: a.user,
        role: a.role,
        unit: a.unit,
        subRole: a.subRole,
        isLead: a.isLead,
        unitTone: a.unitTone
      }))
    };
  });
}

function resolveDefaultChannelId(preferredChannelId = null, snapshot = state) {
  const ctx = getActiveContext(snapshot);
  const channels = ctx.workspace.channels ?? [];
  if (preferredChannelId && channels.some((c) => c.id === preferredChannelId)) {
    return preferredChannelId;
  }
  if (ctx.activeChannel) return ctx.activeChannel.id;
  if (ctx.channels.length) return ctx.channels[0].id;
  return channels[0]?.id ?? null;
}

const MASTER_ONLY_PERMISSIONS = new Set([
  "platform:master",
  "billing:master",
  "tenants:sell",
  "tenants:suspend",
  "impersonate:all",
  "sandbox:commit"
]);

const MAINTENANCE_SHARED_PERMISSIONS = new Set([
  "platform:maintenance",
  "plugins:write",
  "suite:write",
  "emulate:all",
  "system:write",
  "tenants:inspect"
]);

export function can(permission, snapshot = state) {
  const { role, isUltimateMaster, isUltimateMaintenance, isGodMode } = getActiveContext(snapshot);
  if (MASTER_ONLY_PERMISSIONS.has(permission)) {
    return isUltimateMaster;
  }
  if (MAINTENANCE_SHARED_PERMISSIONS.has(permission) && (isUltimateMaster || isUltimateMaintenance)) {
    return true;
  }
  if (isUltimateMaster || isGodMode || role.permissions.includes("*")) return true;
  return role.permissions.includes(permission);
}

export function canAccessRoute(routeId, snapshot = state) {
  if (routeId === "register") return true;
  const { role, isUltimateMaster, isUltimateMaintenance, isGodMode, isMasterPlatformScope } = getActiveContext(snapshot);
  if (isMasterPlatformScope) {
    return isUltimateMaster
      ? ["command", "subscriptions", "suite", "emulate", "admin", "newlifecorp", "system"].includes(routeId)
      : ["command", "subscriptions", "suite", "emulate", "admin", "system"].includes(routeId);
  }
  if (isUltimateMaintenance) {
    return ["command", "subscriptions", "suite", "emulate", "admin", "system", "team"].includes(routeId);
  }
  if (isGodMode || role.permissions.includes("*")) {
    return routeId !== "newlifecorp" || isUltimateMaster;
  }
  return (role.allowedRoutes ?? ["command"]).includes(routeId);
}

export function canAccessTool(toolKey, snapshot = state) {
  const { role, isGodMode } = getActiveContext(snapshot);
  if (isGodMode || role.permissions.includes("*")) return true;
  const tools = role.allowedTools ?? [];
  return tools.includes("*") || tools.includes(toolKey);
}

export function canEditScenario(scenarioId, snapshot = state) {
  const { role, isGodMode } = getActiveContext(snapshot);
  if (isGodMode || role.permissions.includes("*")) return true;
  if (!role.permissions.includes("pipeline:write")) return false;
  return role.scenarios.includes(scenarioId);
}

export function getTenantSlice(snapshot = state) {
  const ctx = getActiveContext(snapshot);
  const wsId = ctx.workspace.id;
  const { role, activeUser, isGodMode } = ctx;
  const isUnrestricted = isGodMode || role.id === "tenant_admin";
  const isGuestViewer = role.id === "guest_viewer";
  const isCreatorSpecialist = role.tier === "creator";

  const visibleChannelIds = new Set(ctx.channels.map((c) => c.id));
  const matchWs = (row) => !ctx.tenantScoped || !row.workspaceId || row.workspaceId === wsId;
  const matchCh = (row) => {
    if (!row.channelId) return true;
    if (ctx.channelScoped) return row.channelId === ctx.activeChannel.id;
    if (ctx.hasChannelRestriction) return visibleChannelIds.has(row.channelId);
    return true;
  };
  const matchScope = (row) => matchWs(row) && matchCh(row);

  const canSeeScenario = (sc) => {
    if (isUnrestricted) return true;
    if (isGuestViewer) return false;
    return role.scenarios.includes(sc);
  };

  let pipelineItems = snapshot.pipelineItems.filter(matchScope);
  let workflowsToday = snapshot.workflowsToday.filter(matchScope);
  let workEvents = (snapshot.workEvents ?? []).filter(matchScope);
  let activeWatchers = (snapshot.activeWatchers ?? []).filter((w) => {
    if (!ctx.tenantScoped) return matchCh(w);
    const u = snapshot.users.find((x) => x.id === w.userId);
    const inWs = (!w.workspaceId || w.workspaceId === wsId) && (!u || u.workspaceIds.includes(wsId));
    return inWs && matchCh(w);
  });

  if (!isUnrestricted) {
    pipelineItems = pipelineItems.filter((p) => canSeeScenario(p.scenario));
    workflowsToday = workflowsToday.filter((w) => canSeeScenario(w.scenario));
    workEvents = workEvents.filter((e) => canSeeScenario(e.scenario));
    if (isGuestViewer) {
      activeWatchers = [];
    } else if (isCreatorSpecialist) {
      activeWatchers = activeWatchers.filter((w) => w.userId === activeUser.id || canSeeScenario(w.scenario));
    }
  }

  let shortLinks = snapshot.shortLinks.filter(matchScope);
  if (isGuestViewer) {
    const emailDomain = activeUser.email.split("@")[1]?.split(".")[0]?.toLowerCase() ?? "";
    shortLinks = shortLinks.filter((l) => l.slug.includes(emailDomain) || l.destination.toLowerCase().includes(emailDomain));
  } else if (role.id === "trader_host") {
    shortLinks = shortLinks.filter((l) => l.category === "Broker & Finance" || l.category === "GodFlow Affiliates");
  } else if (!isUnrestricted && !canAccessRoute("affiliates", snapshot)) {
    shortLinks = [];
  }

  let sponsors = snapshot.sponsors.filter(matchScope);
  let guests = snapshot.guests.filter(matchScope);
  if (isGuestViewer) {
    const emailDomain = activeUser.email.split("@")[1]?.split(".")[0]?.toLowerCase() ?? "";
    sponsors = sponsors.filter((s) => s.contactEmail.toLowerCase().includes(emailDomain) || s.company.toLowerCase().includes(emailDomain));
    guests = guests.filter((g) => g.name === activeUser.name);
  } else if (role.id === "podcast_producer") {
    sponsors = []; // Contract amounts confidential for podcast producer; guest releases remain accessible
  } else if (!isUnrestricted && !can("sponsors:write", snapshot)) {
    sponsors = [];
    guests = [];
  }

  const canReadFinance = isUnrestricted || can("finance:read", snapshot) || can("finance:write", snapshot);
  const invoices = canReadFinance ? snapshot.invoices.filter(matchScope) : [];
  const ledgerEntries = canReadFinance ? snapshot.ledgerEntries.filter(matchScope) : [];

  const broadcasts =
    isUnrestricted || canAccessTool("distribution:email", snapshot)
      ? snapshot.broadcasts.filter(matchScope)
      : [];
  const socialQueue =
    isUnrestricted || canAccessTool("distribution:social", snapshot)
      ? snapshot.socialQueue.filter(matchScope)
      : [];

  const articles =
    isUnrestricted || canAccessTool("hub:articles", snapshot) || canAccessTool("studio:article", snapshot)
      ? snapshot.content.articles.filter(matchScope)
      : [];
  const triliumReadyQueue =
    isUnrestricted || canAccessTool("hub:articles", snapshot)
      ? snapshot.content.triliumReadyQueue.filter(matchScope)
      : [];
  const podcasts =
    isUnrestricted || canAccessTool("hub:podcast", snapshot) || canAccessTool("studio:podcast", snapshot)
      ? snapshot.content.podcasts.filter(matchScope)
      : [];
  const musicReleases =
    isUnrestricted || canAccessTool("hub:music", snapshot) || canAccessTool("studio:music", snapshot)
      ? snapshot.content.musicReleases.filter(matchScope)
      : [];
  const videos =
    isUnrestricted ||
    canAccessTool("hub:videos", snapshot) ||
    canAccessTool("studio:video", snapshot) ||
    canAccessTool("hub:social", snapshot) ||
    canAccessTool("studio:social", snapshot)
      ? (snapshot.content?.videos ?? []).filter(matchScope)
      : [];
  const folders = (snapshot.content?.folders ?? []).filter(
    (f) => !ctx.tenantScoped || !f.workspaceId || f.workspaceId === wsId
  );
  const channelStatuses = isGuestViewer
    ? []
    : (snapshot.channelStatuses ?? []).filter(matchScope);

  const failedJobs = can("system:write", snapshot) ? snapshot.failedJobs.filter(matchScope) : [];
  const automationEvents = isGuestViewer
    ? []
    : snapshot.automationEvents
        .filter(matchScope)
        .filter((e) => isUnrestricted || role.scenarios.some((s) => e.job.toLowerCase().includes(s) || e.source.toLowerCase().includes("trilium") || e.source.toLowerCase().includes("emdash")));

  const teamMembers = isGuestViewer
    ? [activeUser]
    : snapshot.users.filter((u) => {
        if (u.userScope === "platform") return false;
        if (ctx.tenantScoped && !u.workspaceIds.includes(wsId)) return false;
        if (ctx.channelScoped && (u.channelIds ?? []).length > 0 && (ctx.workspace?.channels?.length ?? 0) > 1) {
          return u.channelIds.includes(ctx.activeChannel.id);
        }
        return true;
      });

  return {
    ctx,
    pipelineItems,
    workflowsToday,
    shortLinks,
    sponsors,
    guests,
    invoices,
    ledgerEntries,
    broadcasts,
    socialQueue,
    channelStatuses,
    failedJobs,
    automationEvents,
    articles,
    triliumReadyQueue,
    podcasts,
    musicReleases,
    videos,
    folders,
    teamMembers,
    workEvents,
    activeWatchers
  };
}

export function getDerivedMetrics(snapshot = state) {
  const slice = getTenantSlice(snapshot);
  const ws = slice.ctx.workspace;

  const sponsorSettledUsd = slice.ledgerEntries
    .filter((e) => e.category === "Sponsor Invoice" && e.status === "Settled")
    .reduce((sum, e) => sum + e.usdAmount, 0);

  const affiliateRevenueUsd = slice.ledgerEntries
    .filter((e) => e.category === "Affiliate Payout" && e.status === "Settled")
    .reduce((sum, e) => sum + e.usdAmount, 0);

  const donationsRevenueUsd = slice.ledgerEntries
    .filter((e) => e.category.startsWith("Stream Donation") && e.status === "Settled")
    .reduce((sum, e) => sum + e.usdAmount, 0);

  const monthlyRevenueUsd = sponsorSettledUsd + affiliateRevenueUsd + donationsRevenueUsd;
  const totalAffiliateClicks = slice.shortLinks.reduce((sum, l) => sum + l.clicks, 0);
  const pendingDeliverables = slice.pipelineItems.reduce(
    (sum, item) => sum + item.checklist.filter((c) => !c.done).length,
    0
  );
  const outstandingInvoicesUsd = slice.invoices
    .filter((inv) => inv.status === "Awaiting Settlement" || inv.status === "Overdue")
    .reduce((sum, inv) => sum + inv.usdEquivalent, 0);

  const expensesUsd = slice.ctx.tenantScoped
    ? ws.monthlyExpensesUsd
    : snapshot.workspaces.reduce((s, w) => s + w.monthlyExpensesUsd, 0);

  const netProfitUsd = monthlyRevenueUsd - expensesUsd;

  return {
    monthlyRevenueUsd,
    sponsorSettledUsd,
    affiliateRevenueUsd,
    donationsRevenueUsd,
    totalAffiliateClicks,
    pendingDeliverables,
    outstandingInvoicesUsd,
    expensesUsd,
    netProfitUsd,
    failedJobCount: slice.failedJobs.length
  };
}

/* Auth, Workspace, Channel, Waterfall, User, Role & Master Mutations */
export function switchWorkspace(workspaceId, { enterWaterfall = true } = {}) {
  const target = state.workspaces.find((w) => w.id === workspaceId);
  if (!target) return;
  state.session.activeWorkspaceId = workspaceId;
  state.session.activeChannelId = "all";
  if (enterWaterfall && state.session.waterfallLevel === "platform") {
    state.session.waterfallLevel = "tenant";
  } else if (state.session.waterfallLevel === "channel") {
    state.session.waterfallLevel = "tenant";
  }
  recordAudit(`Switched active tenant workspace to ${target.name} (${target.domain})`, "info");
  persistAndNotify("session:workspace");
}

export function drillIntoTenant(workspaceId) {
  const target = state.workspaces.find((w) => w.id === workspaceId);
  if (!target) return;
  const real = state.users.find((u) => u.id === state.session.realUserId) ?? state.users[0];
  state.session.activeUserId = real.id;
  state.session.activeRoleId = real.defaultRoleId;
  state.session.ultimateModeEnabled = real.defaultRoleId === "ultimate_master";
  state.session.godModeEnabled = ["god_mode", "ultimate_master"].includes(real.defaultRoleId);
  state.session.activeWorkspaceId = target.id;
  state.session.activeChannelId = "all";
  state.session.waterfallLevel = "tenant";
  recordAudit(`Waterfall drill-down → Tenant: ${target.name} (${target.domain})`, "info");
  persistAndNotify("waterfall:tenant");
}

export function drillIntoChannel(channelId, workspaceId = null) {
  if (workspaceId) {
    state.session.activeWorkspaceId = workspaceId;
  }
  const real = state.users.find((u) => u.id === state.session.realUserId) ?? state.users[0];
  if (state.session.activeUserId !== real.id) {
    state.session.activeUserId = real.id;
    state.session.activeRoleId = real.defaultRoleId;
    state.session.ultimateModeEnabled = real.defaultRoleId === "ultimate_master";
    state.session.godModeEnabled = ["god_mode", "ultimate_master"].includes(real.defaultRoleId);
  }
  state.session.activeChannelId = channelId || "all";
  state.session.waterfallLevel = channelId && channelId !== "all" ? "channel" : "tenant";
  const label =
    state.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === channelId)?.name ?? channelId;
  recordAudit(`Waterfall drill-down → Channel: ${label}`, "info");
  persistAndNotify("waterfall:channel");
}

export function drillIntoUser(userId, workspaceId = null) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  if (workspaceId) {
    state.session.activeWorkspaceId = workspaceId;
  } else if (!user.workspaceIds.includes(state.session.activeWorkspaceId)) {
    state.session.activeWorkspaceId = user.workspaceIds[0] ?? state.workspaces[0].id;
  }
  state.session.activeUserId = user.id;
  state.session.activeRoleId = user.defaultRoleId;
  state.session.ultimateModeEnabled = user.defaultRoleId === "ultimate_master";
  state.session.godModeEnabled = ["god_mode", "ultimate_master"].includes(user.defaultRoleId);
  state.session.activeChannelId = "all";
  state.session.waterfallLevel = user.defaultRoleId === "ultimate_master" ? "platform" : "user";
  recordAudit(`Waterfall drill-down → User: ${user.name} (${user.defaultRoleId})`, "warn");
  persistAndNotify("waterfall:user");
}

export function returnToWaterfallLevel(level = "platform") {
  const real = state.users.find((u) => u.id === state.session.realUserId) ?? state.users[0];
  state.session.activeUserId = real.id;
  state.session.activeRoleId = real.defaultRoleId;
  state.session.ultimateModeEnabled = real.defaultRoleId === "ultimate_master";
  state.session.godModeEnabled = ["god_mode", "ultimate_master"].includes(real.defaultRoleId);

  if (level === "platform" && ["ultimate_master", "ultimate_maintenance"].includes(real.defaultRoleId)) {
    state.session.waterfallLevel = "platform";
    state.session.activeChannelId = "all";
    recordAudit("Waterfall step-up → Master Platform Console (All Registered Tenants)", "ok");
  } else if (level === "tenant") {
    state.session.waterfallLevel = "tenant";
    state.session.activeChannelId = "all";
    recordAudit(`Waterfall step-up → Tenant scope (${state.session.activeWorkspaceId})`, "ok");
  } else if (level === "channel") {
    state.session.waterfallLevel = state.session.activeChannelId !== "all" ? "channel" : "tenant";
    recordAudit(`Waterfall step-up → Channel scope (${state.session.activeChannelId})`, "ok");
  }
  persistAndNotify("waterfall:up");
}

export function switchChannel(channelId) {
  state.session.activeChannelId = channelId || "all";
  if (state.session.waterfallLevel !== "platform") {
    state.session.waterfallLevel = channelId && channelId !== "all" ? "channel" : "tenant";
  }
  const label =
    channelId === "all"
      ? "All Channels"
      : state.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === channelId)?.name ?? channelId;
  recordAudit(`Switched channel filter to ${label}`, "info");
  persistAndNotify("session:channel");
}

export function switchUser(userId, { overrideWorkspace = false } = {}) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  const isPlatformUser = user.userScope === "platform";
  if (isPlatformUser) {
    state.session.realUserId = user.id;
  }
  state.session.activeUserId = user.id;
  state.session.activeRoleId = user.defaultRoleId;
  state.session.ultimateModeEnabled = user.defaultRoleId === "ultimate_master";
  state.session.godModeEnabled = user.defaultRoleId === "god_mode" || user.defaultRoleId === "ultimate_master";
  if (!isPlatformUser && (overrideWorkspace || !user.workspaceIds.includes(state.session.activeWorkspaceId))) {
    state.session.activeWorkspaceId = user.workspaceIds[0] ?? state.workspaces[0].id;
  }
  state.session.activeChannelId = "all";
  state.session.waterfallLevel =
    user.userScope === "platform"
      ? "platform"
      : user.id !== state.session.realUserId
        ? "user"
        : "tenant";
  recordAudit(`Switched active user session to ${user.name} (${user.defaultRoleId})`, "info");
  persistAndNotify("session:user");
}

export function switchRole(roleId) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return;
  state.session.activeRoleId = role.id;
  if (role.id === "ultimate_master") {
    state.session.ultimateModeEnabled = true;
    state.session.godModeEnabled = true;
    state.session.waterfallLevel = state.session.waterfallLevel || "platform";
  } else if (role.id === "ultimate_maintenance") {
    state.session.ultimateModeEnabled = false;
    state.session.godModeEnabled = false;
    state.session.waterfallLevel = state.session.waterfallLevel || "platform";
  } else if (role.id === "god_mode") {
    state.session.ultimateModeEnabled = false;
    state.session.godModeEnabled = true;
    if (state.session.waterfallLevel === "platform") state.session.waterfallLevel = "tenant";
  } else {
    state.session.ultimateModeEnabled = false;
    state.session.godModeEnabled = false;
    state.session.crossTenantView = false;
    if (state.session.waterfallLevel === "platform") state.session.waterfallLevel = "user";
  }
  recordAudit(`Switched active RBAC role to ${role.name}`, role.scope === "platform" || role.id === "god_mode" ? "warn" : "info");
  persistAndNotify("session:role");
}

export function toggleUltimateMode() {
  const next = !state.session.ultimateModeEnabled;
  state.session.ultimateModeEnabled = next;
  if (next) {
    state.session.godModeEnabled = true;
    state.session.activeRoleId = "ultimate_master";
    state.session.waterfallLevel = "platform";
    state.session.activeChannelId = "all";
  } else {
    const activeUser = state.users.find((u) => u.id === state.session.activeUserId);
    const fallbackRole = activeUser?.defaultRoleId === "ultimate_master" ? "god_mode" : activeUser?.defaultRoleId ?? "tenant_admin";
    state.session.activeRoleId = fallbackRole;
    state.session.godModeEnabled = fallbackRole === "god_mode";
    state.session.waterfallLevel = "tenant";
    if (!state.session.godModeEnabled) state.session.crossTenantView = false;
  }
  recordAudit(next ? "Activated Ultimate Master mode (Supreme Platform Authority)" : "Exited Ultimate Master elevation", next ? "warn" : "info");
  persistAndNotify("session:ultimate");
}

export function toggleGodMode() {
  const next = !state.session.godModeEnabled;
  state.session.godModeEnabled = next;
  if (next) {
    state.session.activeRoleId = state.session.ultimateModeEnabled ? "ultimate_master" : "god_mode";
    if (!state.session.ultimateModeEnabled && state.session.waterfallLevel === "platform") {
      state.session.waterfallLevel = "tenant";
    }
  } else {
    state.session.ultimateModeEnabled = false;
    const activeUser = state.users.find((u) => u.id === state.session.activeUserId);
    const nonGodFallback = ["ultimate_master", "god_mode"].includes(activeUser?.defaultRoleId) ? "tenant_admin" : activeUser?.defaultRoleId ?? "tenant_admin";
    state.session.activeRoleId = nonGodFallback;
    state.session.waterfallLevel = "tenant";
    state.session.crossTenantView = false;
  }
  recordAudit(next ? "Activated God Mode superuser privileges" : "Deactivated God Mode elevation", next ? "warn" : "info");
  persistAndNotify("session:godmode");
}

export function toggleCrossTenantView() {
  if (!state.session.godModeEnabled && !state.session.ultimateModeEnabled) return;
  state.session.crossTenantView = !state.session.crossTenantView;
  recordAudit(
    state.session.crossTenantView ? "Enabled Cross-Tenant Global Rollup (RLS Bypass)" : "Scoped view to active tenant RLS",
    "info"
  );
  persistAndNotify("session:crosstenant");
}

export function stopImpersonating() {
  const real = state.users.find((u) => u.id === state.session.realUserId) ?? state.users[0];
  state.session.activeUserId = real.id;
  state.session.activeRoleId = real.defaultRoleId;
  state.session.ultimateModeEnabled = real.defaultRoleId === "ultimate_master";
  state.session.godModeEnabled = real.defaultRoleId === "god_mode" || real.defaultRoleId === "ultimate_master";
  state.session.waterfallLevel = real.defaultRoleId === "ultimate_master" ? "platform" : "tenant";
  state.session.activeChannelId = "all";
  recordAudit(`Exited impersonation and restored session for ${real.name}`, "ok");
  persistAndNotify("session:restore");
}

export function setAuthView(view = "public") {
  state.session.authView = view === "login" ? "login" : "public";
  persistAndNotify("session:authview");
}

export function signOutSession({ toPublicHomepage = true } = {}) {
  if (state.sandbox?.active && state.sandbox.productionShadow) {
    state = structuredClone(state.sandbox.productionShadow);
    state.sandbox = {
      active: false,
      label: "Production Live",
      enteredAt: null,
      changesCount: 0,
      productionShadow: null,
      returnSession: null
    };
  }
  recordAudit(toPublicHomepage ? "Signed out to NewLifeCorp Public Homepage" : "Locked session to Demo Login Gate", "info");
  state.session.authenticated = false;
  state.session.authView = toPublicHomepage ? "public" : "login";
  persistAndNotify("session:logout");
}

export function loginSession({ userId, workspaceId, roleId }) {
  const user = state.users.find((u) => u.id === userId) ?? state.users[0];
  const chosenRole = roleId ?? user.defaultRoleId;
  const isPlatformRole = chosenRole === "ultimate_master" || chosenRole === "ultimate_maintenance";
  const chosenWs =
    workspaceId && (user.workspaceIds.includes(workspaceId) || chosenRole === "god_mode" || isPlatformRole)
      ? workspaceId
      : user.workspaceIds[0] ?? state.workspaces[0].id;

  state.session.authenticated = true;
  state.session.authView = "public";
  state.session.realUserId = user.id;
  state.session.activeUserId = user.id;
  state.session.activeRoleId = chosenRole;
  state.session.activeWorkspaceId = chosenWs === "__platform__" ? state.workspaces[0].id : chosenWs;
  state.session.activeChannelId = "all";
  state.session.ultimateModeEnabled = chosenRole === "ultimate_master";
  state.session.godModeEnabled = chosenRole === "god_mode" || chosenRole === "ultimate_master";
  state.session.waterfallLevel = isPlatformRole ? "platform" : "tenant";
  state.session.crossTenantView = false;
  recordAudit(`Signed in as ${user.name} (${chosenRole}) on ${isPlatformRole ? "__platform__" : state.session.activeWorkspaceId}`, "ok");
  persistAndNotify("session:login");
}

/* Sandbox / Working Copy Engine for Safe Tenant, User & Module Testing */
function extractSandboxShadow(src) {
  const copy = structuredClone(src);
  copy.sandbox = {
    active: false,
    label: "Production Live",
    enteredAt: null,
    changesCount: 0,
    productionShadow: null,
    returnSession: null
  };
  return copy;
}

export function enterSandboxWorkingCopy({
  label = "Sandbox Working Copy",
  workspaceId = null,
  channelId = null,
  userId = null,
  roleId = null
} = {}) {
  if (!state.sandbox?.active) {
    const shadow = extractSandboxShadow(state);
    const returnSession = structuredClone(state.session);
    state.sandbox = {
      active: true,
      label,
      enteredAt: nowStamp(),
      changesCount: 0,
      productionShadow: shadow,
      returnSession
    };
  } else if (label) {
    state.sandbox.label = label;
  }

  state.session.authenticated = true;
  if (workspaceId && workspaceId !== "__platform__") {
    const ws = state.workspaces.find((w) => w.id === workspaceId);
    if (ws) state.session.activeWorkspaceId = ws.id;
  }
  state.session.activeChannelId = channelId || "all";

  if (userId) {
    const u = state.users.find((x) => x.id === userId);
    if (u) {
      state.session.activeUserId = u.id;
      const targetRole = roleId || u.defaultRoleId;
      state.session.activeRoleId = targetRole;
      state.session.ultimateModeEnabled = targetRole === "ultimate_master";
      state.session.godModeEnabled = targetRole === "god_mode" || targetRole === "ultimate_master";
      if (u.userScope === "platform" && (!workspaceId || workspaceId === "__platform__")) {
        state.session.waterfallLevel = "platform";
      } else {
        state.session.waterfallLevel = channelId && channelId !== "all" ? "channel" : "user";
      }
    }
  } else if (roleId) {
    state.session.activeRoleId = roleId;
    state.session.ultimateModeEnabled = roleId === "ultimate_master";
    state.session.godModeEnabled = roleId === "god_mode" || roleId === "ultimate_master";
    state.session.waterfallLevel = workspaceId === "__platform__" ? "platform" : channelId && channelId !== "all" ? "channel" : "tenant";
  } else if (workspaceId && workspaceId !== "__platform__") {
    state.session.waterfallLevel = channelId && channelId !== "all" ? "channel" : "tenant";
  }

  recordAudit(`Entered Sandbox Working Copy: ${state.sandbox.label}`, "warn");
  persistAndNotify("sandbox:enter");
}

export function resetSandboxWorkingCopy() {
  if (!state.sandbox?.active || !state.sandbox.productionShadow) return;
  const shadow = state.sandbox.productionShadow;
  const returnSession = state.sandbox.returnSession;
  const curSession = structuredClone(state.session);
  const label = state.sandbox.label;
  state = structuredClone(shadow);
  state.session = curSession;
  state.sandbox = {
    active: true,
    label,
    enteredAt: nowStamp(),
    changesCount: 0,
    productionShadow: shadow,
    returnSession
  };
  recordAudit("Reset Sandbox Working Copy back to clean Production snapshot", "info");
  persistAndNotify("sandbox:reset");
}

export function discardSandboxWorkingCopy() {
  if (!state.sandbox?.active || !state.sandbox.productionShadow) return;
  const restored = structuredClone(state.sandbox.productionShadow);
  const returnSession = state.sandbox.returnSession;
  state = restored;
  if (returnSession) {
    state.session = { ...returnSession, authenticated: true };
  }
  state.sandbox = {
    active: false,
    label: "Production Live",
    enteredAt: null,
    changesCount: 0,
    productionShadow: null,
    returnSession: null
  };
  recordAudit("Discarded Sandbox Working Copy and restored Production state", "ok");
  persistAndNotify("sandbox:discard");
}

export function commitSandboxToProduction() {
  if (!state.sandbox?.active) return;
  const returnSession = state.sandbox.returnSession;
  const count = state.sandbox.changesCount || 0;
  if (returnSession && state.session.activeUserId !== returnSession.activeUserId) {
    state.session = { ...returnSession, authenticated: true };
  }
  state.sandbox = {
    active: false,
    label: "Production Live",
    enteredAt: null,
    changesCount: 0,
    productionShadow: null,
    returnSession: null
  };
  recordAudit(`Committed ${count} Sandbox Working Copy changes into Production`, "warn");
  persistAndNotify("sandbox:commit");
}

export function createWorkspace({ name, domain, plan, activeScenarios }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const id = `ws-${Date.now().toString(36)}`;
  const mainChId = `ch-${slug}-main`;
  const ws = {
    id,
    name,
    slug,
    domain,
    shortDomain: `go.${domain}`,
    plan: plan || "Growth Multi-Channel",
    monthlyPriceUsd: plan === "Custom Enterprise Plan" ? 0 : 399,
    seatLimit: 18,
    subscriptionStatus: "Active",
    region: "us-east (PG17 Multi-Tenant)",
    activeScenarios: activeScenarios?.length ? activeScenarios : ["stock", "video", "article", "social"],
    newsletterSubscribers: 1200,
    newsletterDeltaMonth: 120,
    newsletterOpenRate: 44.0,
    monthlyExpensesUsd: 490,
    storageUsedGb: 24,
    storageQuotaGb: 1000,
    channels: [
      {
        id: mainChId,
        workspaceId: id,
        name: `${name} Main`,
        slug: `${slug}-main`,
        badge: slug.slice(0, 8).toUpperCase(),
        tone: "info",
        domain,
        shortDomain: `go.${domain}`,
        websiteUrl: `https://${domain}`,
        rssUrl: `https://${domain}/rss.xml`,
        tagline: "Flagship web & media channel",
        capabilities: ["podcasts", "articles", "website", "social"],
        scenarios: activeScenarios?.length ? activeScenarios : ["article", "podcast", "social"],
        socialHandles: [domain],
        monthlyVisitors: 4200,
        subscribers: 1200,
        websiteSummary: `Autonomous publishing portal on ${domain}.`
      }
    ],
    teams: [
      {
        id: `tm-${slug}-core`,
        name: `${name} Production Team`,
        channelIds: [mainChId],
        memberIds: [],
        leadUserId: null,
        focus: "Primary workspace studio workflows"
      }
    ],
    flags: {
      etapiSync: true,
      btcpayLightning: true,
      postizAutopublish: true,
      publicMediaKit: true,
      maintenanceMode: false
    },
    suiteSubscriptions: buildDefaultSuiteSubscriptions(state)
  };
  state.workspaces = [...state.workspaces, ws];
  const creator = state.users.find((u) => u.id === state.session.activeUserId && u.userScope === "tenant");
  if (creator && !creator.workspaceIds.includes(id)) {
    creator.workspaceIds.push(id);
    ws.teams[0].memberIds = [creator.id];
    ws.teams[0].leadUserId = creator.id;
  }
  state.session.activeWorkspaceId = id;
  state.session.activeChannelId = "all";
  state.session.waterfallLevel = "tenant";
  recordAudit(`Provisioned new tenant workspace ${name} (${domain})`, "ok");
  persistAndNotify("workspace:create");
  return ws;
}

export function registerCompanyOnNewLifeCorp({
  companyName,
  domain,
  planId = "plan-growth",
  ownerName,
  ownerEmail,
  channels = [],
  activeScenarios = ["stock", "podcast", "article", "social"],
  teamMembers = [],
  autoSignIn = true
}) {
  const cleanDomain = (domain || `${companyName}.io`)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
  const wsId = `ws-${slug.slice(0, 12)}-${Date.now().toString(36).slice(-4)}`;
  const plan =
    state.platformData.saasPlans.find((p) => p.id === planId) ??
    state.platformData.saasPlans[1] ??
    state.platformData.saasPlans[0];

  const resolvedChannels = (channels.length ? channels : [{ name: `${companyName} Flagship`, domain: cleanDomain, capabilities: ["shorts", "podcasts", "articles", "website", "social"] }]).map(
    (ch, idx) => {
      const chName = (ch.name || `${companyName} Channel ${idx + 1}`).trim();
      const chSlug = chName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const chDomain = (ch.domain || (idx === 0 ? cleanDomain : `${chSlug}.${cleanDomain}`))
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      return {
        id: `ch-${chSlug}-${Date.now().toString(36).slice(-3)}${idx}`,
        workspaceId: wsId,
        name: chName,
        slug: chSlug,
        badge: chName.toUpperCase().slice(0, 12),
        tone: idx % 2 === 0 ? "ok" : "info",
        domain: chDomain,
        shortDomain: `go.${chDomain}`,
        websiteUrl: `https://${chDomain}`,
        rssUrl: `https://castopod.${chDomain}/@feed/feed.xml`,
        tagline: ch.tagline || `${chName} multi-format publishing & social distribution channel`,
        capabilities: ch.capabilities?.length ? ch.capabilities : ["shorts", "posts", "statuses", "podcasts", "articles", "website", "social"],
        scenarios: activeScenarios.length ? activeScenarios : ["podcast", "article", "social"],
        socialHandles: [`@${chSlug}`, chDomain],
        monthlyVisitors: 1000,
        subscribers: 250,
        websiteSummary: `Customer-configured NewLifeCorp website on ${chDomain}.`
      };
    }
  );

  const ws = {
    id: wsId,
    name: companyName.trim(),
    slug,
    domain: cleanDomain,
    shortDomain: `go.${cleanDomain}`,
    plan: plan.name,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    seatLimit: plan.seatLimit,
    subscriptionStatus: "Active",
    ownerEmail: ownerEmail.trim(),
    renewalDate: "2026-12-25",
    region: "us-east (NewLifeCorp Managed PG17 RLS)",
    activeScenarios: activeScenarios.length ? activeScenarios : ["article", "podcast", "social"],
    newsletterSubscribers: 500,
    newsletterDeltaMonth: 500,
    newsletterOpenRate: 49.0,
    monthlyExpensesUsd: plan.monthlyPriceUsd,
    storageUsedGb: 12,
    storageQuotaGb: plan.storageGb,
    channels: resolvedChannels,
    flags: {
      etapiSync: true,
      btcpayLightning: true,
      postizAutopublish: true,
      publicMediaKit: true,
      maintenanceMode: false
    },
    suiteSubscriptions: buildDefaultSuiteSubscriptions(state)
  };

  state.workspaces = [ws, ...state.workspaces];

  const makeInitials = (full) =>
    full
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CO";

  const channelIdList = resolvedChannels.map((c) => c.id);
  const ownerUser = {
    id: `usr-${Date.now().toString(36)}`,
    name: ownerName.trim(),
    initials: makeInitials(ownerName),
    email: ownerEmail.trim(),
    title: `Company Founder · ${companyName.trim()}`,
    userScope: "tenant",
    defaultRoleId: "tenant_admin",
    workspaceIds: [wsId],
    channelIds: channelIdList,
    primaryScenarios: ws.activeScenarios,
    presence: "Configured via NewLifeCorp",
    passkeyEnabled: true
  };

  const invitedUsers = teamMembers
    .filter((m) => m.name && m.email)
    .map((m, idx) => {
      const rObj = ROLES.find((r) => r.id === m.roleId);
      return {
        id: `usr-${Date.now().toString(36)}-t${idx}`,
        name: m.name.trim(),
        initials: makeInitials(m.name),
        email: m.email.trim(),
        title: m.title || rObj?.name || "Team Specialist",
        userScope: "tenant",
        defaultRoleId: m.roleId || "editor_newsletter",
        workspaceIds: [wsId],
        channelIds: m.channelId ? [m.channelId] : channelIdList,
        primaryScenarios: rObj?.scenarios?.length ? rObj.scenarios : ["article"],
        presence: "Invited",
        passkeyEnabled: false
      };
    });

  state.users = [...state.users, ownerUser, ...invitedUsers];

  ws.teams = [
    {
      id: `tm-${wsId}-leadership`,
      name: `${companyName.trim()} Leadership & Ops Team`,
      channelIds: channelIdList,
      memberIds: [ownerUser.id],
      leadUserId: ownerUser.id,
      focus: "Company admin, SaaS billing & cross-channel approvals"
    },
    ...(invitedUsers.length
      ? [
          {
            id: `tm-${wsId}-creators`,
            name: `${companyName.trim()} Channel Production Team`,
            channelIds: channelIdList,
            memberIds: invitedUsers.map((u) => u.id),
            leadUserId: invitedUsers[0].id,
            focus: "Channel content workflows & scheduled releases"
          }
        ]
      : [])
  ];

  // Give starter operational records in the new tenant so their dashboard isn't blank
  const firstCh = resolvedChannels[0];
  state.workflowsToday = [
    {
      id: `wf-${wsId}-1`,
      workspaceId: wsId,
      channelId: firstCh.id,
      scenario: ws.activeScenarios[0] || "article",
      ownerUserId: ownerUser.id,
      title: `${companyName.trim()} Launch Dispatch & Channel Setup`,
      schedule: "Today · Live",
      status: "Ready",
      statusTone: "ok",
      meta: `${firstCh.domain} · ${resolvedChannels.length} channels provisioned`,
      pipelineId: `pipe-${wsId}-1`
    },
    ...state.workflowsToday
  ];

  state.pipelineItems = [
    {
      id: `pipe-${wsId}-1`,
      workspaceId: wsId,
      channelId: firstCh.id,
      ownerUserId: ownerUser.id,
      title: `Launch ${firstCh.name} (${firstCh.domain}) + Team Onboarding`,
      scenario: ws.activeScenarios[0] || "article",
      stage: "hub",
      dueDate: "2026-11-28",
      triliumNoteId: `tril-${Math.floor(9100 + Math.random() * 800)}`,
      emdashSlug: `${slug}-launch`,
      toolLabel: "NewLifeCorp Onboarding",
      affiliateSlugs: [`${slug}-partner`],
      checklist: [
        { id: `chk-${wsId}-1`, label: "Provision custom domain & TLS routes", done: true },
        { id: `chk-${wsId}-2`, label: "Configure initial RBAC team roles & channels", done: true },
        { id: `chk-${wsId}-3`, label: "Publish first status / article", done: false }
      ],
      repurposing: [
        { id: `rep-${wsId}-1`, channel: `${firstCh.domain} Website`, format: "Launch Page", status: "Published" },
        { id: `rep-${wsId}-2`, channel: "Social Queue", format: "Announcement Thread", status: "Pending" }
      ]
    },
    ...state.pipelineItems
  ];

  state.shortLinks = [
    {
      id: `lnk-${wsId}-1`,
      workspaceId: wsId,
      channelId: firstCh.id,
      slug: `${slug}-partner`,
      category: "Partner Links",
      destination: `https://${firstCh.domain}/start`,
      clicks: 1,
      convRate: 0,
      estRevenueUsd: 0,
      active: true,
      spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    },
    ...state.shortLinks
  ];

  state.platformData.enterpriseLeads = [
    {
      id: `lead-${Date.now().toString(36)}`,
      companyName: companyName.trim(),
      domain: cleanDomain,
      contactName: ownerName.trim(),
      contactEmail: ownerEmail.trim(),
      planId: plan.id,
      planName: plan.name,
      monthlyPriceUsd: plan.monthlyPriceUsd,
      channelsRequested: resolvedChannels.map((c) => `${c.name} (${c.domain})`),
      scenarios: ws.activeScenarios,
      teamSize: 1 + invitedUsers.length,
      status: "Live Tenant",
      workspaceId: wsId,
      createdAt: "just now"
    },
    ...state.platformData.enterpriseLeads
  ];

  if (autoSignIn) {
    state.session.authenticated = true;
    state.session.realUserId = ownerUser.id;
    state.session.activeUserId = ownerUser.id;
    state.session.activeRoleId = "tenant_admin";
    state.session.activeWorkspaceId = wsId;
    state.session.activeChannelId = "all";
    state.session.waterfallLevel = "tenant";
    state.session.ultimateModeEnabled = false;
    state.session.godModeEnabled = false;
    state.session.crossTenantView = false;
  }

  recordAudit(`NewLifeCorp registered customer company "${companyName}" (${cleanDomain}) on ${plan.name}`, "ok");
  persistAndNotify("platform:signup");
  return { workspace: ws, ownerUser, invitedUsers, plan };
}

export function convertLeadToTenant(leadId) {
  const lead = state.platformData.enterpriseLeads.find((l) => l.id === leadId);
  if (!lead) return null;
  if (lead.status === "Live Tenant" && lead.workspaceId) {
    drillIntoTenant(lead.workspaceId);
    return lead.workspaceId;
  }
  const channels = (lead.channelsRequested ?? []).map((label, i) => ({
    name: label.split("(")[0].trim() || `${lead.companyName} Ch ${i + 1}`,
    domain: i === 0 ? lead.domain : `${lead.domain.split(".")[0]}-${i + 1}.fm`,
    capabilities: ["shorts", "posts", "podcasts", "articles", "website", "social"]
  }));
  const res = registerCompanyOnNewLifeCorp({
    companyName: lead.companyName,
    domain: lead.domain,
    planId: lead.planId,
    ownerName: lead.contactName,
    ownerEmail: lead.contactEmail,
    channels,
    activeScenarios: lead.scenarios,
    teamMembers: [],
    autoSignIn: false
  });
  state.platformData.enterpriseLeads = state.platformData.enterpriseLeads.map((l) =>
    l.id === leadId ? { ...l, status: "Live Tenant", workspaceId: res.workspace.id } : l
  );
  // Keep NewLifeCorp Master on lead conversion instead of replacing signed-in master user
  state.session.activeWorkspaceId = res.workspace.id;
  recordAudit(`Ultimate Master converted lead "${lead.companyName}" into live tenant`, "ok");
  persistAndNotify("platform:convert");
  return res.workspace.id;
}

export function updateTenantCommercials(workspaceId, { plan, monthlyPriceUsd, seatLimit, subscriptionStatus }) {
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    return {
      ...ws,
      ...(plan !== undefined ? { plan } : {}),
      ...(monthlyPriceUsd !== undefined ? { monthlyPriceUsd: Number(monthlyPriceUsd) } : {}),
      ...(seatLimit !== undefined ? { seatLimit: Number(seatLimit) } : {}),
      ...(subscriptionStatus !== undefined ? { subscriptionStatus } : {})
    };
  });
  recordAudit(`Ultimate Master updated commercial contract for tenant ${workspaceId}`, "warn");
  persistAndNotify("workspace:commercials");
}

export function toggleWorkspaceSuspended(workspaceId) {
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    const nextSuspended = ws.subscriptionStatus !== "Suspended";
    return {
      ...ws,
      subscriptionStatus: nextSuspended ? "Suspended" : "Active",
      flags: { ...ws.flags, maintenanceMode: nextSuspended }
    };
  });
  recordAudit(`Ultimate Master toggled suspension lock on tenant ${workspaceId}`, "warn");
  persistAndNotify("workspace:suspend");
}

export function addChannelToWorkspace(workspaceId, { name, domain, websiteSummary, capabilities, scenarios, tone = "info" }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const cleanDomain = (domain || `${slug}.fm`).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const ch = {
    id: `ch-${slug}-${Date.now().toString(36).slice(-3)}`,
    workspaceId,
    name,
    slug,
    badge: name.toUpperCase().slice(0, 12),
    tone,
    domain: cleanDomain,
    shortDomain: `go.${cleanDomain}`,
    websiteUrl: `https://${cleanDomain}`,
    rssUrl: `https://castopod.${cleanDomain}/@feed/feed.xml`,
    tagline: websiteSummary || "Multi-format publishing channel",
    capabilities: capabilities?.length ? capabilities : ["shorts", "posts", "podcasts", "articles", "website", "social"],
    scenarios: scenarios?.length ? scenarios : ["podcast", "article", "social"],
    socialHandles: [`@${slug}`, cleanDomain],
    monthlyVisitors: 2500,
    subscribers: 850,
    websiteSummary: websiteSummary || `Dedicated channel portal & feed at ${cleanDomain}.`
  };
  state.workspaces = state.workspaces.map((ws) =>
    ws.id === workspaceId ? { ...ws, channels: [...(ws.channels ?? []), ch] } : ws
  );
  recordAudit(`Added channel "${name}" (${cleanDomain}) to workspace ${workspaceId}`, "ok");
  persistAndNotify("channel:add");
  return ch;
}

export function toggleTenantFlag(workspaceId, flagKey) {
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    return {
      ...ws,
      flags: { ...ws.flags, [flagKey]: !ws.flags[flagKey] }
    };
  });
  recordAudit(`Toggled feature flag ${flagKey} on tenant ${workspaceId}`, "warn");
  persistAndNotify("workspace:flag");
}

export function toggleSuitePlugin(pluginId) {
  state.platformData.suitePlugins = (state.platformData.suitePlugins ?? []).map((p) =>
    p.id === pluginId ? { ...p, enabled: !p.enabled, health: !p.enabled ? "Healthy · Re-enabled" : "Disabled by Operator" } : p
  );
  recordAudit(`Platform Operator toggled suite plugin ${pluginId}`, "warn");
  persistAndNotify("platform:plugin");
}

export function toggleSuiteConfig(configKey) {
  state.platformData.suiteConfigs = (state.platformData.suiteConfigs ?? []).map((c) =>
    c.key === configKey ? { ...c, value: !c.value } : c
  );
  recordAudit(`Platform Operator toggled suite config ${configKey}`, "warn");
  persistAndNotify("platform:config");
}

export function updateSuiteConfigValue(configKey, nextValue) {
  state.platformData.suiteConfigs = (state.platformData.suiteConfigs ?? []).map((c) =>
    c.key === configKey ? { ...c, value: nextValue } : c
  );
  recordAudit(`Platform Operator updated suite config ${configKey} → ${nextValue}`, "info");
  persistAndNotify("platform:config-val");
}

/* Suite 3-Version Modules (Experimental / Current / LTS) & Site-Wide Rollout Engine */
function bumpSemver(ver, track) {
  const clean = String(ver || "1.0.0").split("-")[0];
  const parts = clean.split(".").map((n) => Number(n) || 0);
  while (parts.length < 3) parts.push(0);
  if (track === "experimental") {
    const expMatch = String(ver || "").match(/-exp\.(\d+)/);
    if (expMatch) {
      return `${parts[0]}.${parts[1]}.${parts[2]}-exp.${Number(expMatch[1]) + 1}`;
    }
    return `${parts[0]}.${parts[1] + 1}.0-exp.1`;
  }
  if (track === "current") {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}-current`;
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}-lts`;
}

export function toggleModuleGlobalEnabled(moduleId) {
  let modName = moduleId;
  let nextVal = true;
  state.platformData.suiteModules = (state.platformData.suiteModules ?? []).map((m) => {
    if (m.id !== moduleId) return m;
    modName = m.name;
    nextVal = m.enabledGlobally === false;
    return { ...m, enabledGlobally: nextVal };
  });
  recordAudit(`Platform ${nextVal ? "enabled" : "disabled"} suite module "${modName}" globally`, "warn");
  persistAndNotify("suite:global-toggle");
}

export function toggleTenantModuleEnabled(workspaceId, moduleId) {
  const mod = (state.platformData.suiteModules ?? []).find((m) => m.id === moduleId);
  if (!mod) return;
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    const prevSubs = ws.suiteSubscriptions ?? buildDefaultSuiteSubscriptions(state);
    const cur = prevSubs[moduleId] ?? {
      enabled: true,
      track: mod.defaultTrack || "current",
      installedVersion: mod.versions?.[mod.defaultTrack || "current"]?.version ?? "1.0.0",
      autoUpgrade: true
    };
    const nextEnabled = !cur.enabled;
    return {
      ...ws,
      suiteSubscriptions: {
        ...prevSubs,
        [moduleId]: { ...cur, enabled: nextEnabled }
      }
    };
  });
  recordAudit(`Updated module assignment ${moduleId} for tenant ${workspaceId}`, "info");
  persistAndNotify("suite:tenant-assign");
}

export function setTenantModuleTrack(workspaceId, moduleId, track) {
  if (!["experimental", "current", "lts"].includes(track)) return;
  const mod = (state.platformData.suiteModules ?? []).find((m) => m.id === moduleId);
  if (!mod) return;
  const targetVersion = mod.versions?.[track]?.version ?? mod.versions?.current?.version ?? "1.0.0";
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    const prevSubs = ws.suiteSubscriptions ?? buildDefaultSuiteSubscriptions(state);
    const cur = prevSubs[moduleId] ?? { enabled: true, track, installedVersion: targetVersion, autoUpgrade: true };
    return {
      ...ws,
      suiteSubscriptions: {
        ...prevSubs,
        [moduleId]: {
          ...cur,
          enabled: true,
          track,
          installedVersion: targetVersion
        }
      }
    };
  });
  recordAudit(`Tenant ${workspaceId} switched ${mod.name} → ${track.toUpperCase()} (${targetVersion})`, "ok");
  persistAndNotify("suite:tenant-track");
}

export function toggleTenantModuleAutoUpgrade(workspaceId, moduleId) {
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    const prevSubs = ws.suiteSubscriptions ?? buildDefaultSuiteSubscriptions(state);
    const cur = prevSubs[moduleId];
    if (!cur) return ws;
    return {
      ...ws,
      suiteSubscriptions: {
        ...prevSubs,
        [moduleId]: { ...cur, autoUpgrade: !cur.autoUpgrade }
      }
    };
  });
  persistAndNotify("suite:auto-upgrade");
}

export function setTenantAllModulesTrack(workspaceId, track) {
  if (!["experimental", "current", "lts"].includes(track)) return;
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    const prevSubs = ws.suiteSubscriptions ?? buildDefaultSuiteSubscriptions(state);
    const nextSubs = { ...prevSubs };
    for (const mod of state.platformData.suiteModules ?? []) {
      const targetVersion = mod.versions?.[track]?.version ?? "1.0.0";
      const existing = nextSubs[mod.id] ?? { enabled: true, autoUpgrade: true };
      nextSubs[mod.id] = {
        ...existing,
        track,
        installedVersion: targetVersion
      };
    }
    return { ...ws, suiteSubscriptions: nextSubs };
  });
  recordAudit(`Applied ${track.toUpperCase()} track policy across all subscribed modules for ${workspaceId}`, "ok");
  persistAndNotify("suite:tenant-preset");
}

export function releaseNextModuleVersion(moduleId, track = "experimental", note = "") {
  const mod = (state.platformData.suiteModules ?? []).find((m) => m.id === moduleId);
  if (!mod || !["experimental", "current", "lts"].includes(track)) return null;
  const curMeta = mod.versions[track];
  const nextVer = bumpSemver(curMeta.version, track);
  const nextFeatures = note
    ? [note, ...(curMeta.features ?? []).slice(0, 3)]
    : [...(curMeta.features ?? [])];

  mod.versions[track] = {
    ...curMeta,
    version: nextVer,
    releasedAt: state.watcherConfig?.referenceToday ?? "2026-11-25",
    features: nextFeatures
  };

  let upgradedTenants = 0;
  state.workspaces = state.workspaces.map((ws) => {
    const subs = ws.suiteSubscriptions ?? {};
    const sub = subs[moduleId];
    if (!sub || !sub.enabled || sub.track !== track || !sub.autoUpgrade) return ws;
    upgradedTenants += 1;
    return {
      ...ws,
      suiteSubscriptions: {
        ...subs,
        [moduleId]: { ...sub, installedVersion: nextVer }
      }
    };
  });

  state.automationEvents = [
    {
      id: `evt-${Date.now().toString(36)}`,
      workspaceId: state.session.activeWorkspaceId,
      source: "NewLifeCorp Suite CD",
      job: `Released ${mod.name} [${track}] ${nextVer} → auto-upgraded ${upgradedTenants} tenant(s)`,
      status: "Rolled Out",
      time: "just now",
      tone: "ok"
    },
    ...(state.automationEvents ?? []).slice(0, 11)
  ];
  recordAudit(`Released ${mod.name} (${track}: ${nextVer}); auto-upgraded ${upgradedTenants} tenants`, "ok");
  persistAndNotify("suite:release");
  return { version: nextVer, upgradedTenants };
}

export function promoteModuleVersion(moduleId, fromTrack, toTrack) {
  const mod = (state.platformData.suiteModules ?? []).find((m) => m.id === moduleId);
  if (!mod || !mod.versions?.[fromTrack] || !mod.versions?.[toTrack]) return null;
  const baseVer = String(mod.versions[fromTrack].version).split("-")[0];
  const promotedVer = toTrack === "current" ? `${baseVer}-current` : `${baseVer}-lts`;
  const targetLabel = toTrack === "current" ? "Current (Subscribed)" : "LTS (Stable)";

  mod.versions[toTrack] = {
    ...mod.versions[fromTrack],
    version: promotedVer,
    label: targetLabel,
    releasedAt: state.watcherConfig?.referenceToday ?? "2026-11-25"
  };

  let upgradedTenants = 0;
  state.workspaces = state.workspaces.map((ws) => {
    const subs = ws.suiteSubscriptions ?? {};
    const sub = subs[moduleId];
    if (!sub || !sub.enabled || sub.track !== toTrack || !sub.autoUpgrade) return ws;
    upgradedTenants += 1;
    return {
      ...ws,
      suiteSubscriptions: {
        ...subs,
        [moduleId]: { ...sub, installedVersion: promotedVer }
      }
    };
  });

  recordAudit(`Promoted ${mod.name} from ${fromTrack} → ${toTrack} (${promotedVer}), upgraded ${upgradedTenants} tenants`, "ok");
  persistAndNotify("suite:promote");
  return { version: promotedVer, upgradedTenants };
}

export function rolloutModuleUpgradeToAllTenants(moduleId, trackFilter = "all") {
  const mod = (state.platformData.suiteModules ?? []).find((m) => m.id === moduleId);
  if (!mod) return 0;
  let count = 0;
  state.workspaces = state.workspaces.map((ws) => {
    const prevSubs = ws.suiteSubscriptions ?? buildDefaultSuiteSubscriptions(state);
    const sub = prevSubs[moduleId];
    if (!sub || !sub.enabled) return ws;
    if (trackFilter !== "all" && sub.track !== trackFilter) return ws;
    const targetVer = mod.versions?.[sub.track]?.version ?? sub.installedVersion;
    if (sub.installedVersion !== targetVer) count += 1;
    return {
      ...ws,
      suiteSubscriptions: {
        ...prevSubs,
        [moduleId]: { ...sub, installedVersion: targetVer }
      }
    };
  });
  recordAudit(`Rolled out latest ${mod.name} updates across ${count} pending tenant subscriptions`, "ok");
  persistAndNotify("suite:rollout");
  return count;
}

export function updateSuiteModuleConfig(moduleId, configKey, nextValue) {
  state.platformData.suiteModules = (state.platformData.suiteModules ?? []).map((m) =>
    m.id === moduleId ? { ...m, config: { ...(m.config ?? {}), [configKey]: nextValue } } : m
  );
  recordAudit(`Updated ${moduleId} config "${configKey}" = ${nextValue}`, "info");
  persistAndNotify("suite:config");
}

/* Tenant User & Team Subscription Management */
export function assignUserTeamAndChannels(workspaceId, userId, { teamId = null, channelIds = null, roleId = null }) {
  state.users = state.users.map((u) => {
    if (u.id !== userId) return u;
    return {
      ...u,
      ...(roleId ? { defaultRoleId: roleId } : {}),
      ...(Array.isArray(channelIds) ? { channelIds } : {}),
      workspaceIds: u.workspaceIds.includes(workspaceId) ? u.workspaceIds : [...u.workspaceIds, workspaceId]
    };
  });
  if (teamId) {
    state.workspaces = state.workspaces.map((ws) => {
      if (ws.id !== workspaceId || !ws.teams?.length) return ws;
      return {
        ...ws,
        teams: ws.teams.map((t) => {
          const withoutUser = (t.memberIds ?? []).filter((id) => id !== userId);
          return t.id === teamId ? { ...t, memberIds: [...withoutUser, userId] } : { ...t, memberIds: withoutUser };
        })
      };
    });
  }
  if (roleId && state.session.activeUserId === userId) {
    state.session.activeRoleId = roleId;
  }
  recordAudit(`Updated team/channel/role subscription for user ${userId} in ${workspaceId}`, "info");
  persistAndNotify("subscriptions:user");
}

export function toggleUserSuspended(userId) {
  let targetName = userId;
  let nextSusp = false;
  state.users = state.users.map((u) => {
    if (u.id !== userId || u.userScope === "platform") return u;
    targetName = u.name;
    nextSusp = !u.suspended;
    return { ...u, suspended: nextSusp, presence: nextSusp ? "Suspended" : "Online" };
  });
  recordAudit(`${nextSusp ? "Suspended" : "Reactivated"} user seat "${targetName}"`, "warn");
  persistAndNotify("subscriptions:user-suspend");
}

export function inviteTeamMember({ name, email, title, roleId, workspaceId, scenarios, teamId = null, unit = "Content Team", subRole = "" }) {
  const targetWsId = workspaceId || state.session.activeWorkspaceId;
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const newUser = {
    id: `usr-${Date.now().toString(36)}`,
    name,
    initials: initials || "TM",
    email,
    title: title || "Creator Specialist",
    userScope: "tenant",
    defaultRoleId: roleId,
    workspaceIds: [targetWsId],
    primaryScenarios: scenarios?.length ? scenarios : ["social"],
    presence: "Invited",
    passkeyEnabled: false
  };
  state.users = [...state.users, newUser];
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== targetWsId || !ws.teams?.length) return ws;
    const targetTeamId = teamId && ws.teams.some((t) => t.id === teamId) ? teamId : ws.teams[0].id;
    return {
      ...ws,
      teams: ws.teams.map((t) => {
        if (t.id !== targetTeamId) return t;
        const unitMeta = TEAM_UNITS.find((u) => u.id === unit);
        const nextAssign = [
          ...(Array.isArray(t.assignments) ? t.assignments : []),
          { userId: newUser.id, unit: unit || "Content Team", subRole: subRole || title || unitMeta?.defaultSubRole || "Team Contributor" }
        ];
        return {
          ...t,
          ...(unit === "Team Lead" ? { leadUserId: newUser.id } : {}),
          memberIds: [...new Set([...(t.memberIds ?? []), newUser.id])],
          assignments: nextAssign
        };
      })
    };
  });
  recordAudit(`Invited ${name} (${email}) as ${roleId} → ${unit}`, "ok");
  persistAndNotify("team:invite");
  return newUser;
}

export function createTeamSection(workspaceId, { name, scenario = "article", leadUserId = null, focus = "", channelIds = null }) {
  const slug = String(name || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "section";
  const secId = `tm-${slug.slice(0, 12)}-${Date.now().toString(36).slice(-4)}`;
  const wsUsers = state.users.filter((u) => u.userScope !== "platform" && u.workspaceIds.includes(workspaceId));
  const resolvedLead = leadUserId && wsUsers.some((u) => u.id === leadUserId) ? leadUserId : wsUsers[0]?.id ?? null;

  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    const sec = {
      id: secId,
      name: String(name || "Custom Section").trim(),
      scenario,
      channelIds: channelIds?.length ? channelIds : (ws.channels ?? []).map((c) => c.id),
      leadUserId: resolvedLead,
      memberIds: resolvedLead ? [resolvedLead] : [],
      focus: String(focus || "Dedicated tenant section workflows & deliverables").trim(),
      assignments: resolvedLead
        ? [{ userId: resolvedLead, unit: "Team Lead", subRole: "Section Lead & Final Review" }]
        : []
    };
    return { ...ws, teams: [...(ws.teams ?? []), sec] };
  });

  recordAudit(`Created section "${name}" (${scenario}) in workspace ${workspaceId}`, "ok");
  persistAndNotify("team:section-create");
  return secId;
}

export function updateTeamSection(workspaceId, teamId, { name, scenario, leadUserId, focus, channelIds } = {}) {
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    return {
      ...ws,
      teams: (ws.teams ?? []).map((t) => {
        if (t.id !== teamId) return t;
        let nextAssignments = Array.isArray(t.assignments)
          ? t.assignments.map((a) => ({ ...a }))
          : (t.memberIds ?? []).map((uid) => ({
              userId: uid,
              unit: uid === t.leadUserId ? "Team Lead" : "Content Team",
              subRole: uid === t.leadUserId ? "Section Lead" : "Team Contributor"
            }));
        let nextMembers = [...(t.memberIds ?? [])];
        if (leadUserId) {
          nextAssignments = nextAssignments.map((a) =>
            a.unit === "Team Lead" && a.userId !== leadUserId
              ? { ...a, unit: "Content Team", subRole: "Senior Contributor" }
              : a
          );
          const existingIdx = nextAssignments.findIndex((a) => a.userId === leadUserId);
          if (existingIdx >= 0) {
            nextAssignments[existingIdx] = { ...nextAssignments[existingIdx], unit: "Team Lead", subRole: "Section Lead & Approvals" };
          } else {
            nextAssignments.unshift({ userId: leadUserId, unit: "Team Lead", subRole: "Section Lead & Approvals" });
          }
          if (!nextMembers.includes(leadUserId)) nextMembers.unshift(leadUserId);
        }
        return {
          ...t,
          ...(name !== undefined ? { name } : {}),
          ...(scenario !== undefined ? { scenario } : {}),
          ...(focus !== undefined ? { focus } : {}),
          ...(channelIds !== undefined ? { channelIds } : {}),
          ...(leadUserId !== undefined ? { leadUserId } : {}),
          memberIds: nextMembers,
          assignments: nextAssignments
        };
      })
    };
  });
  recordAudit(`Updated section ${teamId} in workspace ${workspaceId}`, "info");
  persistAndNotify("team:section-update");
}

export function delegateMemberInSection(workspaceId, teamId, { userId, unit = "Research Team", subRole = "", roleId = null, remove = false }) {
  if (!userId) return;
  if (roleId) {
    state.users = state.users.map((u) => (u.id === userId ? { ...u, defaultRoleId: roleId } : u));
  }
  state.workspaces = state.workspaces.map((ws) => {
    if (ws.id !== workspaceId) return ws;
    return {
      ...ws,
      teams: (ws.teams ?? []).map((t) => {
        if (t.id !== teamId) return t;
        let nextAssignments = Array.isArray(t.assignments)
          ? t.assignments.map((a) => ({ ...a }))
          : (t.memberIds ?? []).map((uid) => ({
              userId: uid,
              unit: uid === t.leadUserId ? "Team Lead" : "Content Team",
              subRole: uid === t.leadUserId ? "Section Lead" : "Team Contributor"
            }));
        let nextMembers = [...(t.memberIds ?? [])];
        let nextLead = t.leadUserId;

        if (remove) {
          nextAssignments = nextAssignments.filter((a) => a.userId !== userId);
          nextMembers = nextMembers.filter((uid) => uid !== userId);
          if (nextLead === userId) {
            nextLead = nextMembers[0] ?? null;
            if (nextLead) {
              nextAssignments = nextAssignments.map((a) => (a.userId === nextLead ? { ...a, unit: "Team Lead" } : a));
            }
          }
          return { ...t, leadUserId: nextLead, memberIds: nextMembers, assignments: nextAssignments };
        }

        const unitMeta = TEAM_UNITS.find((u) => u.id === unit);
        const resolvedSub = subRole || unitMeta?.defaultSubRole || unit;
        if (unit === "Team Lead") {
          nextAssignments = nextAssignments.map((a) =>
            a.unit === "Team Lead" && a.userId !== userId
              ? { ...a, unit: "Content Team", subRole: "Senior Contributor" }
              : a
          );
          nextLead = userId;
        }
        const idx = nextAssignments.findIndex((a) => a.userId === userId);
        if (idx >= 0) {
          nextAssignments[idx] = { ...nextAssignments[idx], unit, subRole: resolvedSub };
        } else {
          nextAssignments.push({ userId, unit, subRole: resolvedSub });
        }
        if (!nextMembers.includes(userId)) nextMembers.push(userId);
        return { ...t, leadUserId: nextLead, memberIds: nextMembers, assignments: nextAssignments };
      })
    };
  });
  recordAudit(
    remove
      ? `Removed user ${userId} from section ${teamId}`
      : `Delegated ${userId} → ${unit}${subRole ? ` (${subRole})` : ""} in section ${teamId}`,
    "ok"
  );
  persistAndNotify("team:delegate");
}

export function updateMemberRole(userId, roleId) {
  state.users = state.users.map((u) => (u.id === userId ? { ...u, defaultRoleId: roleId } : u));
  if (state.session.activeUserId === userId) {
    state.session.activeRoleId = roleId;
    state.session.godModeEnabled = roleId === "god_mode";
  }
  recordAudit(`Updated role assignment for ${userId} → ${roleId}`, "info");
  persistAndNotify("team:role");
}

/* Operational Mutations (Scoped to Active Workspace + Channel) */
export function addPipelineItem({ title, scenario, stage = "capture", publishReady = false, affiliateSlugs = [], channelId = null }) {
  const id = `pipe-${Date.now().toString(36)}`;
  const trilId = `tril-${Math.floor(8900 + Math.random() * 900)}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42) || id;
  const resolvedChannel = resolveDefaultChannelId(channelId);

  state.pipelineItems = [
    {
      id,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      ownerUserId: state.session.activeUserId,
      title,
      scenario,
      stage,
      dueDate: "2026-11-28",
      triliumNoteId: trilId,
      emdashSlug: slug,
      toolLabel: publishReady ? "TriliumNext (#publish-ready)" : "TriliumNext Capture",
      affiliateSlugs: affiliateSlugs.length ? affiliateSlugs : ["sponsor"],
      checklist: [
        { id: `${id}-c1`, label: "Outline & source links captured in Trilium", done: true },
        { id: `${id}-c2`, label: "Record / produce primary asset", done: stage !== "capture" },
        { id: `${id}-c3`, label: "Publish hub entry & wire /go tracking", done: stage === "distribute" }
      ],
      repurposing: [
        { id: `${id}-r1`, channel: "Primary Hub", format: "Canonical Asset", status: stage === "distribute" ? "Published" : "Pending" },
        { id: `${id}-r2`, channel: "Short-Form", format: "2x Clips / Cutdowns", status: "Pending" },
        { id: `${id}-r3`, channel: "Listmonk", format: "Newsletter Mention", status: "Pending" }
      ]
    },
    ...state.pipelineItems
  ];

  state.automationEvents = [
    {
      id: `evt-${Date.now()}`,
      workspaceId: state.session.activeWorkspaceId,
      source: "TriliumNext ETAPI",
      job: `Created note ${trilId}${publishReady ? " (#publish-ready)" : ""}: ${title}`,
      status: "Synced",
      time: "just now",
      tone: "ok"
    },
    ...state.automationEvents.slice(0, 9)
  ];
  recordAudit(`Captured pipeline item "${title}" (${scenario})`, "ok");
  autoRecordWorkBlock({ title: `Captured: ${title}`, scenario, minutes: 15, tool: "TriliumNext ETAPI", pipelineId: id });
  persistAndNotify("pipeline:add");
  return id;
}

export function movePipelineStage(itemId, nextStage) {
  let targetItem = null;
  state.pipelineItems = state.pipelineItems.map((item) => {
    if (item.id !== itemId) return item;
    targetItem = item;
    return { ...item, stage: nextStage };
  });
  recordAudit(`Moved pipeline ${itemId} → ${nextStage}`, "info");
  if (targetItem) {
    autoRecordWorkBlock({ title: `Stage → ${nextStage}: ${targetItem.title}`, scenario: targetItem.scenario, minutes: 30, tool: targetItem.toolLabel, pipelineId: itemId });
  }
  persistAndNotify("pipeline:move");
}

export function toggleChecklistItem(itemId, checkId) {
  state.pipelineItems = state.pipelineItems.map((item) => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      checklist: item.checklist.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c))
    };
  });
  persistAndNotify("pipeline:checklist");
}

export function cycleRepurposeStatus(itemId, repId) {
  const order = ["Pending", "In Progress", "Published"];
  state.pipelineItems = state.pipelineItems.map((item) => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      repurposing: item.repurposing.map((r) => {
        if (r.id !== repId) return r;
        const next = order[(order.indexOf(r.status) + 1) % order.length];
        return { ...r, status: next };
      })
    };
  });
  persistAndNotify("pipeline:repurpose");
}

export function syncTriliumReadyNotes() {
  const wsId = state.session.activeWorkspaceId;
  const idx = state.content.triliumReadyQueue.findIndex((n) => n.workspaceId === wsId);
  const nextNote = idx >= 0 ? state.content.triliumReadyQueue[idx] : state.content.triliumReadyQueue[0];
  state.meta.lastTriliumSync = "Just now (ETAPI 200 OK)";
  if (!nextNote) {
    state.automationEvents = [
      { id: `evt-${Date.now()}`, workspaceId: wsId, source: "TriliumNext ETAPI", job: "Delta check complete — all #publish-ready notes synced", status: "Up to Date", time: "just now", tone: "ok" },
      ...state.automationEvents.slice(0, 9)
    ];
    persistAndNotify("trilium:sync");
    return null;
  }

  state.content.triliumReadyQueue = state.content.triliumReadyQueue.filter((n) => n.id !== nextNote.id);
  state.content.articles = [{ ...nextNote, workspaceId: wsId }, ...state.content.articles];
  state.automationEvents = [
    { id: `evt-${Date.now()}`, workspaceId: wsId, source: "TriliumNext ETAPI", job: `Imported #publish-ready "${nextNote.title}"`, status: "Imported", time: "just now", tone: "ok" },
    ...state.automationEvents.slice(0, 9)
  ];
  recordAudit(`Synced #publish-ready article "${nextNote.title}"`, "ok");
  autoRecordWorkBlock({ title: `Published: ${nextNote.title}`, scenario: "article", minutes: 35, tool: "TriliumNext → EmDash" });
  persistAndNotify("trilium:sync");
  return nextNote;
}

export function runSyncPulse() {
  state.meta.lastTriliumSync = "Just now (ETAPI + BullMQ OK)";
  const q = state.bullQueues.find((x) => x.id === "q-trilium");
  if (q) q.completed24h += 1;
  state.automationEvents = [
    { id: `evt-${Date.now()}`, workspaceId: state.session.activeWorkspaceId, source: "BullMQ · orchestrator", job: "Health pulse verified PG17 RLS, Redis, R2 & ETAPI", status: "Nominal", time: "just now", tone: "ok" },
    ...state.automationEvents.slice(0, 9)
  ];
  persistAndNotify("infra:pulse");
}

export function addBroadcast(payload) {
  const id = `bc-${Date.now().toString(36)}`;
  const channelId = resolveDefaultChannelId(payload.channelId);
  state.broadcasts = [{ id, workspaceId: state.session.activeWorkspaceId, channelId, ...payload, openRate: null }, ...state.broadcasts];
  state.automationEvents = [
    { id: `evt-${Date.now()}`, workspaceId: state.session.activeWorkspaceId, channelId, source: "Listmonk API", job: `${payload.status} broadcast: ${payload.subject}`, status: payload.status, time: "just now", tone: "info" },
    ...state.automationEvents.slice(0, 9)
  ];
  recordAudit(`${payload.status} Listmonk broadcast "${payload.subject}"`, "info");
  autoRecordWorkBlock({ title: `Broadcast (${payload.status}): ${payload.subject}`, scenario: "article", minutes: 30, tool: "Listmonk API", channelId });
  persistAndNotify("broadcast:add");
}

export function toggleSocialStatus(socialId) {
  state.socialQueue = state.socialQueue.map((item) =>
    item.id === socialId ? { ...item, status: item.status === "Queued" ? "Paused" : "Queued" } : item
  );
  persistAndNotify("social:toggle");
}

export function addSocialPost(payload) {
  const channelId = resolveDefaultChannelId(payload.channelId);
  state.socialQueue = [
    { id: `soc-${Date.now().toString(36)}`, workspaceId: state.session.activeWorkspaceId, channelId, ...payload, status: "Queued" },
    ...state.socialQueue
  ];
  recordAudit(`Scheduled ${payload.platform} post "${payload.title}"`, "info");
  autoRecordWorkBlock({ title: `Scheduled ${payload.platform}: ${payload.title}`, scenario: "social", minutes: 20, tool: "Postiz Queue", channelId });
  persistAndNotify("social:add");
}

export function addChannelStatus({ title, body, channelId, mediaType = "Short Video + Status", publishToWebsite = true, publishToSocial = ["YouTube Shorts", "X"] }) {
  const resolvedChannel = resolveDefaultChannelId(channelId);
  const channelObj = state.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === resolvedChannel);
  const domain = channelObj?.domain || getActiveContext(state).workspace.domain;
  const slug = (title || "status-update").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 36);
  const websitePath = `https://${domain}/statuses/${slug}`;

  const item = {
    id: `st-${Date.now().toString(36)}`,
    workspaceId: state.session.activeWorkspaceId,
    channelId: resolvedChannel,
    authorUserId: state.session.activeUserId,
    mediaType,
    title,
    body,
    publishedToWebsite: Boolean(publishToWebsite),
    publishedToSocial: publishToSocial.length ? publishToSocial : [],
    websitePath,
    engagementLabel: "Live now",
    createdAt: "just now",
    status: "Published"
  };

  state.channelStatuses = [item, ...(state.channelStatuses ?? [])];

  if (publishToSocial.length) {
    const newSocials = publishToSocial.map((platform, idx) => ({
      id: `soc-${Date.now().toString(36)}-${idx}`,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      platform,
      title,
      caption: body,
      scheduledFor: "Published · Now",
      trackingUrl: `${websitePath}?utm_source=${platform.toLowerCase().replace(/\s+/g, "_")}`,
      mediaLabel: mediaType,
      mediaBadge: channelObj?.name || "Channel Status",
      status: "Published"
    }));
    state.socialQueue = [...newSocials, ...state.socialQueue];
  }

  state.automationEvents = [
    {
      id: `evt-${Date.now()}`,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      source: `EmDash (${domain}) + Social`,
      job: `Published ${mediaType} "${title}" to ${publishToWebsite ? domain : "social"} & ${publishToSocial.join(", ") || "web"}`,
      status: "Published",
      time: "just now",
      tone: "ok"
    },
    ...state.automationEvents.slice(0, 12)
  ];

  autoRecordWorkBlock({ title: `Published Status: ${title}`, scenario: "social", minutes: 15, tool: `${channelObj?.name || "Channel"} Status & Shorts`, channelId: resolvedChannel });
  recordAudit(`Published "${title}" on ${channelObj?.name || resolvedChannel} (Web + Social)`, "ok");
  persistAndNotify("status:publish");
  return item;
}

export function updateShortLink(linkId, patch) {
  state.shortLinks = state.shortLinks.map((lnk) => (lnk.id === linkId ? { ...lnk, ...patch } : lnk));
  persistAndNotify("link:update");
}

export function addShortLink({ slug, category, destination, channelId = null }) {
  const cleanSlug = slug.replace(/^\/+/, "").toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const id = `lnk-${Date.now().toString(36)}`;
  const resolvedChannel = resolveDefaultChannelId(channelId);
  state.shortLinks = [
    {
      id,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      slug: cleanSlug,
      category,
      destination,
      clicks: 1,
      convRate: 0,
      estRevenueUsd: 0,
      active: true,
      spark: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    },
    ...state.shortLinks
  ];
  recordAudit(`Created /go/${cleanSlug} short-link`, "ok");
  persistAndNotify("link:add");
  return cleanSlug;
}

export function updateSponsorStage(sponsorId, nextStage) {
  const statusByStage = {
    Lead: "MSA Pending",
    Negotiating: "Redlining SOW",
    "SOW Signed": "SOW Executed",
    "Deliverables Live": "SOW Executed",
    Paid: "Paid in Full"
  };
  state.sponsors = state.sponsors.map((sp) =>
    sp.id === sponsorId
      ? { ...sp, stage: nextStage, contractStatus: statusByStage[nextStage] ?? sp.contractStatus }
      : sp
  );
  recordAudit(`Updated sponsor ${sponsorId} stage → ${nextStage}`, "info");
  persistAndNotify("sponsor:stage");
}

export function addSponsorDeal(payload) {
  state.sponsors = [{ id: `sp-${Date.now().toString(36)}`, workspaceId: state.session.activeWorkspaceId, ...payload }, ...state.sponsors];
  recordAudit(`Created sponsor deal for ${payload.company}`, "ok");
  persistAndNotify("sponsor:add");
}

export function toggleGuestRelease(guestId) {
  state.guests = state.guests.map((g) =>
    g.id === guestId
      ? { ...g, releaseSigned: !g.releaseSigned, status: !g.releaseSigned ? "Scheduled" : "Release Pending" }
      : g
  );
  persistAndNotify("guest:release");
}

export function addInvoice(payload) {
  const num = `INV-2026-0${42 + state.invoices.length}`;
  const fxRates = { USD: 1, EUR: 1.08, GBP: 1.26, BTC: 93000 };
  const amount = payload.items.reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
  const usdEquivalent = Math.round(amount * (fxRates[payload.currency] ?? 1));
  const inv = {
    id: `inv-${Date.now().toString(36)}`,
    workspaceId: state.session.activeWorkspaceId,
    number: num,
    sponsorId: payload.sponsorId ?? "custom",
    sponsorName: payload.sponsorName,
    sponsorAddress: payload.sponsorAddress || "Partner Accounts Payable",
    currency: payload.currency,
    amount,
    usdEquivalent,
    rail: payload.rail,
    status: "Awaiting Settlement",
    issuedDate: "2026-11-25",
    dueDate: payload.dueDate || "2026-12-15",
    items: payload.items
  };
  state.invoices = [inv, ...state.invoices];
  recordAudit(`Issued B2B invoice ${num} (${payload.sponsorName})`, "ok");
  persistAndNotify("invoice:add");
  return inv;
}

export function markInvoicePaid(invoiceId) {
  const target = state.invoices.find((i) => i.id === invoiceId);
  if (!target || target.status === "Paid") return;
  state.invoices = state.invoices.map((i) => (i.id === invoiceId ? { ...i, status: "Paid" } : i));
  state.ledgerEntries = [
    {
      id: `led-${Date.now().toString(36)}`,
      workspaceId: target.workspaceId || state.session.activeWorkspaceId,
      date: "2026-11-25",
      source: `${target.sponsorName} (${target.number})`,
      category: "Sponsor Invoice",
      rail: target.rail,
      currency: target.currency,
      nativeAmount: target.amount,
      usdAmount: target.usdEquivalent,
      status: "Settled"
    },
    ...state.ledgerEntries
  ];
  recordAudit(`Settled invoice ${target.number} ($${target.usdEquivalent})`, "ok");
  persistAndNotify("invoice:paid");
}

export function retryFailedJob(jobId) {
  const job = state.failedJobs.find((j) => j.id === jobId);
  if (!job) return;
  state.failedJobs = state.failedJobs.filter((j) => j.id !== jobId);
  state.bullQueues = state.bullQueues.map((q) =>
    q.name === job.queue
      ? { ...q, failed: Math.max(0, q.failed - 1), completed24h: q.completed24h + 1 }
      : q
  );
  state.automationEvents = [
    { id: `evt-${Date.now()}`, workspaceId: job.workspaceId || state.session.activeWorkspaceId, source: `BullMQ · ${job.queue}`, job: `Retried & resolved ${job.id}`, status: "Resolved", time: "just now", tone: "ok" },
    ...state.automationEvents.slice(0, 9)
  ];
  recordAudit(`Retried dead-letter job ${job.id}`, "ok");
  persistAndNotify("job:retry");
}

export function retryAllFailedJobs() {
  const count = state.failedJobs.length;
  if (!count) return 0;
  state.failedJobs = [];
  state.bullQueues = state.bullQueues.map((q) => ({
    ...q,
    completed24h: q.completed24h + q.failed,
    failed: 0
  }));
  state.automationEvents = [
    { id: `evt-${Date.now()}`, workspaceId: state.session.activeWorkspaceId, source: "BullMQ · dead-letter", job: `Batch retried ${count} failed jobs`, status: "All Clear", time: "just now", tone: "ok" },
    ...state.automationEvents.slice(0, 9)
  ];
  recordAudit(`Batch retried ${count} failed BullMQ jobs`, "ok");
  persistAndNotify("job:retryAll");
  return count;
}

export function toggleQueuePaused(queueId) {
  state.bullQueues = state.bullQueues.map((q) => (q.id === queueId ? { ...q, paused: !q.paused } : q));
  recordAudit(`Toggled BullMQ queue ${queueId} state`, "warn");
  persistAndNotify("queue:toggle");
}

/* Mega Calendar & Automatic Work-Watcher Engine */
let tickPersistCounter = 0;

function autoRecordWorkBlock({ title, scenario = "article", minutes = 20, tool = "GodFlow OS", pipelineId = null, channelId = null }) {
  const userId = state.session.activeUserId;
  const wsId = state.session.activeWorkspaceId;
  const resolvedChannel = resolveDefaultChannelId(channelId);
  const addSec = minutes * 60;
  const today = state.watcherConfig?.referenceToday ?? "2026-11-25";

  const watcher = state.activeWatchers?.find((w) => w.userId === userId);
  if (watcher) {
    watcher.todaySeconds += addSec;
    watcher.taskTitle = title;
    watcher.scenario = scenario;
    watcher.tool = tool;
    if (resolvedChannel) watcher.channelId = resolvedChannel;
  }

  state.workEvents = [
    {
      id: `we-${Date.now().toString(36)}`,
      workspaceId: wsId,
      channelId: resolvedChannel,
      userId,
      scenario,
      title,
      date: today,
      startHour: new Date().getHours() || 10,
      durationHours: Number((minutes / 60).toFixed(2)),
      trackedSeconds: addSec,
      status: "Completed",
      tool,
      pipelineId
    },
    ...(state.workEvents ?? [])
  ];
}

export function tickActiveWatchers() {
  if (!state.watcherConfig?.enabled || !state.session.authenticated) return false;
  const delta = Number(state.watcherConfig.speedMultiplier) || 1;
  const today = state.watcherConfig.referenceToday || "2026-11-25";

  for (const w of state.activeWatchers ?? []) {
    if (!w.running) continue;
    w.todaySeconds += delta;

    // Also advance the matching live work event for today so calendar hours grow dynamically
    const liveEvent = state.workEvents?.find(
      (ev) => ev.userId === w.userId && ev.date === today && ev.status === "Live Tracking"
    );
    if (liveEvent) {
      liveEvent.trackedSeconds += delta;
      liveEvent.durationHours = Number((liveEvent.trackedSeconds / 3600).toFixed(2));
    }
  }

  tickPersistCounter += 1;
  if (tickPersistCounter >= 5) {
    tickPersistCounter = 0;
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function toggleGlobalWatcher() {
  state.watcherConfig.enabled = !state.watcherConfig.enabled;
  recordAudit(
    state.watcherConfig.enabled ? "Resumed Automatic Team Work-Watcher" : "Paused Automatic Team Work-Watcher",
    state.watcherConfig.enabled ? "ok" : "warn"
  );
  persistAndNotify("watcher:global");
}

export function setWatcherSpeed(multiplier) {
  state.watcherConfig.speedMultiplier = Number(multiplier) || 1;
  persistAndNotify("watcher:speed");
}

export function toggleUserWatcher(userId) {
  const target = state.activeWatchers?.find((w) => w.userId === userId);
  if (!target) return;
  target.running = !target.running;
  const user = state.users.find((u) => u.id === userId);
  recordAudit(`${target.running ? "Started" : "Paused"} auto-tracker for ${user?.name ?? userId}`, "info");
  persistAndNotify("watcher:user");
}

export function addWorkEvent({ title, scenario, userId, date, startHour, durationHours, status = "Completed", tool = "Manual Log" }) {
  const dur = Number(durationHours) || 1;
  const sec = status === "Scheduled" ? 0 : Math.round(dur * 3600);
  const ev = {
    id: `we-${Date.now().toString(36)}`,
    workspaceId: state.session.activeWorkspaceId,
    userId: userId || state.session.activeUserId,
    scenario: scenario || "article",
    title,
    date: date || state.watcherConfig.referenceToday || "2026-11-25",
    startHour: Number(startHour) || 9,
    durationHours: dur,
    trackedSeconds: sec,
    status,
    tool,
    pipelineId: null
  };
  state.workEvents = [ev, ...(state.workEvents ?? [])];
  if (ev.date === (state.watcherConfig?.referenceToday ?? "2026-11-25") && sec > 0) {
    const watcher = state.activeWatchers?.find((w) => w.userId === ev.userId);
    if (watcher) watcher.todaySeconds += sec;
  }
  recordAudit(`Logged ${dur}h work block "${title}" (${scenario})`, "ok");
  persistAndNotify("calendar:add");
  return ev;
}

/* Scenario Workbench Mutations */
export function addResearchSource({ title, url, summary, body }) {
  let domain = "web-source";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* fallback */
  }
  const src = {
    id: `src-${Date.now().toString(36)}`,
    title,
    domain,
    url,
    published: "2026-11-25",
    summary: summary || "Captured into GodFlow Research Desk.",
    body: body || summary || "Source content archived for citation and brainstorming."
  };
  state.workbenchData.researchSources = [src, ...state.workbenchData.researchSources];
  autoRecordWorkBlock({ title: `Researched: ${title}`, scenario: "article", minutes: 20, tool: "Research Desk Reader" });
  persistAndNotify("workbench:research");
  return src;
}

export function addBrainstormNote({ tag, sourceTitle, text }) {
  const note = {
    id: `br-${Date.now().toString(36)}`,
    tag: tag || "Note",
    sourceTitle: sourceTitle || "Original Thought",
    text
  };
  state.workbenchData.brainstormNotes = [note, ...state.workbenchData.brainstormNotes];
  autoRecordWorkBlock({ title: `Brainstormed (${note.tag}): ${text.slice(0, 36)}`, scenario: "article", minutes: 10, tool: "Brainstorm Canvas" });
  persistAndNotify("workbench:brainstorm");
  return note;
}

export function removeBrainstormNote(noteId) {
  state.workbenchData.brainstormNotes = state.workbenchData.brainstormNotes.filter((n) => n.id !== noteId);
  persistAndNotify("workbench:brainstorm-del");
}

export function saveArticleDraft({ title, slug, html, publishToHub = false, channelId = null }) {
  const cleanSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  state.workbenchData.articleDraft = { title, slug: cleanSlug, html };

  if (publishToHub) {
    const resolvedChannel = resolveDefaultChannelId(channelId);
    const channelObj = state.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === resolvedChannel);
    const domain = channelObj?.domain || getActiveContext(state).workspace.domain;
    const plainText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = plainText ? plainText.split(" ").length : 120;
    const entry = {
      id: `art-${Date.now().toString(36)}`,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      title,
      slug: cleanSlug,
      status: "Publish-Ready",
      publishedTargets: [`${domain} Website`, "X", "LinkedIn"],
      words: Math.max(words, 180),
      updatedAt: "2026-11-25 (Studio)",
      triliumNoteId: `tril-${Math.floor(8900 + Math.random() * 900)}`,
      seoScore: 95,
      excerpt: plainText.slice(0, 175) + (plainText.length > 175 ? "…" : ""),
      affiliateProps: state.content.articles[0]?.affiliateProps ?? {
        slug: "hetzner",
        title: "Hetzner Cloud NVMe",
        badge: "Studio Pick",
        summary: "Self-hosted creator stack.",
        cta: "Launch →",
        commission: "10% rev share"
      },
      sponsorProps: state.content.articles[0]?.sponsorProps ?? {
        sponsor: "TradingView",
        headline: "Macro & Flow Workspace",
        copy: "30-day creator trial.",
        cta: "Try Free",
        slug: "tradingview"
      }
    };
    state.content.articles = [entry, ...state.content.articles];
    autoRecordWorkBlock({ title: `Published Article: ${title}`, scenario: "article", minutes: 45, tool: "Article Rich HTML Studio" });
    recordAudit(`Published article "${title}" from Editorial Workbench`, "ok");
  }
  persistAndNotify("workbench:article");
}

export function updateImageCanvas(patch) {
  state.workbenchData.imageCanvas = { ...state.workbenchData.imageCanvas, ...patch };
  persistAndNotify("workbench:canvas");
}

export function exportCanvasToSocial({ platform, title, caption, trackingUrl }) {
  const c = state.workbenchData.imageCanvas;
  state.socialQueue = [
    {
      id: `soc-${Date.now().toString(36)}`,
      workspaceId: state.session.activeWorkspaceId,
      platform: platform || "X",
      title: title || c.headline,
      caption: caption || `${c.headline} — ${c.subhead}`,
      scheduledFor: "Today · 16:30 EST",
      trackingUrl: trackingUrl || `https://${getActiveContext(state).workspace.shortDomain}/gear?utm_source=social&utm_medium=image`,
      mediaLabel: `${c.ratio} Edited Canvas`,
      mediaBadge: c.badgeText || "Studio Export",
      status: "Queued"
    },
    ...state.socialQueue
  ];
  autoRecordWorkBlock({ title: `Edited & Queued ${platform} Graphic`, scenario: "social", minutes: 25, tool: "Image Canvas Editor + Postiz" });
  recordAudit(`Exported Canvas Image to ${platform} Postiz Queue`, "ok");
  persistAndNotify("workbench:social-export");
}

export function logWorkbenchAction({ title, scenario, minutes = 20, tool = "Scenario Workbench", addToSocial = null }) {
  if (addToSocial) {
    state.socialQueue = [
      {
        id: `soc-${Date.now().toString(36)}`,
        workspaceId: state.session.activeWorkspaceId,
        ...addToSocial,
        status: "Queued"
      },
      ...state.socialQueue
    ];
  }
  autoRecordWorkBlock({ title, scenario, minutes, tool });
  recordAudit(`${tool}: ${title}`, "ok");
  persistAndNotify("workbench:action");
}

/* Podcast Worker Script Studio & Multi-Platform Live Simulcast Mutations */
export function savePodcastScript({
  episodeTitle,
  episodeNumber = 92,
  channelId = null,
  guestName = "",
  targetDurationMin = 45,
  html = "",
  publishToHub = false
}) {
  const resolvedChannel = resolveDefaultChannelId(channelId);
  const channelObj = state.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === resolvedChannel);
  const prev = state.workbenchData.podcastScript ?? {};
  state.workbenchData.podcastScript = {
    ...prev,
    episodeTitle: episodeTitle || prev.episodeTitle || "Podcast Episode Script",
    episodeNumber: Number(episodeNumber) || prev.episodeNumber || 92,
    channelId: resolvedChannel,
    guestName: guestName ?? prev.guestName ?? "",
    targetDurationMin: Number(targetDurationMin) || 45,
    html,
    segments: prev.segments ?? []
  };

  if (publishToHub) {
    const epNum = state.workbenchData.podcastScript.episodeNumber;
    const epTitle = state.workbenchData.podcastScript.episodeTitle;
    const segChapters = (state.workbenchData.podcastScript.segments ?? []).map((s) => ({
      time: s.ts,
      label: s.title
    }));
    const entry = {
      id: `pod-${Date.now().toString(36)}`,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      episodeNumber: epNum,
      title: epTitle,
      publishedAt: "2026-11-25 (Script Studio)",
      duration: `${state.workbenchData.podcastScript.targetDurationMin}:00`,
      durationSec: state.workbenchData.podcastScript.targetDurationMin * 60,
      rssStatus: `RSS 2.0 + ${channelObj?.domain ?? getActiveContext(state).workspace.domain} Script Synced`,
      rssUrl: channelObj?.rssUrl ?? `https://castopod.${getActiveContext(state).workspace.domain}/@show/feed.xml`,
      downloads: 420,
      chapters: segChapters.length ? segChapters : [{ time: "00:00", label: epTitle }],
      transcript: [
        {
          ts: "00:00:15",
          speaker: guestName ? `${state.users.find((u) => u.id === state.session.activeUserId)?.name ?? "Host"} & ${guestName}` : "Host",
          line: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
        }
      ]
    };
    state.content.podcasts = [entry, ...state.content.podcasts];
    autoRecordWorkBlock({
      title: `Scripted Podcast Ep.${epNum}: ${epTitle}`,
      scenario: "podcast",
      minutes: 35,
      tool: "Podcast Script Composer + Castopod",
      channelId: resolvedChannel
    });
    recordAudit(`Published Podcast Script Ep.${epNum} ("${epTitle}") to Castopod Hub`, "ok");
  } else {
    recordAudit(`Saved Podcast Script draft "${state.workbenchData.podcastScript.episodeTitle}"`, "info");
  }

  persistAndNotify("workbench:podcast-script");
  return state.workbenchData.podcastScript;
}

export function addPodcastScriptSegment({ ts, title, cue }) {
  const script = state.workbenchData.podcastScript;
  if (!script) return null;
  const seg = {
    id: `pseg-${Date.now().toString(36)}`,
    ts: ts || "42:00",
    title: title || "Segment Cue",
    cue: cue || title || "Talking point cue"
  };
  script.segments = [...(script.segments ?? []), seg];
  recordAudit(`Added Podcast Run-of-Show segment [${seg.ts}] ${seg.title}`, "info");
  persistAndNotify("workbench:podcast-segment");
  return seg;
}

export function togglePodcastLivePlatform(platformId) {
  const cfg = state.workbenchData.podcastLiveConfig;
  if (!cfg) return;
  cfg.destinations = (cfg.destinations ?? []).map((d) =>
    d.id === platformId
      ? {
          ...d,
          enabled: !d.enabled,
          status: !d.enabled ? (cfg.isLive ? "LIVE STREAMING" : "Ready") : "Standby"
        }
      : d
  );
  recordAudit(`Toggled podcast live destination ${platformId}`, "info");
  persistAndNotify("workbench:podcast-platform");
}

export function setPodcastLiveScene(activeScene) {
  const cfg = state.workbenchData.podcastLiveConfig;
  if (!cfg) return;
  cfg.activeScene = activeScene;
  recordAudit(`Switched live podcast broadcast scene → ${activeScene}`, "info");
  persistAndNotify("workbench:podcast-scene");
}

export function updatePodcastAudioMix({ micGain, guestGain, soundboardLevel }) {
  const cfg = state.workbenchData.podcastLiveConfig;
  if (!cfg) return;
  if (micGain !== undefined) cfg.micGain = Number(micGain);
  if (guestGain !== undefined) cfg.guestGain = Number(guestGain);
  if (soundboardLevel !== undefined) cfg.soundboardLevel = Number(soundboardLevel);
  persistAndNotify("workbench:podcast-mix");
}

export function togglePodcastSimulcastLive({ episodeTitle, channelId = null } = {}) {
  const cfg = state.workbenchData.podcastLiveConfig;
  if (!cfg) return { isLive: false, activeDestinations: [] };
  const nextLive = !cfg.isLive;
  cfg.isLive = nextLive;

  let activeDestinations = (cfg.destinations ?? []).filter((d) => d.enabled);
  if (nextLive && activeDestinations.length === 0) {
    cfg.destinations = (cfg.destinations ?? []).map((d) =>
      d.id === "plive-yt" || d.id === "plive-web" ? { ...d, enabled: true } : d
    );
    activeDestinations = cfg.destinations.filter((d) => d.enabled);
  }

  cfg.destinations = (cfg.destinations ?? []).map((d) => ({
    ...d,
    status: d.enabled ? (nextLive ? "LIVE STREAMING" : "Ready") : "Standby"
  }));

  const resolvedChannel = resolveDefaultChannelId(channelId);
  const channelObj = state.workspaces.flatMap((w) => w.channels ?? []).find((c) => c.id === resolvedChannel);
  const epTitle = episodeTitle || state.workbenchData.podcastScript?.episodeTitle || "Live Podcast Simulcast";

  if (nextLive) {
    cfg.startedAt = nowStamp();
    const platformsList = activeDestinations.map((d) => d.platform);
    state.channelStatuses = [
      {
        id: `st-pod-${Date.now().toString(36)}`,
        workspaceId: state.session.activeWorkspaceId,
        channelId: resolvedChannel,
        authorUserId: state.session.activeUserId,
        mediaType: "Live Podcast Simulcast",
        title: `LIVE NOW: ${epTitle}`,
        body: `Simulcasting live across ${platformsList.join(", ")} on ${channelObj?.domain ?? getActiveContext(state).workspace.domain}.`,
        publishedToWebsite: true,
        publishedToSocial: platformsList,
        websitePath: `https://${channelObj?.domain ?? getActiveContext(state).workspace.domain}/live`,
        engagementLabel: `${activeDestinations.reduce((s, d) => s + (d.viewers || 0), 0)} live tuning in`,
        createdAt: "just now",
        status: "Published"
      },
      ...(state.channelStatuses ?? [])
    ];
    state.automationEvents = [
      {
        id: `evt-pod-${Date.now().toString(36)}`,
        workspaceId: state.session.activeWorkspaceId,
        channelId: resolvedChannel,
        source: "Multi-RTMP Podcast Relay",
        job: `Started live podcast simulcast on ${platformsList.join(" + ")}`,
        status: "Live",
        time: "just now",
        tone: "ok"
      },
      ...(state.automationEvents ?? []).slice(0, 9)
    ];
    autoRecordWorkBlock({
      title: `Podcast Multi-Platform Live: ${epTitle}`,
      scenario: "podcast",
      minutes: 45,
      tool: "Multi-RTMP Podcast Simulcast",
      channelId: resolvedChannel
    });
    recordAudit(`Started Live Podcast Simulcast on ${platformsList.join(", ")}`, "ok");
  } else {
    cfg.startedAt = null;
    recordAudit(`Ended Live Podcast Simulcast "${epTitle}"`, "info");
  }

  persistAndNotify("workbench:podcast-live");
  return { isLive: nextLive, activeDestinations };
}

export function saveVideoProject({
  mode = "long",
  title,
  channelId,
  hookLine = "",
  script = "",
  srtCaptions = "",
  aspect = "16:9",
  fps = 60,
  durationSec = 420,
  folderId = null,
  publishToHub = false
}) {
  const ctx = getActiveContext();
  const resolvedChannel = resolveDefaultChannelId(channelId);
  const cleanTitle = (title || "Untitled Video Production").trim();
  const format = mode === "short" ? "9:16 Short" : "16:9 Full Video";
  const resolvedFolder =
    folderId ||
    state.content?.folders?.find((f) => f.workspaceId === ctx.workspace.id && (f.scenario === "video" || f.scenario === "all"))?.id ||
    null;

  state.workbenchData.videoStudio = {
    ...state.workbenchData.videoStudio,
    mode,
    title: cleanTitle,
    channelId: resolvedChannel,
    hookLine,
    script,
    srtCaptions,
    aspect,
    fps,
    durationSec,
    updatedAt: nowStamp()
  };

  let createdVideo = null;
  if (publishToHub) {
    const todayIso = state.watcherConfig?.referenceToday || "2026-11-25";
    createdVideo = {
      id: `vid-${Date.now().toString(36)}`,
      workspaceId: state.session.activeWorkspaceId,
      channelId: resolvedChannel,
      folderId: resolvedFolder,
      title: cleanTitle,
      format,
      aspect,
      durationSec,
      fps,
      hookLine,
      status: mode === "short" ? "Short Queued" : "Rendered",
      publishedAt: todayIso,
      targets: mode === "short" ? ["YouTube Shorts", "Reels", "X"] : ["YouTube 4K", "Channel Website"]
    };
    state.content.videos = [createdVideo, ...(state.content.videos ?? [])];
    if (mode === "short") {
      state.socialQueue = [
        {
          id: `soc-vid-${Date.now().toString(36)}`,
          workspaceId: state.session.activeWorkspaceId,
          channelId: resolvedChannel,
          platform: "YouTube Shorts",
          title: cleanTitle,
          caption: hookLine || `${cleanTitle} — vertical 9:16 short cut with SRT captions.`,
          status: "Queued",
          scheduledFor: "Today · Next Slot",
          trackingUrl: `https://${ctx.workspace.shortDomain}/shorts`,
          mediaLabel: `0:${String(Math.min(59, durationSec || 48)).padStart(2, "0")} Vertical 9:16 Short`,
          mediaBadge: "Videos & Shorts Studio"
        },
        ...state.socialQueue
      ];
    }
    autoRecordWorkBlock({
      title: `${format}: ${cleanTitle}`,
      scenario: "video",
      minutes: mode === "short" ? 25 : 45,
      tool: "Videos & Shorts Studio",
      channelId: resolvedChannel
    });
    recordAudit(`Published ${format} "${cleanTitle}" → Content Hub & Distribution`, "ok");
  } else {
    recordAudit(`Saved ${format} draft "${cleanTitle}"`, "info");
  }

  persistAndNotify("workbench:video");
  return createdVideo;
}

export function updateGifMaker(patch = {}) {
  state.workbenchData.gifMaker = {
    ...(state.workbenchData.gifMaker ?? { delayMs: 260, loopLabel: "Infinite Loop", frames: [] }),
    ...patch
  };
  persistAndNotify("workbench:gif");
}

export function exportGifToSocial({ platform = "X", title, delayMs = 260, frameCount = 3, channelId }) {
  const ctx = getActiveContext();
  const resolvedChannel = resolveDefaultChannelId(channelId);
  const cleanTitle = (title || "Animated Creator GIF").trim();
  const item = {
    id: `soc-gif-${Date.now().toString(36)}`,
    workspaceId: state.session.activeWorkspaceId,
    channelId: resolvedChannel,
    platform,
    title: `${cleanTitle} (Animated GIF)`,
    caption: `${cleanTitle} — ${frameCount}-frame GIF @ ${delayMs}ms loop exported from GIF Maker.`,
    status: "Queued",
    scheduledFor: "Tomorrow · Morning Peak",
    trackingUrl: `https://${ctx.workspace.shortDomain}/gif`,
    mediaLabel: `GIF · ${frameCount} Frames · ${delayMs}ms`,
    mediaBadge: "Animated GIF Maker"
  };
  state.socialQueue = [item, ...state.socialQueue];
  autoRecordWorkBlock({
    title: `GIF Export (${platform}): ${cleanTitle}`,
    scenario: "social",
    minutes: 15,
    tool: "Thumbnails & GIF Maker",
    channelId: resolvedChannel
  });
  recordAudit(`Exported Animated GIF "${cleanTitle}" → ${platform} Queue`, "ok");
  persistAndNotify("workbench:gif-export");
  return item;
}

export function createContentFolder({ name, scenario = "all", channelId = "all" }) {
  const ctx = getActiveContext();
  const cleanName = (name || "").trim();
  if (!cleanName) return null;
  const folder = {
    id: `fld-${Date.now().toString(36)}`,
    workspaceId: ctx.workspace.id,
    channelId: channelId === "all" ? "" : channelId,
    scenario,
    name: cleanName,
    createdAt: state.watcherConfig?.referenceToday || "2026-11-25"
  };
  state.content.folders = [...(state.content.folders ?? []), folder];
  recordAudit(`Created organizer folder "${cleanName}" (${scenario})`, "ok");
  persistAndNotify("hub:folder-create");
  return folder;
}

export function moveContentToFolder({ kind, itemId, folderId }) {
  const listKey =
    kind === "article"
      ? "articles"
      : kind === "video"
        ? "videos"
        : kind === "podcast"
          ? "podcasts"
          : kind === "music"
            ? "musicReleases"
            : null;
  if (!listKey || !Array.isArray(state.content?.[listKey])) return false;
  state.content[listKey] = state.content[listKey].map((item) =>
    item.id === itemId ? { ...item, folderId: folderId || null } : item
  );
  recordAudit(`Moved ${kind} "${itemId}" → folder "${folderId || "Root"}"`, "info");
  persistAndNotify("hub:folder-move");
  return true;
}

export function addWhiteboardItem({ text, color = "info", kind = "Sticky Note", scenario = "all" }) {
  const ctx = getActiveContext();
  const cleanText = (text || "").trim();
  if (!cleanText) return null;
  const item = {
    id: `wb-${Date.now().toString(36)}`,
    workspaceId: ctx.workspace.id,
    authorId: ctx.activeUser.id,
    authorName: ctx.activeUser.name,
    authorRole: ctx.role.badge,
    text: cleanText,
    color,
    kind,
    scenario,
    done: false,
    createdAt: nowStamp()
  };
  state.workbenchData.whiteboard = [item, ...(state.workbenchData.whiteboard ?? [])];
  recordAudit(`Added whiteboard ${kind} in ${ctx.workspace.name}`, "info");
  persistAndNotify("workbench:whiteboard");
  return item;
}

export function toggleWhiteboardItem(itemId) {
  state.workbenchData.whiteboard = (state.workbenchData.whiteboard ?? []).map((it) =>
    it.id === itemId ? { ...it, done: !it.done } : it
  );
  persistAndNotify("workbench:whiteboard");
}

export function removeWhiteboardItem(itemId) {
  state.workbenchData.whiteboard = (state.workbenchData.whiteboard ?? []).filter((it) => it.id !== itemId);
  persistAndNotify("workbench:whiteboard");
}

export function requestAssetPermission({ itemId, itemTitle, scenario, accessLevel = "Read & Write" }) {
  const ctx = getActiveContext();
  state.content.permissionRequests = state.content.permissionRequests ?? [];
  const req = {
    id: `perm-${Date.now().toString(36)}`,
    workspaceId: ctx.workspace.id,
    requesterId: ctx.activeUser.id,
    requesterName: ctx.activeUser.name,
    requesterRole: ctx.role.badge,
    itemId,
    itemTitle,
    scenario,
    accessLevel,
    status: "Pending",
    createdAt: nowStamp()
  };
  state.content.permissionRequests = [req, ...state.content.permissionRequests];
  recordAudit(`Requested ${accessLevel} permission on "${itemTitle}" (${scenario})`, "warn");
  persistAndNotify("hub:permission-request");
  return req;
}

export function resolvePermissionRequest(reqId, approve = true) {
  const ctx = getActiveContext();
  state.content.permissionRequests = (state.content.permissionRequests ?? []).map((r) =>
    r.id === reqId
      ? { ...r, status: approve ? "Approved" : "Denied", resolvedBy: ctx.activeUser.name, resolvedAt: nowStamp() }
      : r
  );
  const target = (state.content.permissionRequests ?? []).find((r) => r.id === reqId);
  recordAudit(`${approve ? "Approved" : "Denied"} ${target?.accessLevel || ""} request for ${target?.requesterName || "user"} on "${target?.itemTitle || reqId}"`, approve ? "ok" : "warn");
  persistAndNotify("hub:permission-resolve");
}

export function setAssetProtection({ kind, itemId, protection = "Normal" }) {
  const listKey = kind === "article" ? "articles" : kind === "video" ? "videos" : kind === "podcast" ? "podcasts" : kind === "music" ? "musicReleases" : null;
  if (!listKey || !Array.isArray(state.content?.[listKey])) return false;
  state.content[listKey] = state.content[listKey].map((item) =>
    item.id === itemId ? { ...item, protection } : item
  );
  recordAudit(`Set ${kind} "${itemId}" protection → ${protection}`, protection === "Protected" ? "warn" : "info");
  persistAndNotify("hub:protection");
  return true;
}

export function moveAssetToTrash({ kind, itemId }) {
  const ctx = getActiveContext();
  const listKey = kind === "article" ? "articles" : kind === "video" ? "videos" : kind === "podcast" ? "podcasts" : kind === "music" ? "musicReleases" : null;
  if (!listKey || !Array.isArray(state.content?.[listKey])) return false;
  const target = state.content[listKey].find((i) => i.id === itemId);
  if (!target || target.protection === "Protected") return false;
  state.content[listKey] = state.content[listKey].filter((i) => i.id !== itemId);
  state.content.trashcan = [
    {
      id: `tr-${Date.now().toString(36)}`,
      workspaceId: ctx.workspace.id,
      kind,
      deletedBy: ctx.activeUser.name,
      deletedAt: nowStamp(),
      item: target
    },
    ...(state.content.trashcan ?? [])
  ];
  recordAudit(`Moved ${kind} "${target.title}" to Trashcan`, "warn");
  persistAndNotify("hub:trash");
  return true;
}

export function restoreAssetFromTrash(trashId) {
  const entry = (state.content.trashcan ?? []).find((t) => t.id === trashId);
  if (!entry) return false;
  const listKey = entry.kind === "article" ? "articles" : entry.kind === "video" ? "videos" : entry.kind === "podcast" ? "podcasts" : entry.kind === "music" ? "musicReleases" : null;
  if (!listKey) return false;
  state.content[listKey] = [entry.item, ...(state.content[listKey] ?? [])];
  state.content.trashcan = (state.content.trashcan ?? []).filter((t) => t.id !== trashId);
  recordAudit(`Restored ${entry.kind} "${entry.item.title}" from Trashcan`, "ok");
  persistAndNotify("hub:restore");
  return true;
}

export function setUserLeaveAndCoverage({ userId, onLeave = true, coverUserId = null, tempRoleId = null, durationHours = 24 }) {
  const targetUser = state.users.find((u) => u.id === userId);
  if (!targetUser) return false;
  const expiresAt = onLeave ? new Date(Date.now() + Number(durationHours || 24) * 3600 * 1000).toISOString() : null;
  const coverUser = coverUserId ? state.users.find((u) => u.id === coverUserId) : null;
  const todayIso = state.watcherConfig?.referenceToday || "2026-11-25";
  state.roleHistory = [
    {
      id: `rh-${Date.now().toString(36)}`,
      workspaceId: state.session.activeWorkspaceId,
      date: todayIso,
      time: nowStamp(),
      sectionName: "HR Leave Coverage",
      roleLabel: tempRoleId || targetUser.defaultRoleId,
      userName: onLeave ? (coverUser?.name || targetUser.name) : targetUser.name,
      previousUserName: onLeave ? targetUser.name : (coverUser?.name || "Coverage"),
      action: onLeave ? `Covering Leave (${durationHours}h)` : "Returned from Leave"
    },
    ...(state.roleHistory ?? []).slice(0, 49)
  ];
  state.users = state.users.map((u) => {
    if (u.id === userId) {
      return {
        ...u,
        onLeave: Boolean(onLeave),
        coveredByUserId: onLeave ? coverUserId : null,
        leaveDurationHours: onLeave ? Number(durationHours || 24) : null,
        leaveExpiresAt: expiresAt
      };
    }
    if (coverUserId && u.id === coverUserId) {
      return {
        ...u,
        temporaryRoleId: onLeave ? tempRoleId || targetUser.defaultRoleId : null,
        coveringForUserId: onLeave ? userId : null,
        tempRoleExpiresAt: expiresAt
      };
    }
    if (!onLeave && u.coveringForUserId === userId) {
      return { ...u, temporaryRoleId: null, coveringForUserId: null, tempRoleExpiresAt: null };
    }
    return u;
  });
  recordAudit(
    onLeave
      ? `HR: Marked ${targetUser.name} On Leave${coverUserId ? ` (covered by ${state.users.find((x) => x.id === coverUserId)?.name || coverUserId})` : ""}`
      : `HR: Returned ${targetUser.name} from Leave & restored normal roles`,
    onLeave ? "warn" : "ok"
  );
  persistAndNotify("hr:leave-coverage");
  return true;
}

const DEFAULT_LIVE_CHECKLIST = [
  { id: "lc-1", label: "Mic & Audio Levels (-16 LUFS) tested", done: false },
  { id: "lc-2", label: "OBS 4K Scene & Camera Framing verified", done: false },
  { id: "lc-3", label: "Pinned Chat Links & /go Affiliates armed", done: false },
  { id: "lc-4", label: "RTMP Stream Key & Backup Relay connected", done: false }
];

export function getLiveChecklist() {
  if (!Array.isArray(state.workbenchData?.liveChecklist)) {
    state.workbenchData.liveChecklist = structuredClone(DEFAULT_LIVE_CHECKLIST);
  }
  return state.workbenchData.liveChecklist;
}

export function addLiveChecklistItem(label) {
  const clean = (label || "").trim();
  if (!clean) return null;
  const list = getLiveChecklist();
  const item = { id: `lc-${Date.now().toString(36)}`, label: clean, done: false };
  state.workbenchData.liveChecklist = [...list, item];
  persistAndNotify("live:checklist-add");
  return item;
}

export function toggleLiveChecklistItem(itemId) {
  const list = getLiveChecklist();
  state.workbenchData.liveChecklist = list.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
  persistAndNotify("live:checklist-toggle");
}

export function removeLiveChecklistItem(itemId) {
  const list = getLiveChecklist();
  state.workbenchData.liveChecklist = list.filter((it) => it.id !== itemId);
  persistAndNotify("live:checklist-remove");
}
