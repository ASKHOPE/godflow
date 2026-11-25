export const TEAM_UNITS = [
  { id: "Team Lead", label: "Team Lead", tone: "warn", defaultSubRole: "Section Lead & Approvals" },
  { id: "Research Team", label: "Research Team", tone: "info", defaultSubRole: "Online Research, Prep & Verification" },
  { id: "Content Team", label: "Content Team", tone: "ok", defaultSubRole: "Writing, Scripting & Production" },
  { id: "Live Ops & Broadcast", label: "Live Ops & Broadcast", tone: "info", defaultSubRole: "OBS Scenes, Multi-RTMP & Audio" },
  { id: "Distribution & Growth", label: "Distribution & Growth", tone: "ok", defaultSubRole: "Clips, Social Scheduling & /go Links" },
  { id: "Finance & Partner Ops", label: "Finance & Partner Ops", tone: "warn", defaultSubRole: "Sponsor Deals, Budgets & Reporting" }
];

export const SCENARIOS = [
  {
    id: "stock",
    label: "Live Stream",
    short: "Live Stream",
    description: "Source gathering, OBS 4K broadcast scenes, watchlists, live Q&A & replay clips",
    tool: "Sources + OBS-4K + Live Scenes",
    leadRole: "trader_host",
    colorVar: "var(--scen-stock)"
  },
  {
    id: "music",
    label: "Music",
    short: "Music",
    description: "Reference & chord sources, vocal tracking, lossless FLAC stems, lyrics pad & 4K MV",
    tool: "Sources + Logic Pro + Stems + R2",
    leadRole: "music_artist",
    colorVar: "var(--scen-music)"
  },
  {
    id: "podcast",
    label: "Podcast",
    short: "Podcast",
    description: "Guest sources & episode script, teleprompter, multi-platform live simulcast & WhisperX clips",
    tool: "Script Studio + Multi-RTMP + Castopod",
    leadRole: "podcast_producer",
    colorVar: "var(--scen-podcast)"
  },
  {
    id: "article",
    label: "Article",
    short: "Article",
    description: "Online Research Desk source gathering, Brainstorm & Rich HTML Composer -> EmDash CMS + Listmonk",
    tool: "Source Desk -> Rich Editor -> EmDash",
    leadRole: "editor_newsletter",
    colorVar: "var(--scen-article)"
  },
  {
    id: "video",
    label: "Videos & Shorts",
    short: "Videos & Shorts",
    description: "Produce normal 16:9 videos & 9:16 vertical Shorts/Reels: sources, script, SRT captions & aspect export",
    tool: "Source Desk + Video/Shorts Editor + Resolve",
    leadRole: "video_producer",
    colorVar: "var(--scen-gaming)"
  },
  {
    id: "social",
    label: "Thumbnails, GIFs & Social",
    short: "Thumbnails & GIFs",
    description: "Image Search, 16:9 YouTube Thumbnail CTR Designer, Animated GIF Maker & Postiz Scheduler",
    tool: "Thumbnail & GIF Studio + Postiz",
    leadRole: "social_manager",
    colorVar: "var(--scen-social)"
  }
];

export const PIPELINE_STAGES = [
  { id: "capture", label: "Capture", subtitle: "TriliumNext" },
  { id: "produce", label: "Produce", subtitle: "OBS / DaVinci Resolve" },
  { id: "hub", label: "Hub", subtitle: "EmDash / RSS" },
  { id: "distribute", label: "Distribute", subtitle: "YT, Castopod, Listmonk, Postiz" }
];

export const SPONSOR_STAGES = [
  "Lead",
  "Negotiating",
  "SOW Signed",
  "Deliverables Live",
  "Paid"
];

export const ROLES = [
  {
    id: "ultimate_master",
    name: "Ultimate Master (NewLifeCorp Founder)",
    badge: "ULTIMATE MASTER",
    scope: "platform",
    tier: "master",
    tone: "warn",
    summary: "Supreme platform authority above all tenants & God Mode: market/sell SaaS plans on newlifecorp.io, manage subscriptions (GodFlow & Tradester), release 3-version Suite modules, and emulate any workspace in Sandbox.",
    scenarios: ["stock", "music", "podcast", "article", "video", "social"],
    allowedRoutes: ["newlifecorp", "command", "subscriptions", "suite", "emulate", "studio", "calendar", "pipeline", "hub", "distribution", "affiliates", "sponsors", "finance", "team", "admin", "system"],
    allowedTools: ["*"],
    permissions: ["*", "platform:master", "platform:maintenance", "plugins:write", "suite:write", "subscriptions:write", "emulate:all", "billing:master", "tenants:sell", "tenants:suspend", "tenants:inspect", "rls:override", "impersonate:all"]
  },
  {
    id: "ultimate_maintenance",
    name: "Ultimate Maintenance (Platform SRE & Plugins)",
    badge: "ULTIMATE MAINTENANCE",
    scope: "platform",
    tier: "maintenance",
    tone: "info",
    summary: "Platform SRE, Suite Releases, Sandbox Emulator & Integrations operator: manage 3-version suite modules (Experimental/Current/LTS), test GodFlow & Tradester in sandbox, monitor live users, and recover BullMQ queues.",
    scenarios: [],
    allowedRoutes: ["command", "subscriptions", "suite", "emulate", "admin", "system"],
    allowedTools: ["system:all", "plugins:all"],
    permissions: ["platform:maintenance", "plugins:write", "suite:write", "emulate:all", "system:write", "tenants:inspect"]
  },
  {
    id: "god_mode",
    name: "God Mode (Company Owner)",
    badge: "GOD MODE",
    scope: "tenant",
    tier: "platform",
    tone: "info",
    summary: "Company owner superuser: emulate team creators in sandbox, inspect PostgreSQL RLS, manage teams, delegate section leads & channels, and configure workspace feature flags.",
    scenarios: ["stock", "music", "podcast", "article", "video", "social"],
    allowedRoutes: ["command", "subscriptions", "suite", "emulate", "studio", "calendar", "pipeline", "hub", "distribution", "affiliates", "sponsors", "finance", "team", "admin", "system"],
    allowedTools: ["*"],
    permissions: ["*", "rls:override", "emulate:tenant"]
  },
  {
    id: "tenant_admin",
    name: "Workspace Admin",
    badge: "ADMIN",
    scope: "tenant",
    tier: "admin",
    tone: "ok",
    summary: "Full administrative control inside active company tenant: sections, Team Leads, role delegation, subscriptions, sandbox emulation, sponsors, /go links, system queues, and all 6 creator studios.",
    scenarios: ["stock", "music", "podcast", "article", "video", "social"],
    allowedRoutes: ["command", "subscriptions", "suite", "emulate", "studio", "calendar", "pipeline", "hub", "distribution", "affiliates", "sponsors", "finance", "team", "admin", "system"],
    allowedTools: ["*"],
    permissions: ["pipeline:write", "hub:write", "distribution:write", "links:write", "sponsors:write", "finance:read", "finance:write", "system:write", "team:write", "tenant:admin", "emulate:tenant"]
  },
  {
    id: "trader_host",
    name: "Live Stream Lead",
    badge: "LIVE STREAM",
    scope: "tenant",
    tier: "creator",
    tone: "ok",
    summary: "Scoped to Live Stream Studio (Source gathering, Broadcast scenes, watchlists & replay clips), Live pipeline, calendar blocks, and /go links.",
    scenarios: ["stock"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "affiliates"],
    allowedTools: ["studio:stock", "obs:live", "affiliates:finance"],
    permissions: ["pipeline:write", "links:write"]
  },
  {
    id: "gaming_creator",
    name: "Live Production & Replay Operator",
    badge: "LIVE OPS",
    scope: "tenant",
    tier: "creator",
    tone: "info",
    summary: "Scoped to Live Stream Studio (Dual-PC OBS, replay clipping & multi-track audio), Live pipeline, calendar blocks, and clip queue.",
    scenarios: ["stock"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "distribution"],
    allowedTools: ["studio:stock", "obs:live", "distribution:social"],
    permissions: ["pipeline:write", "distribution:write"]
  },
  {
    id: "music_artist",
    name: "Music Producer & Engineer",
    badge: "MUSIC",
    scope: "tenant",
    tier: "creator",
    tone: "warn",
    summary: "Scoped to Music Studio (Source references, Stems Mixer & Lyrics Composer), Music pipeline, and Content Hub Music Releases.",
    scenarios: ["music"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "hub"],
    allowedTools: ["studio:music", "hub:music"],
    permissions: ["pipeline:write", "hub:write"]
  },
  {
    id: "podcast_producer",
    name: "Podcast Host, Scriptwriter & Live Caster",
    badge: "PODCAST",
    scope: "tenant",
    tier: "creator",
    tone: "warn",
    summary: "Scoped to Podcast Script Writer, Multi-Platform Live Simulcast Studio, Podcast pipeline, Hub Podcast Episodes, Distribution & Guest Releases.",
    scenarios: ["podcast"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "hub", "distribution", "sponsors"],
    allowedTools: ["studio:podcast", "hub:podcast", "distribution:social", "sponsors:guests"],
    permissions: ["pipeline:write", "hub:write", "distribution:write", "sponsors:guests"]
  },
  {
    id: "editor_newsletter",
    name: "Article, Research & Newsletter Lead",
    badge: "ARTICLE",
    scope: "tenant",
    tier: "creator",
    tone: "info",
    summary: "Scoped to Article Source Gathering Desk + Brainstorm + Rich Text/HTML Article Editor, Article pipeline, Hub Articles, and Email Broadcasts.",
    scenarios: ["article"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "hub", "distribution"],
    allowedTools: ["studio:article", "hub:articles", "distribution:email"],
    permissions: ["pipeline:write", "hub:write", "distribution:write"]
  },
  {
    id: "video_producer",
    name: "Videos & Shorts Producer",
    badge: "VIDEOS & SHORTS",
    scope: "tenant",
    tier: "creator",
    tone: "info",
    summary: "Scoped to Videos & Shorts Studio (Source Gathering, 16:9 Full Video & 9:16 Vertical Shorts Script/SRT Editor & Export), Pipeline, Hub & Distribution.",
    scenarios: ["video"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "hub", "distribution"],
    allowedTools: ["studio:video", "hub:videos", "distribution:social"],
    permissions: ["pipeline:write", "hub:write", "distribution:write"]
  },
  {
    id: "social_manager",
    name: "Thumbnails, GIFs & Social Lead",
    badge: "THUMBNAILS & GIFS",
    scope: "tenant",
    tier: "creator",
    tone: "info",
    summary: "Scoped to Thumbnails, Animated GIF Maker & Visual Social Studio, Pipeline, Social Scheduler, and UTM Builder.",
    scenarios: ["social"],
    allowedRoutes: ["command", "studio", "calendar", "pipeline", "distribution", "affiliates"],
    allowedTools: ["studio:social", "distribution:social", "affiliates:utm"],
    permissions: ["pipeline:write", "distribution:write"]
  },
  {
    id: "finance_ops",
    name: "Finance & Sponsor Ops",
    badge: "FINANCE / CRM",
    scope: "tenant",
    tier: "ops",
    tone: "ok",
    summary: "Scoped to Sponsors CRM, Multi-Currency Invoices, Unified Ledger, and Affiliate Revenue; creative studios stay confidential.",
    scenarios: [],
    allowedRoutes: ["command", "calendar", "sponsors", "finance", "affiliates"],
    allowedTools: ["sponsors:all", "finance:all", "affiliates:all"],
    permissions: ["sponsors:write", "finance:read", "finance:write", "links:write"]
  },
  {
    id: "guest_viewer",
    name: "Guest / Sponsor Viewer",
    badge: "PORTAL VIEWER",
    scope: "tenant",
    tier: "external",
    tone: "warn",
    summary: "External collaborator portal: strictly isolated to assigned public deliverables and Live Media Kit. All internal projects, teams, and financials remain confidential.",
    scenarios: [],
    allowedRoutes: ["command", "sponsors"],
    allowedTools: ["sponsors:mediakit"],
    permissions: ["read:only", "portal:viewer"]
  }
];

export function createInitialSeed() {
  return {
    session: {
      authenticated: false,
      authView: "public",
      realUserId: "usr-master",
      activeUserId: "usr-master",
      activeWorkspaceId: "ws-godflow",
      activeChannelId: "all",
      activeRoleId: "ultimate_master",
      waterfallLevel: "platform",
      ultimateModeEnabled: true,
      godModeEnabled: true,
      crossTenantView: false
    },

    sandbox: {
      active: false,
      label: "Production Live",
      enteredAt: null,
      changesCount: 0,
      productionShadow: null,
      returnSession: null
    },

    platformData: {
      companyName: "NewLifeCorp",
      domain: "newlifecorp.io",
      tagline: "Sell, Provision & Govern Multi-Tenant Creator Operating Systems",
      heroHeadline: "Launch Your Autonomous Media & Creator Company on NewLifeCorp",
      heroSubhead: "One multi-tenant platform powering GodFlow and Tradester: Live Stream, Music, Podcast, Article, Videos & Shorts, and Thumbnails/GIFs & Social — all isolated with strict RBAC and 3-track module rollouts.",
      saasPlans: [
        {
          id: "plan-starter",
          name: "Starter Studio",
          monthlyPriceUsd: 149,
          isCustom: false,
          seatLimit: 5,
          channelLimit: 2,
          storageGb: 500,
          badge: "TIER 1 · STARTER",
          summary: "Launch your first channel website, all 6 creator studios with source gathering, and work-watcher calendar.",
          features: ["Up to 5 RBAC team seats", "2 branded websites + /go engine", "All 6 creator studios (Articles, Videos/Shorts, Thumbnails/GIFs, Podcast, Music, Live)", "TriliumNext ETAPI + Listmonk + SQLite DB"]
        },
        {
          id: "plan-growth",
          name: "Growth Multi-Channel",
          monthlyPriceUsd: 399,
          isCustom: false,
          seatLimit: 25,
          channelLimit: 10,
          storageGb: 2500,
          badge: "TIER 2 · MOST POPULAR",
          summary: "Operate multi-channel company brands with section Team Leads, Research & Content delegation & multi-platform simulcasting.",
          features: ["Up to 25 RBAC seats + section Lead/Research/Content units", "10 independent channel websites & RSS feeds", "Multi-platform Podcast & Live Simulcasts", "Multi-currency B2B sponsor invoicing & /go analytics"]
        },
        {
          id: "plan-ultimate",
          name: "Ultimate Enterprise Suite",
          monthlyPriceUsd: 1499,
          isCustom: false,
          seatLimit: 150,
          channelLimit: 100,
          storageGb: 15000,
          badge: "TIER 3 · ULTIMATE SUITE",
          summary: "Full multi-tenant governance with PostgreSQL 17 RLS, 3-track module releases (Experimental/Current/LTS), and Sandbox Working Copy emulation.",
          features: [
            "Up to 150 seats & 100 channel domains",
            "3-Track Module Releases (Experimental / Current / LTS)",
            "Sandbox Working Copy Emulator & Role Delegation Matrix",
            "Dedicated BullMQ transcode + BTCPay Lightning settlement"
          ]
        },
        {
          id: "plan-custom",
          name: "Custom Enterprise Plan",
          monthlyPriceUsd: 0,
          isCustom: true,
          priceLabel: "Custom",
          seatLimit: 500,
          channelLimit: 500,
          storageGb: 50000,
          badge: "CUSTOM QUOTE",
          summary: "Tailored multi-tenant deployment built around your exact channels, compliance rules, custom integrations & dedicated SLA.",
          features: [
            "Custom seat, channel & R2 storage quotas",
            "Bespoke Suite plugins, SSO & white-label master console",
            "Isolated dedicated PostgreSQL 17 + R2 region pinning",
            "24/7 NewLifeCorp architect & onboarding SLA"
          ]
        }
      ],
      suiteModules: [
        {
          id: "mod-workbenches",
          name: "Scenario Workbenches, Script & Research Desk",
          category: "Creative Studios",
          affectedRoutes: ["studio", "pipeline"],
          enabledGlobally: true,
          defaultTrack: "current",
          description: "Powers all 6 production studios: Podcast Script + Live Simulcast, Article Research Desk + Rich HTML, Stock Live Terminal, Gaming Deck, Vocal Mastering, and Social Canvas.",
          versions: {
            experimental: {
              version: "3.4.0-exp.2",
              label: "New Experimental",
              releasedAt: "2026-11-24",
              summary: "AI Script Cue Assistant, Multi-RTMP Simulcast Monitor & 64-bit WebAudio DSP telemetry.",
              features: ["AI Script & Outline Compiler", "Multi-RTMP Podcast Simulcast", "64-bit Loudness Graph"]
            },
            current: {
              version: "3.2.1-current",
              label: "Current (Subscribed)",
              releasedAt: "2026-11-10",
              summary: "Standard production release with Podcast Script Writer, Research Desk, Brainstorm, Rich HTML Editor & Social Canvas.",
              features: ["6 Scenario Workbenches", "Podcast Script + Live Simulcast", "Research Desk + Canvas"]
            },
            lts: {
              version: "2.18.4-lts",
              label: "LTS (Stable)",
              releasedAt: "2026-08-01",
              summary: "Long-Term Support security/UI freeze for deterministic institutional and broadcast teams.",
              features: ["Classic 6-Bench Suite", "Static Script & HTML Composer", "Zero Breaking UI Changes"]
            }
          },
          config: { aiAssistEnabled: true, canvasExportMaxPx: 4096 }
        },
        {
          id: "mod-calendar",
          name: "Mega Work Watcher & Time Calendar",
          category: "Workforce Telemetry",
          affectedRoutes: ["calendar", "command"],
          enabledGlobally: true,
          defaultTrack: "current",
          description: "Month/Week/Day/Custom date scheduler with automatic live teammate work tracking and shift hour counters.",
          versions: {
            experimental: {
              version: "2.9.0-exp.1",
              label: "New Experimental",
              releasedAt: "2026-11-23",
              summary: "Predictive overtime heatmap, multi-timezone team matrix & smart idle auto-pause.",
              features: ["Predictive Overtime Heatmap", "Multi-TZ Matrix", "Smart Idle Auto-Pause"]
            },
            current: {
              version: "2.6.0-current",
              label: "Current (Subscribed)",
              releasedAt: "2026-11-04",
              summary: "Subscribed standard Mega Calendar with live HH:MM:SS teammate watchers and 1x/60x simulation speed.",
              features: ["Month/Week/Day/Custom Views", "Live HH:MM:SS Timers", "Auto Work-Block Recording"]
            },
            lts: {
              version: "2.1.5-lts",
              label: "LTS (Stable)",
              releasedAt: "2026-07-15",
              summary: "Verified fixed-timezone calendar grid with manual shift logging and zero background polling.",
              features: ["Fixed Schedule Grid", "Manual Work Logs", "Audit Timesheet CSV"]
            }
          },
          config: { autoTrackOnSave: true, defaultTickSpeed: 60 }
        },
        {
          id: "mod-cms-hub",
          name: "EmDash Multi-Domain CMS & Castopod Hub",
          category: "Publishing & Websites",
          affectedRoutes: ["hub", "distribution"],
          enabledGlobally: true,
          defaultTrack: "current",
          description: "Publishes GodFlow (GodFlow / GodFlow) and Tradester brand websites, daily statuses, short videos, Castopod RSS feeds & Listmonk newsletters.",
          versions: {
            experimental: {
              version: "4.3.0-exp.4",
              label: "New Experimental",
              releasedAt: "2026-11-24",
              summary: "Sub-second Edge ISR channel rebuilds, WhisperX chaptered transcripts & live status reactions.",
              features: ["Edge ISR Channel Deploy", "Interactive Transcript Chapters", "Status Reactions Sync"]
            },
            current: {
              version: "4.1.0-current",
              label: "Current (Subscribed)",
              releasedAt: "2026-11-01",
              summary: "Independent multi-channel domains, status wall, Castopod 2.0 RSS & TriliumNext ETAPI sync.",
              features: ["Multi-Channel Websites", "Status & Shorts Wall", "TriliumNext ETAPI Bridge"]
            },
            lts: {
              version: "3.14.2-lts",
              label: "LTS (Stable)",
              releasedAt: "2026-06-20",
              summary: "Deterministic Astro static publishing with immutable RSS permalinks.",
              features: ["Verified Static SSG", "Standard RSS 2.0", "Permalink Guarantee"]
            }
          },
          config: { instantRebuild: true, rssChapters: true }
        },
        {
          id: "mod-growth-links",
          name: "Affiliates /go Engine & Social Scheduler",
          category: "Growth & Attribution",
          affectedRoutes: ["affiliates", "distribution"],
          enabledGlobally: true,
          defaultTrack: "current",
          description: "First-party /go/:slug 302 redirect router, UTM campaign builder & Postiz social scheduling queue.",
          versions: {
            experimental: {
              version: "3.1.0-exp.2",
              label: "New Experimental",
              releasedAt: "2026-11-22",
              summary: "Geo-aware 302 smart redirects, multi-touch revenue attribution & auto-UTM tagging.",
              features: ["Geo Smart Routing", "Multi-Touch Attribution", "Auto-UTM Social Injection"]
            },
            current: {
              version: "2.8.3-current",
              label: "Current (Subscribed)",
              releasedAt: "2026-10-28",
              summary: "Custom shortDomain /go links, click sparklines, UTM builder & Postiz multi-channel queue.",
              features: ["Custom shortDomain Router", "Click Sparkline Telemetry", "Postiz Social Scheduler"]
            },
            lts: {
              version: "2.4.0-lts",
              label: "LTS (Stable)",
              releasedAt: "2026-05-12",
              summary: "Static edge 302 redirect rules with cookieless click counters.",
              features: ["Deterministic 302 Map", "Cookieless Counter", "CSV Link Export"]
            }
          },
          config: { autoUtmTagging: true, redirectCode: 302 }
        },
        {
          id: "mod-commerce",
          name: "Sponsors CRM, Media Kit & BTCPay Ledger",
          category: "Monetization & Finance",
          affectedRoutes: ["sponsors", "finance"],
          enabledGlobally: true,
          defaultTrack: "current",
          description: "Manages B2B sponsor deals, guest releases, Live Media Kits, multi-currency invoicing & BTCPay + Stripe ledger.",
          versions: {
            experimental: {
              version: "2.7.0-exp.1",
              label: "New Experimental",
              releasedAt: "2026-11-21",
              summary: "Automated sponsor milestone escrow, Lightning split payouts & live CPM rate calculator.",
              features: ["Auto-Escrow Milestones", "Lightning Split Payouts", "Dynamic CPM Modeler"]
            },
            current: {
              version: "2.5.0-current",
              label: "Current (Subscribed)",
              releasedAt: "2026-10-18",
              summary: "Sponsor CRM board, guest signature tracking, USD/EUR/GBP/BTC invoices & unified P&L ledger.",
              features: ["Sponsor Deal Pipeline", "Multi-Currency Invoicing", "Public Media Kit"]
            },
            lts: {
              version: "2.0.9-lts",
              label: "LTS (Stable)",
              releasedAt: "2026-04-30",
              summary: "Immutable double-entry audit ledger with manual settlement sign-off.",
              features: ["Locked Double-Entry Ledger", "Manual Settlement Sign-off", "Tax Audit Export"]
            }
          },
          config: { lightningEnabled: true, autoInvoiceRemind: true }
        },
        {
          id: "mod-governance",
          name: "Zero-Trust RBAC, Confidential Portals & Telemetry",
          category: "Security & Tenancy",
          affectedRoutes: ["team", "admin", "system"],
          enabledGlobally: true,
          defaultTrack: "current",
          description: "10-Role tenant RBAC isolation, Guest Viewer confidential portals, BullMQ monitors & PostgreSQL 17 RLS.",
          versions: {
            experimental: {
              version: "5.2.0-exp.3",
              label: "New Experimental",
              releasedAt: "2026-11-25",
              summary: "Adaptive session anomaly guard, per-field secret masking & strict WebAuthn step-up.",
              features: ["Anomaly Session Guard", "Field-Level Secret Mask", "WebAuthn Step-Up"]
            },
            current: {
              version: "5.0.2-current",
              label: "Current (Subscribed)",
              releasedAt: "2026-11-08",
              summary: "Channel/Scenario RBAC boundaries, Confidential Partner Portals & real-time system health telemetry.",
              features: ["Scenario & Channel RBAC", "Confidential Partner Portal", "PG17 RLS Telemetry"]
            },
            lts: {
              version: "4.12.0-lts",
              label: "LTS (Stable)",
              releasedAt: "2026-06-01",
              summary: "Frozen compliance RBAC permission matrix with deterministic audit logs.",
              features: ["Frozen Permission Matrix", "Deterministic Audit Log", "Compliance Lock"]
            }
          },
          config: { strictConfidentiality: true, passkeyRequired: false }
        }
      ],
      enterpriseLeads: [
        {
          id: "lead-nl-1",
          companyName: "PeakPulse Media Group",
          domain: "peakpulse.tv",
          contactName: "Daniel Cho",
          contactEmail: "daniel@peakpulse.tv",
          planId: "plan-growth",
          planName: "Growth Multi-Channel",
          monthlyPriceUsd: 399,
          channelsRequested: ["PeakPulse Daily (Shorts & Web)", "PulseDesk Live (Trading & Affiliates)"],
          scenarios: ["stock", "podcast", "article", "social"],
          teamSize: 11,
          status: "New Signup",
          createdAt: "18m ago"
        },
        {
          id: "lead-nl-2",
          companyName: "Solstice Audio & Press",
          domain: "solstice.fm",
          contactName: "Amara Okafor",
          contactEmail: "amara@solstice.fm",
          planId: "plan-enterprise",
          planName: "Enterprise Network",
          monthlyPriceUsd: 999,
          channelsRequested: ["Solstice Records", "Solstice Journal"],
          scenarios: ["music", "podcast", "article"],
          teamSize: 16,
          status: "Contract Sent",
          createdAt: "3h ago"
        }
      ],
      suitePlugins: [
        {
          id: "plg-trilium",
          name: "TriliumNext ETAPI Bridge",
          category: "Knowledge Capture",
          version: "v2.4.1",
          enabled: true,
          endpoint: "https://notes.newlifecorp.io/etapi",
          health: "Healthy · 14ms",
          description: "Polls #publish-ready tags across GodFlow & Tradester and compiles EmDash MDX branches.",
          configSummary: "interval=30s · autoAssetUpload=R2"
        },
        {
          id: "plg-emdash",
          name: "EmDash Multi-Domain CMS",
          category: "Websites & Articles",
          version: "v4.1.0",
          enabled: true,
          endpoint: "https://cms.newlifecorp.io/webhook",
          health: "Healthy · 22ms",
          description: "Publishes tenant channel websites (godflow.media, godflow.media, tradester.tv) & MDX embeds.",
          configSummary: "ssgRebuild=true · tlsAuto=ACME"
        },
        {
          id: "plg-castopod",
          name: "Castopod RSS + WhisperX Engine",
          category: "Podcast & Clipping",
          version: "v1.12.4",
          enabled: true,
          endpoint: "https://rss.newlifecorp.io/api",
          health: "Healthy · 38ms",
          description: "Host-normalized Podcasting 2.0 feeds, live RTMP podcast ingest & WhisperX diarization.",
          configSummary: "loudness=-16LUFS · model=whisperx-v3"
        },
        {
          id: "plg-postiz",
          name: "Postiz Social & Shorts Scheduler",
          category: "Social Distribution",
          version: "v3.8.0",
          enabled: true,
          endpoint: "https://social.newlifecorp.io/v3",
          health: "Degraded · 1 rate-limit",
          description: "Multi-channel publishing for YouTube Shorts, X, Instagram & LinkedIn.",
          configSummary: "retryBackoff=60s · queueConcurrency=4"
        },
        {
          id: "plg-listmonk",
          name: "Listmonk + Warmed SES Core",
          category: "Newsletter & Email",
          version: "v4.0.2",
          enabled: true,
          endpoint: "https://mail.newlifecorp.io/api",
          health: "Healthy · 18ms",
          description: "Isolated per-tenant subscriber lists with dual-domain DKIM signing.",
          configSummary: "poolIps=4 · bounceAutoSuppress=true"
        },
        {
          id: "plg-btcpay",
          name: "BTCPay Lightning & Stripe Rail",
          category: "Payments & Affiliates",
          version: "v1.13.5",
          enabled: true,
          endpoint: "https://pay.newlifecorp.io/webhooks",
          health: "Healthy · 11ms",
          description: "Handles multi-currency sponsor invoices, stream tips & affiliate attribution.",
          configSummary: "confirmations=1 · stripeConnect=live"
        }
      ],
      suiteConfigs: [
        { key: "enforcePg17Rls", label: "PostgreSQL 17 Strict Row-Level Security", type: "toggle", value: true, detail: "Mandate app.current_tenant_id on all tenant queries" },
        { key: "autoFailoverWorker", label: "BullMQ Dead-Letter Auto-Retry", type: "toggle", value: true, detail: "Automatically requeue transient 429 webhook timeouts" },
        { key: "oauthPasskeyRequired", label: "Require WebAuthn Passkey for Admins", type: "toggle", value: true, detail: "Enforce hardware passkey check on tenant_admin elevation" },
        { key: "maintenanceBanner", label: "Global Suite Maintenance Window", type: "toggle", value: false, detail: "Show scheduled maintenance alert across GodFlow and Tradester" },
        { key: "defaultMaxUploadMb", label: "R2 Media Upload Cap (MB)", type: "number", value: 4096, detail: "Maximum multipart object size per tenant prefix" }
      ],
      integrationsStatus: [
        { id: "int-yt", name: "YouTube Live & Shorts API", latency: "84 ms", status: "Connected", syncedTenants: 2 },
        { id: "int-obs", name: "OBS Studio WebSocket v5 Relay", latency: "6 ms", status: "Streaming", syncedTenants: 2 },
        { id: "int-tv", name: "TradingView Webhook Engine", latency: "19 ms", status: "Connected", syncedTenants: 2 },
        { id: "int-r2", name: "Cloudflare R2 S3 Storage Mesh", latency: "14 ms", status: "Healthy", syncedTenants: 2 }
      ]
    },

    workspaces: [
      {
        id: "ws-godflow",
        name: "GodFlow",
        slug: "godflow",
        domain: "godflow.media",
        shortDomain: "go.godflow.media",
        plan: "Ultimate Enterprise Suite",
        monthlyPriceUsd: 1499,
        seatLimit: 150,
        subscriptionStatus: "Active",
        ownerEmail: "alex@godflow.media",
        renewalDate: "2026-12-25",
        region: "us-east (PG17 Multi-Channel RLS)",
        activeScenarios: ["stock", "music", "podcast", "article", "video", "social"],
        newsletterSubscribers: 61420,
        newsletterDeltaMonth: 2940,
        newsletterOpenRate: 48.9,
        monthlyExpensesUsd: 2980,
        storageUsedGb: 1840,
        storageQuotaGb: 5000,
        channels: [
          {
            id: "ch-godflow",
            workspaceId: "ws-godflow",
            name: "GodFlow",
            slug: "godflow",
            badge: "GODFLOW",
            tone: "ok",
            domain: "godflow.media",
            shortDomain: "go.godflow.media",
            websiteUrl: "https://godflow.media",
            rssUrl: "https://castopod.godflow.media/@show/feed.xml",
            tagline: "Unified Articles, Videos & Shorts, Podcasts, Live Stream, Music & Website",
            capabilities: ["articles", "videos", "shorts", "podcasts", "live-streaming", "music", "affiliates", "website", "social"],
            scenarios: ["stock", "music", "podcast", "article", "video", "social"],
            socialHandles: ["YouTube @GodFlow", "X @godflow_media", "Instagram @godflow.media", "godflow.media"],
            monthlyVisitors: 326700,
            subscribers: 61420,
            websiteSummary: "Flagship GodFlow website, Castopod RSS, live stream player, /go affiliates & social hub."
          }
        ],
        teams: [
          {
            id: "tm-gf-article",
            name: "Article & Editorial Section",
            scenario: "article",
            channelIds: ["ch-godflow"],
            leadUserId: "usr-nadia",
            memberIds: ["usr-nadia", "usr-maya", "usr-hannah"],
            focus: "Team Lead oversees Research Team sources, Content Team Rich HTML drafting & Listmonk dispatch",
            assignments: [
              { userId: "usr-nadia", unit: "Team Lead", subRole: "Section Lead & Chief Editor" },
              { userId: "usr-hannah", unit: "Research Team", subRole: "Fact-Checking & Source Data Research" },
              { userId: "usr-maya", unit: "Content Team", subRole: "Long-Form Editing & Newsletter QC" }
            ]
          },
          {
            id: "tm-gf-podcast",
            name: "Podcast & Audio Section",
            scenario: "podcast",
            channelIds: ["ch-godflow"],
            leadUserId: "usr-liam",
            memberIds: ["usr-liam", "usr-nadia", "usr-devon"],
            focus: "Team Lead runs script & simulcast; Research prepares guest briefs; Distribution cuts clips",
            assignments: [
              { userId: "usr-liam", unit: "Team Lead", subRole: "Host, Scriptwriter & Simulcast Lead" },
              { userId: "usr-nadia", unit: "Research Team", subRole: "Guest Prep, Outline & Show Notes" },
              { userId: "usr-devon", unit: "Content Team", subRole: "WhisperX Shorts & Audiogram Reels" }
            ]
          },
          {
            id: "tm-gf-live",
            name: "Live Stream Section",
            scenario: "stock",
            channelIds: ["ch-godflow"],
            leadUserId: "usr-tariq",
            memberIds: ["usr-tariq", "usr-kira", "usr-hannah"],
            focus: "OBS 4K broadcasts, live Q&A, Dual-PC replay clips, pre-show research & /go links",
            assignments: [
              { userId: "usr-tariq", unit: "Team Lead", subRole: "Live Broadcast Lead & Anchor" },
              { userId: "usr-kira", unit: "Live Ops & Broadcast", subRole: "Dual-PC OBS Scenes, Replay & Squad Audio" },
              { userId: "usr-hannah", unit: "Research Team", subRole: "Pre-Show Desk Research & Affiliate Tracking" }
            ]
          },
          {
            id: "tm-gf-music",
            name: "Music Production Section",
            scenario: "music",
            channelIds: ["ch-godflow"],
            leadUserId: "usr-sora",
            memberIds: ["usr-sora", "usr-liam", "usr-devon"],
            focus: "Vocal tracking & stems, mixing/mastering & visual release promos",
            assignments: [
              { userId: "usr-sora", unit: "Team Lead", subRole: "Vocal Artist & Master Producer" },
              { userId: "usr-liam", unit: "Content Team", subRole: "Acoustic Session Recording & Mixing" },
              { userId: "usr-devon", unit: "Distribution & Growth", subRole: "Lyrics Hub, Artwork & Promo Shorts" }
            ]
          },
          {
            id: "tm-gf-video",
            name: "Videos & Shorts Section",
            scenario: "video",
            channelIds: ["ch-godflow"],
            leadUserId: "usr-ava",
            memberIds: ["usr-ava", "usr-devon", "usr-liam"],
            focus: "16:9 YouTube deep dives, 9:16 vertical Shorts, SRT captions & chapter hooks",
            assignments: [
              { userId: "usr-ava", unit: "Team Lead", subRole: "Lead Video Editor & Shorts Director" },
              { userId: "usr-devon", unit: "Distribution & Growth", subRole: "CTR Thumbnails, GIFs & Postiz Shorts" },
              { userId: "usr-liam", unit: "Content Team", subRole: "Podcast Highlight B-Roll & Scripting" }
            ]
          },
          {
            id: "tm-gf-social",
            name: "Thumbnails, GIFs & Partner Section",
            scenario: "social",
            channelIds: ["ch-godflow"],
            leadUserId: "usr-devon",
            memberIds: ["usr-devon", "usr-alex", "usr-maya", "usr-elena"],
            focus: "YouTube thumbnails, animated GIFs, executive oversight & external partner approvals",
            assignments: [
              { userId: "usr-devon", unit: "Team Lead", subRole: "Thumbnails, GIF Maker & Social Lead" },
              { userId: "usr-alex", unit: "Content Team", subRole: "Owner Editorial Strategy & Flagship Drops" },
              { userId: "usr-maya", unit: "Distribution & Growth", subRole: "Cross-Channel Scheduling & Operations" },
              { userId: "usr-elena", unit: "Finance & Partner Ops", subRole: "External Sponsor Portal Reviewer" }
            ]
          }
        ],
        flags: {
          etapiSync: true,
          btcpayLightning: true,
          postizAutopublish: true,
          publicMediaKit: true,
          maintenanceMode: false
        },
        suiteSubscriptions: {
          "mod-workbenches": { enabled: true, track: "current", installedVersion: "3.2.1-current", autoUpgrade: true },
          "mod-calendar": { enabled: true, track: "current", installedVersion: "2.6.0-current", autoUpgrade: true },
          "mod-cms-hub": { enabled: true, track: "experimental", installedVersion: "4.3.0-exp.4", autoUpgrade: true },
          "mod-growth-links": { enabled: true, track: "current", installedVersion: "2.8.3-current", autoUpgrade: true },
          "mod-commerce": { enabled: true, track: "current", installedVersion: "2.5.0-current", autoUpgrade: false },
          "mod-governance": { enabled: true, track: "lts", installedVersion: "4.12.0-lts", autoUpgrade: false }
        }
      },
      {
        id: "ws-tradester",
        name: "Tradester",
        slug: "tradester",
        domain: "tradester.tv",
        shortDomain: "go.tradester.tv",
        plan: "Growth Multi-Channel",
        monthlyPriceUsd: 399,
        seatLimit: 18,
        subscriptionStatus: "Active",
        ownerEmail: "marcus@tradester.tv",
        renewalDate: "2026-12-20",
        region: "us-east (PG17 Multi-Tenant)",
        activeScenarios: ["stock", "video", "podcast", "article", "social"],
        newsletterSubscribers: 54210,
        newsletterDeltaMonth: 2890,
        newsletterOpenRate: 51.4,
        monthlyExpensesUsd: 3420,
        storageUsedGb: 780,
        storageQuotaGb: 2000,
        channels: [
          {
            id: "ch-tr-live",
            workspaceId: "ws-tradester",
            name: "Tradester Live Markets",
            slug: "tradester-live",
            badge: "TRADESTER LIVE",
            tone: "ok",
            domain: "live.tradester.tv",
            shortDomain: "go.tradester.tv",
            websiteUrl: "https://live.tradester.tv",
            rssUrl: "https://castopod.tradester.tv/@markets/feed.xml",
            tagline: "Live broadcasts, trader podcasts & affiliate routing",
            capabilities: ["live-streaming", "podcasts", "affiliates", "website"],
            scenarios: ["stock", "podcast"],
            socialHandles: ["YouTube @TradesterTV", "X @tradester_tv", "live.tradester.tv"],
            monthlyVisitors: 210000,
            subscribers: 38400,
            websiteSummary: "Live broadcast desk, multi-platform podcast show & /go affiliate links."
          },
          {
            id: "ch-tr-research",
            workspaceId: "ws-tradester",
            name: "Tradester Research & Media",
            slug: "tradester-research",
            badge: "RESEARCH DESK",
            tone: "info",
            domain: "research.tradester.tv",
            shortDomain: "go.tradester.tv",
            websiteUrl: "https://research.tradester.tv",
            rssUrl: "https://research.tradester.tv/rss.xml",
            tagline: "Macro briefs, Videos & Shorts, Chart Thumbnails & institutional newsletter",
            capabilities: ["articles", "videos", "shorts", "posts", "website", "social"],
            scenarios: ["article", "video", "social"],
            socialHandles: ["X @tradester_desk", "LinkedIn Tradester", "research.tradester.tv"],
            monthlyVisitors: 118000,
            subscribers: 15810,
            websiteSummary: "Institutional macro reports, chart cards, and Listmonk market newsletter."
          }
        ],
        teams: [
          {
            id: "tm-tr-live",
            name: "Live Stream Section",
            scenario: "stock",
            channelIds: ["ch-tr-live"],
            leadUserId: "usr-tr-vikram",
            memberIds: ["usr-tr-vikram", "usr-tr-leo", "usr-tr-omar"],
            focus: "Team Lead hosts live desk; Live Ops manages multi-cam overlays; Research briefs catalysts",
            assignments: [
              { userId: "usr-tr-vikram", unit: "Team Lead", subRole: "Live Broadcast Lead & Host" },
              { userId: "usr-tr-leo", unit: "Live Ops & Broadcast", subRole: "OBS Multi-Cam & Replay Production" },
              { userId: "usr-tr-omar", unit: "Research Team", subRole: "Pre-Stream Catalyst & Watchlist Prep" }
            ]
          },
          {
            id: "tm-tr-podcast",
            name: "Podcast & Simulcast Section",
            scenario: "podcast",
            channelIds: ["ch-tr-live", "ch-tr-research"],
            leadUserId: "usr-tr-chloe",
            memberIds: ["usr-tr-chloe", "usr-tr-omar", "usr-tr-nina"],
            focus: "Script writing, live simulcast shows & short-form distribution",
            assignments: [
              { userId: "usr-tr-chloe", unit: "Team Lead", subRole: "Podcast Script & Live Host Lead" },
              { userId: "usr-tr-omar", unit: "Research Team", subRole: "Guest Briefings & Show Data Research" },
              { userId: "usr-tr-nina", unit: "Distribution & Growth", subRole: "WhisperX Clips & Social Cutdowns" }
            ]
          },
          {
            id: "tm-tr-article",
            name: "Article & Research Section",
            scenario: "article",
            channelIds: ["ch-tr-research"],
            leadUserId: "usr-tr-omar",
            memberIds: ["usr-tr-omar", "usr-tr-marcus", "usr-tr-priya"],
            focus: "Research Desk essays, Content Team review & Listmonk institutional dispatches",
            assignments: [
              { userId: "usr-tr-omar", unit: "Team Lead", subRole: "Head of Research & Lead Author" },
              { userId: "usr-tr-marcus", unit: "Content Team", subRole: "Editorial Sign-Off & Operations" },
              { userId: "usr-tr-priya", unit: "Finance & Partner Ops", subRole: "Sponsor Disclosures & Billing Alignment" }
            ]
          },
          {
            id: "tm-tr-video",
            name: "Videos & Shorts Section",
            scenario: "video",
            channelIds: ["ch-tr-live", "ch-tr-research"],
            leadUserId: "usr-tr-noah",
            memberIds: ["usr-tr-noah", "usr-tr-nina", "usr-tr-chloe"],
            focus: "16:9 market recap videos, 9:16 vertical Shorts cuts & SRT captions",
            assignments: [
              { userId: "usr-tr-noah", unit: "Team Lead", subRole: "Video & Shorts Director (16:9 + 9:16)" },
              { userId: "usr-tr-nina", unit: "Distribution & Growth", subRole: "Thumbnails, GIF Previews & Shorts Publish" },
              { userId: "usr-tr-chloe", unit: "Content Team", subRole: "Video Hooks & Research Callouts" }
            ]
          },
          {
            id: "tm-tr-social",
            name: "Thumbnails, GIFs & Growth Section",
            scenario: "social",
            channelIds: ["ch-tr-research", "ch-tr-live"],
            leadUserId: "usr-tr-nina",
            memberIds: ["usr-tr-nina", "usr-tr-chloe", "usr-tr-guest"],
            focus: "CTR thumbnails, animated market GIFs, UTM tracking & external partner visibility",
            assignments: [
              { userId: "usr-tr-nina", unit: "Team Lead", subRole: "Thumbnails, GIF Maker & Growth Lead" },
              { userId: "usr-tr-chloe", unit: "Content Team", subRole: "Podcast Highlight Captions & Copy" },
              { userId: "usr-tr-guest", unit: "Finance & Partner Ops", subRole: "Sponsor Read-Only Portal Reviewer" }
            ]
          }
        ],
        flags: {
          etapiSync: true,
          btcpayLightning: true,
          postizAutopublish: true,
          publicMediaKit: true,
          maintenanceMode: false
        },
        suiteSubscriptions: {
          "mod-workbenches": { enabled: true, track: "lts", installedVersion: "2.18.4-lts", autoUpgrade: false },
          "mod-calendar": { enabled: true, track: "lts", installedVersion: "2.1.5-lts", autoUpgrade: false },
          "mod-cms-hub": { enabled: true, track: "current", installedVersion: "4.1.0-current", autoUpgrade: true },
          "mod-growth-links": { enabled: true, track: "current", installedVersion: "2.8.3-current", autoUpgrade: true },
          "mod-commerce": { enabled: true, track: "lts", installedVersion: "2.0.9-lts", autoUpgrade: false },
          "mod-governance": { enabled: true, track: "lts", installedVersion: "4.12.0-lts", autoUpgrade: false }
        }
      }
    ],

    users: [
      /* Platform Root (Strictly 2 Users: Ultimate Master & Ultimate Maintenance) */
      {
        id: "usr-master",
        name: "Arnold",
        username: "arnold",
        password: "1Admin",
        initials: "AR",
        email: "master@newlifecorp.io",
        title: "Founder & Ultimate Master · NewLifeCorp",
        userScope: "platform",
        defaultRoleId: "ultimate_master",
        workspaceIds: [],
        channelIds: [],
        primaryScenarios: [],
        presence: "Platform Master Active",
        passkeyEnabled: true
      },
      {
        id: "usr-maint",
        name: "Bablu",
        username: "bablu",
        password: "1Admin",
        initials: "BB",
        email: "ops@newlifecorp.io",
        title: "Ultimate Maintenance · Plugins, SRE & Integrations",
        userScope: "platform",
        defaultRoleId: "ultimate_maintenance",
        workspaceIds: [],
        channelIds: [],
        primaryScenarios: [],
        presence: "Suite Monitor Active",
        passkeyEnabled: true
      },

      /* TENANT 1: GodFlow (ws-godflow) — All Company Teams Inside GodFlow */
      {
        id: "usr-alex",
        name: "Alex Mercer",
        initials: "AM",
        email: "alex@godflow.media",
        title: "Founder & God Mode Owner · GodFlow",
        userScope: "tenant",
        defaultRoleId: "god_mode",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["stock", "music", "podcast", "article"],
        presence: "Live in Studio",
        passkeyEnabled: true
      },
      {
        id: "usr-maya",
        name: "Maya Lin",
        initials: "ML",
        email: "maya@godflow.media",
        title: "Workspace Admin (GodFlow)",
        userScope: "tenant",
        defaultRoleId: "tenant_admin",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["podcast", "article"],
        presence: "Online",
        passkeyEnabled: true
      },
      {
        id: "usr-nadia",
        name: "Nadia Petrova",
        initials: "NP",
        email: "nadia@godflow.media",
        title: "Article Team Lead · GodFlow",
        userScope: "tenant",
        defaultRoleId: "editor_newsletter",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["article"],
        presence: "Writing Article",
        passkeyEnabled: true
      },
      {
        id: "usr-liam",
        name: "Liam O'Connor",
        initials: "LO",
        email: "liam@godflow.media",
        title: "Podcast Scriptwriter & Live Host · GodFlow",
        userScope: "tenant",
        defaultRoleId: "podcast_producer",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["podcast"],
        presence: "Podcast Script + Simulcast Ready",
        passkeyEnabled: true
      },
      {
        id: "usr-tariq",
        name: "Tariq Al-Mansoor",
        initials: "TA",
        email: "tariq@godflow.media",
        title: "Live Stream Lead · GodFlow Desk",
        userScope: "tenant",
        defaultRoleId: "trader_host",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["stock"],
        presence: "GodFlow Live Ready",
        passkeyEnabled: true
      },
      {
        id: "usr-kira",
        name: "Kira Sato",
        initials: "KS",
        email: "kira@godflow.media",
        title: "Live Ops & Replay Producer · GodFlow",
        userScope: "tenant",
        defaultRoleId: "gaming_creator",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["stock"],
        presence: "OBS Connected",
        passkeyEnabled: false
      },
      {
        id: "usr-devon",
        name: "Devon Brooks",
        initials: "DB",
        email: "devon@godflow.media",
        title: "Social & Shorts Designer · GodFlow",
        userScope: "tenant",
        defaultRoleId: "social_manager",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["social"],
        presence: "Posting GodFlow Shorts",
        passkeyEnabled: false
      },
      {
        id: "usr-sora",
        name: "Sora Takahashi",
        initials: "ST",
        email: "sora@godflow.media",
        title: "Music & Vocal Producer · GodFlow",
        userScope: "tenant",
        defaultRoleId: "music_artist",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["music"],
        presence: "Tracking Vocals",
        passkeyEnabled: true
      },
      {
        id: "usr-hannah",
        name: "Hannah Cho",
        initials: "HC",
        email: "hannah@godflow.media",
        title: "Finance Controller & Affiliate Ops · GodFlow",
        userScope: "tenant",
        defaultRoleId: "finance_ops",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: [],
        presence: "Online",
        passkeyEnabled: true
      },
      {
        id: "usr-ava",
        name: "Ava Chen",
        initials: "AC",
        email: "ava@godflow.media",
        title: "Videos & Shorts Producer · GodFlow",
        userScope: "tenant",
        defaultRoleId: "video_producer",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: ["video"],
        presence: "Editing 16:9 + 9:16 Cuts",
        passkeyEnabled: true
      },
      {
        id: "usr-elena",
        name: "Elena Vance",
        initials: "EV",
        email: "elena@tradingview.com",
        title: "External Sponsor Partner · GodFlow",
        userScope: "tenant",
        defaultRoleId: "guest_viewer",
        workspaceIds: ["ws-godflow"],
        channelIds: ["ch-godflow"],
        primaryScenarios: [],
        presence: "Partner Portal",
        passkeyEnabled: false
      },

      /* TENANT 2: Tradester (ws-tradester) — Respective Teams & Users Inside Tradester */
      {
        id: "usr-tr-marcus",
        name: "Marcus Hale",
        initials: "MH",
        email: "marcus@tradester.tv",
        title: "Head of Operations & Admin · Tradester",
        userScope: "tenant",
        defaultRoleId: "tenant_admin",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live", "ch-tr-research"],
        primaryScenarios: ["stock", "podcast", "article"],
        presence: "Online · Tradester HQ",
        passkeyEnabled: true
      },
      {
        id: "usr-tr-vikram",
        name: "Vikram Rao",
        initials: "VR",
        email: "vikram@tradester.tv",
        title: "Live Markets Stream Lead · Tradester",
        userScope: "tenant",
        defaultRoleId: "trader_host",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live"],
        primaryScenarios: ["stock"],
        presence: "Live Bell Armed",
        passkeyEnabled: true
      },
      {
        id: "usr-tr-leo",
        name: "Leo Fernandez",
        initials: "LF",
        email: "leo@tradester.tv",
        title: "Live Ops & Broadcast Operator · Tradester",
        userScope: "tenant",
        defaultRoleId: "gaming_creator",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live"],
        primaryScenarios: ["stock"],
        presence: "Multi-Cam Standby",
        passkeyEnabled: false
      },
      {
        id: "usr-tr-chloe",
        name: "Chloe Kim",
        initials: "CK",
        email: "chloe@tradester.tv",
        title: "Podcast Scriptwriter & Live Host · Tradester",
        userScope: "tenant",
        defaultRoleId: "podcast_producer",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live", "ch-tr-research"],
        primaryScenarios: ["podcast"],
        presence: "Prepping Show Script",
        passkeyEnabled: true
      },
      {
        id: "usr-tr-omar",
        name: "Omar Farooq",
        initials: "OF",
        email: "omar@tradester.tv",
        title: "Macro Research & Article Lead · Tradester",
        userScope: "tenant",
        defaultRoleId: "editor_newsletter",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-research"],
        primaryScenarios: ["article"],
        presence: "Writing Macro Brief",
        passkeyEnabled: true
      },
      {
        id: "usr-tr-nina",
        name: "Nina Alvarez",
        initials: "NA",
        email: "nina@tradester.tv",
        title: "Social Charts & Shorts Designer · Tradester",
        userScope: "tenant",
        defaultRoleId: "social_manager",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-research"],
        primaryScenarios: ["social"],
        presence: "Exporting Gamma Card",
        passkeyEnabled: false
      },
      {
        id: "usr-tr-priya",
        name: "Priya Nair",
        initials: "PN",
        email: "priya@tradester.tv",
        title: "Finance & Broker Affiliate Ops · Tradester",
        userScope: "tenant",
        defaultRoleId: "finance_ops",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live", "ch-tr-research"],
        primaryScenarios: [],
        presence: "Online",
        passkeyEnabled: true
      },
      {
        id: "usr-tr-noah",
        name: "Noah Sterling",
        initials: "NS",
        email: "noah@tradester.tv",
        title: "Videos & Shorts Lead · Tradester",
        userScope: "tenant",
        defaultRoleId: "video_producer",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live", "ch-tr-research"],
        primaryScenarios: ["video"],
        presence: "Rendering 4K Market Recap",
        passkeyEnabled: true
      },
      {
        id: "usr-tr-guest",
        name: "David Stern",
        initials: "DS",
        email: "david@cmegroup.com",
        title: "External Institutional Sponsor · Tradester",
        userScope: "tenant",
        defaultRoleId: "guest_viewer",
        workspaceIds: ["ws-tradester"],
        channelIds: ["ch-tr-live"],
        primaryScenarios: [],
        presence: "Partner Portal",
        passkeyEnabled: false
      }
    ],

    meta: {
      lastTriliumSync: "2026-11-25 00:58 EST"
    },

    channelStatuses: [
      {
        id: "st-gd-1",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        authorUserId: "usr-devon",
        mediaType: "Short Video + Status",
        title: "Morning Walk & Analog Focus Habits (00:48 Vertical Short)",
        body: "Today's GodFlow status: dropped the 6 AM coffee + offline reading checklist before opening laptops. Watch the 48s reel and grab the template on godflow.media.",
        publishedToWebsite: true,
        publishedToSocial: ["YouTube Shorts", "Instagram Reels", "X"],
        websitePath: "https://godflow.media/statuses/morning-walk-focus",
        engagementLabel: "14.2k views · 480 saves",
        createdAt: "25m ago",
        status: "Published"
      },
      {
        id: "st-gd-2",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        authorUserId: "usr-nadia",
        mediaType: "Text Status + Article Teaser",
        title: "New Sunday Essays Archive live on godflow.media",
        body: "Synced 3 longform essays on calmer creative routines to godflow.media/articles and auto-queued 2 carousel posts to X & LinkedIn.",
        publishedToWebsite: true,
        publishedToSocial: ["X", "LinkedIn"],
        websitePath: "https://godflow.media/articles/sunday-sprints-slow-web",
        engagementLabel: "3.8k reads · 214 shares",
        createdAt: "2h ago",
        status: "Published"
      },
      {
        id: "st-ac-1",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        authorUserId: "usr-tariq",
        mediaType: "Live Desk Notice",
        title: "GodFlow Live Q&A Desk opens at 09:00 EST on godflow.media/live",
        body: "Covering SaaS Treasury yields, cloud unit economics & /go/ask-cloud affiliate benchmark breakdown.",
        publishedToWebsite: true,
        publishedToSocial: ["YouTube Live", "X", "Twitch"],
        websitePath: "https://godflow.media/live",
        engagementLabel: "410 waiting",
        createdAt: "15m ago",
        status: "Armed"
      },
      {
        id: "st-tr-1",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-live",
        authorUserId: "usr-tr-vikram",
        mediaType: "Market Live Desk",
        title: "Tradester Opening Bell + Options Gamma Live Simulcast",
        body: "Streaming live on live.tradester.tv, YouTube Live, X Video & Twitch with real-time dealer hedging levels.",
        publishedToWebsite: true,
        publishedToSocial: ["YouTube Live", "X"],
        websitePath: "https://live.tradester.tv/bell",
        engagementLabel: "920 watching",
        createdAt: "10m ago",
        status: "Published"
      }
    ],

    workflowsToday: [
      /* GodFlow */
      {
        id: "wf-gd-shorts",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        scenario: "social",
        ownerUserId: "usr-devon",
        title: "GodFlow Shorts + Daily Status Wall Pack (3 Vertical Clips)",
        schedule: "Today · 10:30 EST",
        status: "Published Web + Social",
        statusTone: "ok",
        meta: "godflow.media/statuses · YT Shorts + IG Reels + X",
        pipelineId: "pipe-gd1"
      },
      {
        id: "wf-gd-article",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        scenario: "article",
        ownerUserId: "usr-nadia",
        title: "Building Calm Digital Gardens — GodFlow Website + Social Thread",
        schedule: "Today · 13:00 EST",
        status: "#publish-ready",
        statusTone: "info",
        meta: "godflow.media MDX + Listmonk + Postiz thread",
        pipelineId: "pipe-gd2"
      },
      {
        id: "wf-gd-podcast",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        scenario: "podcast",
        ownerUserId: "usr-liam",
        title: "GodFlow Ep. 92: Scripted Podcast + Multi-Platform Live Stream",
        schedule: "Live + RSS Armed",
        status: "Simulcast + Script Ready",
        statusTone: "ok",
        meta: "YouTube + X + Twitch + godflow.media/live · 45m script",
        pipelineId: "pipe-ac2"
      },
      {
        id: "wf-ac-live",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        scenario: "stock",
        ownerUserId: "usr-tariq",
        title: "GodFlow Live Stream: Enterprise Macro & Infra Earnings Desk",
        schedule: "Today · 09:00 EST",
        status: "OBS Live Armed",
        statusTone: "ok",
        meta: "godflow.media/live · YT + Twitch · /go/ask-broker pinned",
        pipelineId: "pipe-ac1"
      },
      {
        id: "wf-gf-gaming",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        scenario: "stock",
        ownerUserId: "usr-kira",
        title: "Dual-PC Night Live Stream: Challenge Run & Live Chat",
        schedule: "Tonight · 20:00 EST",
        status: "Overlay Synced",
        statusTone: "info",
        meta: "Dual-PC OBS 1440p60 · Twitch + YT multistream",
        pipelineId: "pipe-02"
      },
      {
        id: "wf-gf-music",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        scenario: "music",
        ownerUserId: "usr-sora",
        title: "\"Neon Static\" (Acoustic Live Studio Release)",
        schedule: "Release · Fri Nov 27",
        status: "Master Exported",
        statusTone: "ok",
        meta: "24-bit FLAC on R2 · DaVinci 4K MV grade complete",
        pipelineId: "pipe-03"
      },
      /* Tradester */
      {
        id: "wf-tr-stock",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-live",
        scenario: "stock",
        ownerUserId: "usr-tr-vikram",
        title: "Opening Bell S&P 500 Gamma Pin & Treasury Yields Desk",
        schedule: "Today · 09:15 EST",
        status: "Stream Live",
        statusTone: "ok",
        meta: "live.tradester.tv · 12k concurrent cap · /go/ibkr-pro",
        pipelineId: "pipe-tr-1"
      },
      {
        id: "wf-tr-pod",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-live",
        scenario: "podcast",
        ownerUserId: "usr-tr-chloe",
        title: "Tradester Tape & Options Live Podcast + X Spaces Simulcast",
        schedule: "Today · 16:30 EST",
        status: "Script Complete",
        statusTone: "warn",
        meta: "Script 2,140w · YT + X Live + LinkedIn + Castopod RSS",
        pipelineId: "pipe-tr-2"
      },
      {
        id: "wf-tr-art",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-research",
        scenario: "article",
        ownerUserId: "usr-tr-omar",
        title: "Q4 Liquidity Cycle Brief (54k Macro Subscribers)",
        schedule: "Thu · 07:00 EST",
        status: "Listmonk Staged",
        statusTone: "info",
        meta: "research.tradester.tv + IBKR <AffiliateCard/>",
        pipelineId: "pipe-tr-3"
      },
      {
        id: "wf-tr-soc",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-research",
        scenario: "social",
        ownerUserId: "usr-tr-nina",
        title: "0DTE Dealer Gamma Heatmap Carousel + YT Short",
        schedule: "Today · 14:00 EST",
        status: "Postiz Armed",
        statusTone: "ok",
        meta: "X, LinkedIn, IG Reels · go.tradester.tv/tv-pro",
        pipelineId: "pipe-tr-4"
      }
    ],

    pipelineItems: [
      {
        id: "pipe-gd1",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        ownerUserId: "usr-devon",
        title: "GodFlow Daily Shorts, Statuses & Visual Posts Pack",
        scenario: "social",
        stage: "distribute",
        dueDate: "2026-11-25",
        triliumNoteId: "tril-gd-101",
        emdashSlug: "gooddays-morning-walk-focus",
        toolLabel: "GodFlow Shorts + Postiz + Web Status",
        affiliateSlugs: ["gd-mic"],
        checklist: [
          { id: "cgd1", label: "Render 3x 9:16 vertical shorts with warm LUT", done: true },
          { id: "cgd2", label: "Publish text + image status to godflow.media wall", done: true },
          { id: "cgd3", label: "Auto-schedule X, IG Reels & YT Shorts queue", done: true }
        ],
        repurposing: [
          { id: "rgd1", channel: "godflow.media Website", format: "Status Card + Embedded Short", status: "Published" },
          { id: "rgd2", channel: "YouTube Shorts", format: "00:48 Morning Walk Short", status: "Published" },
          { id: "rgd3", channel: "Instagram + X", format: "Quote Post + Status Update", status: "In Progress" }
        ]
      },
      {
        id: "pipe-gd2",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        ownerUserId: "usr-nadia",
        title: "Calm Digital Gardens — Article to godflow.media Website + Social",
        scenario: "article",
        stage: "hub",
        dueDate: "2026-11-25",
        triliumNoteId: "tril-gd-104",
        emdashSlug: "calm-digital-gardens-gooddays",
        toolLabel: "Research Desk + EmDash (godflow.media) + Postiz",
        affiliateSlugs: ["gd-mic"],
        checklist: [
          { id: "cgd4", label: "Synthesize 2 research sources in GodFlow Brainstorm", done: true },
          { id: "cgd5", label: "Publish MDX essay to godflow.media/articles", done: true },
          { id: "cgd6", label: "Push 5-post social thread + OG image to X & LinkedIn", done: false }
        ],
        repurposing: [
          { id: "rgd4", channel: "godflow.media Website", format: "Full Article (1,920w)", status: "Published" },
          { id: "rgd5", channel: "Listmonk", format: "Sunday GodFlow Digest", status: "Pending" },
          { id: "rgd6", channel: "X + LinkedIn", format: "Article Carousel + Takeaways", status: "In Progress" }
        ]
      },
      {
        id: "pipe-ac1",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        ownerUserId: "usr-tariq",
        title: "GodFlow Live Stream: Cloud Infra & Live Equities Q&A",
        scenario: "stock",
        stage: "produce",
        dueDate: "2026-11-25",
        triliumNoteId: "tril-ac-201",
        emdashSlug: "askcorp-live-infra-macro",
        toolLabel: "GodFlow OBS-4K + godflow.media/live + Affiliates",
        affiliateSlugs: ["ask-broker", "ask-cloud"],
        checklist: [
          { id: "cac1", label: "Embed live player onto godflow.media/live", done: true },
          { id: "cac2", label: "Pin go.godflow.media/ask-broker & /ask-cloud in live banner", done: true },
          { id: "cac3", label: "Arm BTCPay & corporate Q&A superchat overlay", done: false }
        ],
        repurposing: [
          { id: "rac1", channel: "godflow.media Live", format: "Live Stream + VOD Archive", status: "In Progress" },
          { id: "rac2", channel: "GodFlow Affiliates", format: "Interactive Sponsored Gear Links", status: "Published" }
        ]
      },
      {
        id: "pipe-ac2",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        ownerUserId: "usr-liam",
        title: "GodFlow Operators Podcast Ep. 91 + Live Multi-Platform Simulcast",
        scenario: "podcast",
        stage: "hub",
        dueDate: "2026-11-27",
        triliumNoteId: "tril-ac-205",
        emdashSlug: "askcorp-operators-ep-91",
        toolLabel: "Podcast Script Writer + Multi-RTMP + Castopod",
        affiliateSlugs: ["ask-cloud", "ask-gpu"],
        checklist: [
          { id: "cac4", label: "Write run-of-show script & sponsor read cues", done: true },
          { id: "cac5", label: "Arm YouTube + X + Twitch live podcast simulcast", done: true },
          { id: "cac6", label: "Publish RSS feed + WhisperX clips to Castopod", done: false }
        ],
        repurposing: [
          { id: "rac3", channel: "YT + X + Twitch Live", format: "Live Video Podcast Simulcast", status: "In Progress" },
          { id: "rac4", channel: "Castopod RSS", format: "Audio Replay (52m)", status: "Published" }
        ]
      },
      {
        id: "pipe-02",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        ownerUserId: "usr-kira",
        title: "Dual-PC Challenge Night Live Stream & Highlights",
        scenario: "stock",
        stage: "capture",
        dueDate: "2026-11-25",
        triliumNoteId: "tril-8849",
        emdashSlug: "dual-pc-live-highlights",
        toolLabel: "Dual-PC OBS · 1440p60",
        affiliateSlugs: ["ask-gpu", "gd-mic"],
        checklist: [
          { id: "c5", label: "Configure attempt & poll overlay WebSocket", done: true },
          { id: "c6", label: "Test multi-track audio split (Mic vs Desktop/Squad)", done: false }
        ],
        repurposing: [
          { id: "r5", channel: "YouTube Live", format: "Full VOD + Chapters", status: "Pending" },
          { id: "r6", channel: "YouTube Shorts", format: "Live Highlight Clip", status: "Pending" }
        ]
      },
      {
        id: "pipe-03",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        ownerUserId: "usr-sora",
        title: "\"Neon Static\" — Acoustic Live Studio Release",
        scenario: "music",
        stage: "hub",
        dueDate: "2026-11-27",
        triliumNoteId: "tril-8790",
        emdashSlug: "neon-static-acoustic-live",
        toolLabel: "Logic Pro + DaVinci 4K",
        affiliateSlugs: ["gd-mic"],
        checklist: [
          { id: "c8", label: "24-bit/48kHz master bounce uploaded to R2", done: true },
          { id: "c9", label: "Lyrics + chord chart synced to GodFlow hub", done: true }
        ],
        repurposing: [
          { id: "r8", channel: "YouTube", format: "4K Studio Session Video", status: "In Progress" },
          { id: "r9", channel: "R2 / GodFlow", format: "Lossless FLAC + Stems", status: "Published" }
        ]
      },
      /* Tradester Tenant Pipeline Items */
      {
        id: "pipe-tr-1",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-live",
        ownerUserId: "usr-tr-vikram",
        title: "Opening Bell S&P 500 Gamma Pin Live Desk",
        scenario: "stock",
        stage: "produce",
        dueDate: "2026-11-25",
        triliumNoteId: "tril-tr-101",
        emdashSlug: "tradester-opening-bell-gamma",
        toolLabel: "Tradester OBS-4K",
        affiliateSlugs: ["ibkr-pro", "tv-pro"],
        checklist: [
          { id: "ctr1", label: "Sync CME orderbook ladder & options skew overlay", done: true },
          { id: "ctr2", label: "Pin go.tradester.tv/ibkr-pro across YT + X", done: true }
        ],
        repurposing: [
          { id: "rtr1", channel: "Tradester Live", format: "2h Market Open Stream", status: "In Progress" },
          { id: "rtr2", channel: "X / YouTube", format: "5-Clip Macro Recap", status: "Pending" }
        ]
      },
      {
        id: "pipe-tr-2",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-live",
        ownerUserId: "usr-tr-chloe",
        title: "Tradester Desk Podcast Ep. 41: Volatility & Carry Live Simulcast",
        scenario: "podcast",
        stage: "hub",
        dueDate: "2026-11-25",
        triliumNoteId: "tril-tr-109",
        emdashSlug: "tradester-volatility-pod-41",
        toolLabel: "Podcast Script + Multi-Platform Stream",
        affiliateSlugs: ["ibkr-pro"],
        checklist: [
          { id: "ctr3", label: "Finalize host script + CME sponsor cue", done: true },
          { id: "ctr4", label: "Broadcast live on YT + X + LinkedIn + live.tradester.tv", done: true }
        ],
        repurposing: [
          { id: "rtr3", channel: "YT + X + LinkedIn", format: "Live Simulcast + VOD", status: "In Progress" },
          { id: "rtr4", channel: "Castopod RSS", format: "Normalized Audio Ep", status: "Published" }
        ]
      },
      {
        id: "pipe-tr-3",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-research",
        ownerUserId: "usr-tr-omar",
        title: "Q4 Global Liquidity Cycle & Treasury Issuance Brief",
        scenario: "article",
        stage: "distribute",
        dueDate: "2026-11-26",
        triliumNoteId: "tril-tr-114",
        emdashSlug: "tradester-q4-liquidity-brief",
        toolLabel: "Research Desk + EmDash CMS + Listmonk",
        affiliateSlugs: ["ibkr-pro"],
        checklist: [
          { id: "ctr5", label: "Verify Treasury auction sources in Research Desk", done: true },
          { id: "ctr6", label: "Send 54k subscriber Listmonk briefing", done: false }
        ],
        repurposing: [
          { id: "rtr5", channel: "research.tradester.tv", format: "Longform Brief (3,120w)", status: "Published" }
        ]
      },
      {
        id: "pipe-tr-4",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-research",
        ownerUserId: "usr-tr-nina",
        title: "Dealer Gamma Heatmap Visual Thread (Postiz)",
        scenario: "social",
        stage: "produce",
        dueDate: "2026-11-26",
        triliumNoteId: "tril-tr-118",
        emdashSlug: "tradester-gamma-carousel",
        toolLabel: "Image Canvas + Postiz",
        affiliateSlugs: ["tv-pro"],
        checklist: [
          { id: "ctr7", label: "Export 1080x1350 gamma slide deck", done: true }
        ],
        repurposing: [
          { id: "rtr6", channel: "X + LinkedIn", format: "4-Slide Visual Deck", status: "In Progress" }
        ]
      }
    ],

    content: {
      folders: [
        { id: "fld-gf-articles", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "article", name: "GodFlow Essays & Guides", createdAt: "2026-11-20" },
        { id: "fld-gf-askcorp", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "article", name: "GodFlow Benchmarks & Infra", createdAt: "2026-11-21" },
        { id: "fld-gf-videos", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "video", name: "YouTube 4K Deep Dives (16:9)", createdAt: "2026-11-22" },
        { id: "fld-gf-shorts", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "video", name: "Vertical Shorts & Reels (9:16)", createdAt: "2026-11-23" },
        { id: "fld-gf-audio", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "podcast", name: "Podcasts & Music Sessions", createdAt: "2026-11-24" },
        { id: "fld-tr-research", workspaceId: "ws-tradester", channelId: "ch-tr-research", scenario: "article", name: "Macro & Vol Research Briefs", createdAt: "2026-11-20" },
        { id: "fld-tr-videos", workspaceId: "ws-tradester", channelId: "ch-tr-live", scenario: "video", name: "Opening Bell Videos & Shorts", createdAt: "2026-11-22" },
        { id: "fld-tr-podcasts", workspaceId: "ws-tradester", channelId: "ch-tr-live", scenario: "podcast", name: "Volatility Podcast & Live VODs", createdAt: "2026-11-24" }
      ],
      articles: [
        {
          id: "art-gd-1",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-articles",
          publishedAt: "2026-11-25",
          title: "Designing Calm Digital Gardens (Website + Social Edition)",
          slug: "calm-digital-gardens-gooddays",
          status: "Published",
          publishedTargets: ["godflow.media Website", "X Thread", "LinkedIn", "Listmonk"],
          words: 1920,
          updatedAt: "2026-11-25 00:40",
          triliumNoteId: "tril-gd-104",
          seoScore: 97,
          excerpt: "Published to godflow.media and syndicated as a 5-card social carousel: how short audio reflections, statuses, and weekly essays reinforce each other.",
          affiliateProps: {
            slug: "gd-mic",
            title: "GodFlow Warm Desk Mic Bundle",
            badge: "GodFlow Pick",
            summary: "Compact dynamic vocal mic + boom arm used for daily GodFlow shorts and morning podcasts.",
            cta: "Inspect Setup →",
            commission: "5.0% affiliate"
          },
          sponsorProps: {
            sponsor: "GodFlow Patron Club",
            headline: "Read Ad-Free Essays & Daily Status Archive on godflow.media",
            copy: "Get every GodFlow podcast transcript, printable habit card, and Sunday Dispatch in your inbox.",
            cta: "Visit godflow.media",
            slug: "gd-mic"
          }
        },
        {
          id: "art-ac-1",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-askcorp",
          publishedAt: "2026-11-24",
          title: "GodFlow 2026 Cloud & Broker Stack Showcase (godflow.media)",
          slug: "askcorp-stack-showcase-2026",
          status: "Published",
          publishedTargets: ["godflow.media Website", "GodFlow Affiliates"],
          words: 2150,
          updatedAt: "2026-11-24 22:10",
          triliumNoteId: "tril-ac-209",
          seoScore: 96,
          excerpt: "Hosted on godflow.media with live benchmark pricing and tracked /go/ask-cloud + /go/ask-broker partner attribution.",
          affiliateProps: {
            slug: "ask-cloud",
            title: "GodFlow Cloud Bare-Metal + GPUs",
            badge: "GodFlow Verified Partner",
            summary: "Dedicated NVMe clusters & AI inference nodes benchmarked weekly on GodFlow Live.",
            cta: "Deploy via GodFlow →",
            commission: "$150 CPA + 12% recurring"
          },
          sponsorProps: {
            sponsor: "Interactive Brokers Corporate",
            headline: "Treasury Cash Management & Live Equities Execution",
            copy: "Used daily during GodFlow Live Opening Bell broadcasts.",
            cta: "Claim GodFlow Partner Link",
            slug: "ask-broker"
          }
        },
        {
          id: "art-tr-1",
          workspaceId: "ws-tradester",
          channelId: "ch-tr-research",
          folderId: "fld-tr-research",
          publishedAt: "2026-11-25",
          title: "Q4 Global Liquidity Cycle & Treasury Issuance Map",
          slug: "q4-liquidity-cycle-map",
          status: "Publish-Ready",
          publishedTargets: ["research.tradester.tv", "Listmonk", "X Thread"],
          words: 3120,
          updatedAt: "2026-11-25 00:10",
          triliumNoteId: "tril-tr-114",
          seoScore: 98,
          excerpt: "Why QRA net bill issuance shifts drive short-duration equity dispersion ahead of December FOMC.",
          affiliateProps: {
            slug: "ibkr-pro",
            title: "Interactive Brokers Institutional Desk",
            badge: "Tradester Partner",
            summary: "Direct global futures, options, and multi-currency FX execution at spot.",
            cta: "Open Desk Account →",
            commission: "$200 CPA"
          },
          sponsorProps: {
            sponsor: "TradingView",
            headline: "Institutional Yield Curve & Options Layouts",
            copy: "Import Tradester's multi-monitor workspace layout directly into TradingView.",
            cta: "Import Layout",
            slug: "tv-pro"
          }
        }
      ],
      triliumReadyQueue: [
        {
          id: "art-sync-gd",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          title: "GodFlow Field Guide: Publishing Shorts, Statuses & Essays Together",
          slug: "gooddays-shorts-statuses-guide",
          status: "Publish-Ready",
          publishedTargets: ["godflow.media Website", "X", "Instagram", "YouTube Shorts"],
          words: 1780,
          updatedAt: "2026-11-25 00:50",
          triliumNoteId: "tril-gd-119",
          seoScore: 96,
          excerpt: "Synced from TriliumNext #publish-ready: turn one morning status update and 45s short clip into a canonical godflow.media article.",
          affiliateProps: {
            slug: "gd-mic",
            title: "GodFlow Creator Kit",
            badge: "GodFlow Pick",
            summary: "Minimal desk audio & camera chain.",
            cta: "Open Kit →",
            commission: "5.0% affiliate"
          },
          sponsorProps: {
            sponsor: "GodFlow Studio",
            headline: "Read Full Archive on godflow.media",
            copy: "Synced across Web, Podcast RSS, Shorts & Social.",
            cta: "Open godflow.media",
            slug: "gd-mic"
          }
        },
        {
          id: "art-sync-tr",
          workspaceId: "ws-tradester",
          channelId: "ch-tr-research",
          title: "Tradester Volatility Playbook: Zero-DTE Gamma Pins",
          slug: "tradester-zero-dte-gamma-pins",
          status: "Publish-Ready",
          publishedTargets: ["research.tradester.tv", "Listmonk"],
          words: 2110,
          updatedAt: "2026-11-25 00:32",
          triliumNoteId: "tril-tr-122",
          seoScore: 95,
          excerpt: "Synced from TriliumNext #publish-ready: institutional options hedging levels and dealer positioning models.",
          affiliateProps: {
            slug: "ibkr-pro",
            title: "IBKR Institutional Execution",
            badge: "Desk Verified",
            summary: "Direct futures & index options access.",
            cta: "Open Account →",
            commission: "$200 CPA"
          },
          sponsorProps: {
            sponsor: "CME Group",
            headline: "Micro E-Mini Futures Liquidity Desk",
            copy: "Used live during morning Tradester streams.",
            cta: "Explore CME",
            slug: "ibkr-pro"
          }
        }
      ],
      videos: [
        {
          id: "vid-gf-1",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-videos",
          title: "Astro + SQLite Creator Cloud Full Architecture Tour (16:9)",
          format: "16:9 Full Video",
          aspect: "16:9",
          durationSec: 1140,
          fps: 60,
          hookLine: "How one isolated SQLite + PG17 core powers 6 creator workflows without SaaS glue.",
          status: "Published",
          publishedAt: "2026-11-25",
          targets: ["YouTube 4K", "godflow.media"]
        },
        {
          id: "vid-gf-2",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-shorts",
          title: "Morning Walk 45s Reflection — Calm Stack Cut",
          format: "9:16 Short",
          aspect: "9:16",
          durationSec: 45,
          fps: 60,
          hookLine: "Stop losing morning ideas between apps — clip one note into 4 platforms.",
          status: "Short Queued",
          publishedAt: "2026-11-25",
          targets: ["YouTube Shorts", "Instagram Reels", "X"]
        },
        {
          id: "vid-gf-3",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-videos",
          title: "Creator Studio Desk Tour & Vocal Chain (Full Breakdown)",
          format: "16:9 Full Video",
          aspect: "16:9",
          durationSec: 840,
          fps: 60,
          hookLine: "Inside the GodFlow dual-channel hardware pipeline.",
          status: "Rendered",
          publishedAt: "2026-11-23",
          targets: ["YouTube 4K", "godflow.media"]
        },
        {
          id: "vid-gf-4",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-shorts",
          title: "1.1ms Postgres RLS Query Benchmark in 50 Seconds",
          format: "9:16 Short",
          aspect: "9:16",
          durationSec: 52,
          fps: 60,
          hookLine: "Why one composite index isolates every customer tenant safely.",
          status: "Scheduled",
          publishedAt: "2026-11-26",
          targets: ["YouTube Shorts", "LinkedIn"]
        },
        {
          id: "vid-tr-1",
          workspaceId: "ws-tradester",
          channelId: "ch-tr-live",
          folderId: "fld-tr-videos",
          title: "S&P 500 Zero-DTE Gamma Map Explained (Full Desk Breakdown)",
          format: "16:9 Full Video",
          aspect: "16:9",
          durationSec: 960,
          fps: 60,
          hookLine: "Where dealer gamma flips positive above 6,010 ahead of the close.",
          status: "Published",
          publishedAt: "2026-11-25",
          targets: ["YouTube 4K", "live.tradester.tv"]
        },
        {
          id: "vid-tr-2",
          workspaceId: "ws-tradester",
          channelId: "ch-tr-research",
          folderId: "fld-tr-videos",
          title: "Treasury QRA Impact in 55 Seconds (Vertical Short)",
          format: "9:16 Short",
          aspect: "9:16",
          durationSec: 55,
          fps: 60,
          hookLine: "The single net bill issuance number moving short-duration yields.",
          status: "Short Queued",
          publishedAt: "2026-11-24",
          targets: ["YouTube Shorts", "X"]
        }
      ],
      podcasts: [
        {
          id: "pod-ac-91",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-audio",
          episodeNumber: 91,
          title: "Operator Infrastructure Economics & Live Affiliate Attribution",
          publishedAt: "2026-11-24",
          duration: "52:08",
          durationSec: 3128,
          rssStatus: "RSS 2.0 + Live Simulcast VOD",
          rssUrl: "https://castopod.godflow.media/@operators/feed.xml",
          downloads: 16890,
          chapters: [
            { time: "00:00", label: "Live Stream Desk Recap & Cloud Margin Shifts" },
            { time: "19:30", label: "How go.godflow.media Attributes Live Q&A Conversions" },
            { time: "39:15", label: "Sponsor Benchmarks & Bare-Metal vs Hyperscaler" }
          ],
          transcript: [
            { ts: "00:03:40", speaker: "Tariq Al-Mansoor", line: "During today's GodFlow live stream, pinning go.godflow.media/ask-cloud drove 38% higher conversion than static show notes." },
            { ts: "00:21:12", speaker: "Liam O'Connor", line: "And because godflow.media owns both the podcast live stream and /go redirects, every listener touchpoint resolves cleanly in Postgres." }
          ]
        },
        {
          id: "pod-gd-48",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-audio",
          episodeNumber: 48,
          title: "Designing Zero-Hurry Mornings & Creative Rhythms w/ GodFlow",
          publishedAt: "2026-11-25",
          duration: "41:20",
          durationSec: 2480,
          rssStatus: "RSS 2.0 + godflow.media Valid",
          rssUrl: "https://castopod.godflow.media/@show/feed.xml",
          downloads: 11420,
          chapters: [
            { time: "00:00", label: "Why Morning Walk Statuses Stick" },
            { time: "14:10", label: "Turning Voice Notes into Website Articles" },
            { time: "28:40", label: "3 Short Clips Without Hustle Culture" }
          ],
          transcript: [
            { ts: "00:02:18", speaker: "Nadia Petrova", line: "Every GodFlow episode starts as a 45-second status voice note published straight to godflow.media and YouTube Shorts." },
            { ts: "00:14:45", speaker: "Liam O'Connor", line: "Once the podcast wraps live across YouTube and X, those same highlights become the visual carousel and weekly article." }
          ]
        },
        {
          id: "pod-tr-41",
          workspaceId: "ws-tradester",
          channelId: "ch-tr-live",
          folderId: "fld-tr-podcasts",
          episodeNumber: 41,
          title: "Volatility Regimes, Carry Trades & Live Tape Breakdown",
          publishedAt: "2026-11-24",
          duration: "46:15",
          durationSec: 2775,
          rssStatus: "RSS 2.0 + Tradester Live VOD",
          rssUrl: "https://castopod.tradester.tv/@markets/feed.xml",
          downloads: 19240,
          chapters: [
            { time: "00:00", label: "Yen Carry & Treasury Volatility Check" },
            { time: "22:00", label: "Live Viewer Q&A from YouTube + X Spaces" }
          ],
          transcript: [
            { ts: "00:05:18", speaker: "Chloe Kim", line: "Welcome everyone tuning in live across YouTube, X Video, and live.tradester.tv — grab our macro script sheet in the pinned card." },
            { ts: "00:24:10", speaker: "Vikram Rao", line: "Notice how 0DTE call walls pinned SPY within 0.3% despite the yield spike." }
          ]
        }
      ],
      musicReleases: [
        {
          id: "mus-01",
          workspaceId: "ws-godflow",
          channelId: "ch-godflow",
          folderId: "fld-gf-audio",
          title: "Neon Static (GodFlow Acoustic Live Session)",
          releaseDate: "2026-11-27",
          publishedAt: "2026-11-27",
          status: "Master Ready",
          key: "F# Minor",
          bpm: 94,
          duration: "03:48",
          isrc: "US-GF2-26-00419",
          audioUrl: "https://r2.godflow.media/masters/neon-static-24bit.flac",
          videoUrl: "https://youtu.be/gf-neon-static-4k",
          lyrics: "[Verse 1]\nBlue glow on the studio glass, quiet coffee before dawn\nTuned the hollow-body guitar soft while morning mist rolls on\n\n[Chorus]\nHold one true note in a noisy week\nLet the studio tape keep everything we seek"
        }
      ]
    },

    broadcasts: [
      {
        id: "bc-gd-12",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        subject: "GodFlow Sunday #12: Calm Digital Gardens + 3 Morning Shorts",
        segment: "GodFlow Readers (28,900)",
        status: "Scheduled",
        scheduledFor: "2026-11-26 09:00 EST",
        openRate: null,
        affiliateSlug: "gd-mic",
        body: "Read this week's essay on godflow.media, watch the Morning Walk short, and listen to GodFlow Podcast Ep. 48."
      },
      {
        id: "bc-ac-34",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        subject: "GodFlow Live Briefing #34: Cloud Bare-Metal + Podcast Ep. 91",
        segment: "GodFlow Operators (32,520)",
        status: "Scheduled",
        scheduledFor: "2026-11-26 08:15 EST",
        openRate: null,
        affiliateSlug: "ask-cloud",
        body: "Live stream replay + Operators Ep. 91 + tracked benchmarks at go.godflow.media/ask-cloud and godflow.media."
      },
      {
        id: "bc-tr-41",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-research",
        subject: "Tradester #41: Treasury QRA Liquidity Map & S&P Gamma Levels",
        segment: "Tradester Institutional Pro (54,210)",
        status: "Scheduled",
        scheduledFor: "2026-11-26 07:00 EST",
        openRate: null,
        affiliateSlug: "ibkr-pro",
        body: "Full desk positioning ahead of the 9:30 bell."
      }
    ],

    socialQueue: [
      {
        id: "soc-gd-1",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        platform: "YouTube Shorts",
        title: "GodFlow Morning Walk & Focus Short (00:48)",
        caption: "3 small habits before checking notifications. Full article & daily status wall at godflow.media",
        scheduledFor: "Today · 10:30 EST",
        trackingUrl: "https://godflow.media/statuses/morning-walk-focus?utm_source=yt_shorts&utm_campaign=gooddays",
        mediaLabel: "9:16 Vertical Short · 00:48",
        mediaBadge: "GodFlow Shorts",
        status: "Published"
      },
      {
        id: "soc-gd-2",
        workspaceId: "ws-godflow",
        channelId: "ch-godflow",
        platform: "X",
        title: "Article Drop: Designing Calm Digital Gardens",
        caption: "Just published to godflow.media: why combining short statuses, podcasts & weekly articles builds lasting reader trust.",
        scheduledFor: "Today · 13:15 EST",
        trackingUrl: "https://godflow.media/articles/calm-digital-gardens-gooddays?utm_source=x&utm_campaign=gooddays",
        mediaLabel: "16:9 Editorial Card + 5-Tweet Thread",
        mediaBadge: "godflow.media Website",
        status: "Queued"
      },
      {
        id: "soc-tr-1",
        workspaceId: "ws-tradester",
        channelId: "ch-tr-research",
        platform: "X",
        title: "0DTE Dealer Gamma Heatmap Snapshot",
        caption: "Live opening bell stream & Ep. 41 Podcast Simulcast today on live.tradester.tv.",
        scheduledFor: "Today · 09:00 EST",
        trackingUrl: "https://go.tradester.tv/ibkr-pro?utm_source=x&utm_medium=chart",
        mediaLabel: "16:9 Orderflow Graphic",
        mediaBadge: "Tradester Desk",
        status: "Queued"
      }
    ],

    shortLinks: [
      { id: "lnk-ac-1", workspaceId: "ws-godflow", channelId: "ch-godflow", slug: "ask-broker", category: "GodFlow Affiliates", destination: "https://www.interactivebrokers.com/mkt/?src=askcorp", clicks: 6420, convRate: 5.9, estRevenueUsd: 3840, active: true, spark: [410, 440, 480, 495, 530, 560, 610, 650, 690, 740] },
      { id: "lnk-ac-2", workspaceId: "ws-godflow", channelId: "ch-godflow", slug: "ask-cloud", category: "GodFlow Affiliates", destination: "https://hetzner.cloud/?ref=askcorp-operators", clicks: 5180, convRate: 6.4, estRevenueUsd: 2680, active: true, spark: [320, 350, 390, 420, 460, 490, 530, 560, 590, 640] },
      { id: "lnk-ac-3", workspaceId: "ws-godflow", channelId: "ch-godflow", slug: "ask-tv", category: "GodFlow Affiliates", destination: "https://www.tradingview.com/?aff=askcorp", clicks: 4390, convRate: 4.9, estRevenueUsd: 1620, active: true, spark: [280, 310, 330, 355, 390, 410, 445, 470, 510, 540] },
      { id: "lnk-gd-1", workspaceId: "ws-godflow", channelId: "ch-godflow", slug: "gd-mic", category: "GodFlow Gear", destination: "https://kit.co/gooddays/calm-studio-gear", clicks: 2140, convRate: 4.7, estRevenueUsd: 540, active: true, spark: [130, 145, 160, 175, 190, 210, 225, 240, 260, 285] },
      { id: "lnk-tr-1", workspaceId: "ws-tradester", channelId: "ch-tr-live", slug: "ibkr-pro", category: "Broker & Futures", destination: "https://www.interactivebrokers.com/?src=tradester", clicks: 8920, convRate: 6.2, estRevenueUsd: 5400, active: true, spark: [610, 650, 720, 700, 780, 820, 860, 910, 950, 1020] },
      { id: "lnk-tr-2", workspaceId: "ws-tradester", channelId: "ch-tr-live", slug: "tv-pro", category: "Charting Platforms", destination: "https://www.tradingview.com/?aff=tradester", clicks: 6140, convRate: 5.1, estRevenueUsd: 2100, active: true, spark: [420, 450, 490, 510, 540, 580, 620, 610, 660, 710] }
    ],

    sponsors: [
      { id: "sp-ac-1", workspaceId: "ws-godflow", channelId: "ch-godflow", company: "Hetzner Cloud Enterprise", contactName: "Lukas Weber", contactEmail: "enterprise@hetzner.com", stage: "Deliverables Live", contractStatus: "SOW Executed", value: 6400, currency: "USD", deliverables: "GodFlow Live Benchmarks + Operators Ep. 91 Affiliate Bundle", dueDate: "2026-12-01", affiliateSlug: "ask-cloud", notes: "go.godflow.media/ask-cloud driving 6.4% trial conversion." },
      { id: "sp-ac-2", workspaceId: "ws-godflow", channelId: "ch-godflow", company: "TradingView Institutional", contactName: "Elena Vance", contactEmail: "elena@tradingview.com", stage: "SOW Signed", contractStatus: "SOW Executed", value: 5200, currency: "USD", deliverables: "GodFlow Daily Live Stream Telemetry Integration", dueDate: "2026-12-08", affiliateSlug: "ask-tv", notes: "Pinned across godflow.media/live overlay." },
      { id: "sp-gd-1", workspaceId: "ws-godflow", channelId: "ch-godflow", company: "Readwise Reader", contactName: "Maya Chen", contactEmail: "creators@readwise.io", stage: "Paid", contractStatus: "Paid in Full", value: 2400, currency: "USD", deliverables: "GodFlow Ep. 48 Read + Calm Digital Gardens Article Box", dueDate: "2026-11-20", affiliateSlug: "gd-mic", notes: "Settled via Stripe; feature active on godflow.media." },
      { id: "sp-tr-1", workspaceId: "ws-tradester", channelId: "ch-tr-live", company: "CME Group", contactName: "David Stern", contactEmail: "david@cmegroup.com", stage: "SOW Signed", contractStatus: "SOW Executed", value: 9500, currency: "USD", deliverables: "8x Morning Macro Desk Reads + Podcast Ep. 41 Live Read", dueDate: "2026-12-12", affiliateSlug: "ibkr-pro", notes: "Futures educational series integration." }
    ],

    guests: [
      { id: "gst-gd-1", workspaceId: "ws-godflow", channelId: "ch-godflow", name: "Clara Ortiz", role: "Author, Digital Rest", slot: "GodFlow Ep. 48 (Published)", releaseSigned: true, status: "Published", prepNotes: "3 Shorts clips cut + feature card embedded on godflow.media." },
      { id: "gst-ac-1", workspaceId: "ws-godflow", channelId: "ch-godflow", name: "Maya Lin", role: "LocalFirst Labs", slot: "GodFlow Ep. 92 Live Simulcast", releaseSigned: true, status: "Scheduled", prepNotes: "Script finalized; YT + X + Twitch live podcast armed." },
      { id: "gst-tr-1", workspaceId: "ws-tradester", channelId: "ch-tr-live", name: "David Stern", role: "CME Institutional Strategist", slot: "Tradester Ep. 41 Live", releaseSigned: true, status: "Scheduled", prepNotes: "Macro options script + X Spaces simulcast verified." }
    ],

    invoices: [
      { id: "inv-ac-01", workspaceId: "ws-godflow", channelId: "ch-godflow", number: "INV-GF-2026-19", sponsorId: "sp-ac-1", sponsorName: "Hetzner Cloud Enterprise", sponsorAddress: "Gunzenhausen, Germany", currency: "USD", amount: 6400, usdEquivalent: 6400, rail: "Wire / ACH", status: "Paid", issuedDate: "2026-11-10", dueDate: "2026-11-24", items: [{ desc: "GodFlow Live Stream + Podcast Ep. 91 Integrations", qty: 4, rate: 1600 }] },
      { id: "inv-ac-02", workspaceId: "ws-godflow", channelId: "ch-godflow", number: "INV-GF-2026-20", sponsorId: "sp-ac-2", sponsorName: "TradingView Institutional", sponsorAddress: "Westerville, OH", currency: "USD", amount: 5200, usdEquivalent: 5200, rail: "Wire / ACH", status: "Awaiting Settlement", issuedDate: "2026-11-21", dueDate: "2026-12-08", items: [{ desc: "GodFlow Daily Live Desk Overlay Package", qty: 1, rate: 5200 }] },
      { id: "inv-gd-01", workspaceId: "ws-godflow", channelId: "ch-godflow", number: "INV-GF-2026-08", sponsorId: "sp-gd-1", sponsorName: "Readwise Inc.", sponsorAddress: "San Francisco, CA", currency: "USD", amount: 2400, usdEquivalent: 2400, rail: "Stripe", status: "Paid", issuedDate: "2026-11-06", dueDate: "2026-11-20", items: [{ desc: "GodFlow Ep. 48 + Article SponsorBox on godflow.media", qty: 1, rate: 2400 }] },
      { id: "inv-tr-01", workspaceId: "ws-tradester", channelId: "ch-tr-live", number: "INV-TR-2026-12", sponsorId: "sp-tr-1", sponsorName: "CME Group Inc.", sponsorAddress: "20 S Wacker Dr, Chicago, IL", currency: "USD", amount: 9500, usdEquivalent: 9500, rail: "Wire / ACH", status: "Paid", issuedDate: "2026-11-08", dueDate: "2026-11-22", items: [{ desc: "8x Tradester Morning Macro + Live Podcast Integrations", qty: 8, rate: 1187.5 }] }
    ],

    ledgerEntries: [
      { id: "led-ac-1", workspaceId: "ws-godflow", channelId: "ch-godflow", date: "2026-11-24", source: "Hetzner Enterprise INV-GF-2026-19", category: "Sponsor Invoice", rail: "Wire / ACH", currency: "USD", nativeAmount: 6400, usdAmount: 6400, status: "Settled" },
      { id: "led-ac-2", workspaceId: "ws-godflow", channelId: "ch-godflow", date: "2026-11-23", source: "GodFlow /go/* Broker & Cloud Affiliates", category: "Affiliate Payout", rail: "ACH", currency: "USD", nativeAmount: 9330, usdAmount: 9330, status: "Settled" },
      { id: "led-ac-3", workspaceId: "ws-godflow", channelId: "ch-godflow", date: "2026-11-21", source: "GodFlow Live Stream SuperChats + BTCPay", category: "Stream Donation (BTCPay)", rail: "BTCPay Server", currency: "BTC", nativeAmount: 0.014, usdAmount: 1310, status: "Settled" },
      { id: "led-gd-1", workspaceId: "ws-godflow", channelId: "ch-godflow", date: "2026-11-20", source: "Readwise GodFlow Sponsor INV-GF-2026-08", category: "Sponsor Invoice", rail: "Stripe", currency: "USD", nativeAmount: 2400, usdAmount: 2400, status: "Settled" },
      { id: "led-tr-1", workspaceId: "ws-tradester", channelId: "ch-tr-live", date: "2026-11-22", source: "CME Group INV-TR-2026-12", category: "Sponsor Invoice", rail: "Wire / ACH", currency: "USD", nativeAmount: 9500, usdAmount: 9500, status: "Settled" },
      { id: "led-tr-2", workspaceId: "ws-tradester", channelId: "ch-tr-live", date: "2026-11-21", source: "IBKR Institutional Affiliate", category: "Affiliate Payout", rail: "ACH", currency: "USD", nativeAmount: 7500, usdAmount: 7500, status: "Settled" }
    ],

    infraServices: [
      { id: "svc-pg", name: "PostgreSQL 17 Primary (RLS Multi-Tenant)", status: "Healthy", metric: "2.4 ms p95", detail: "2 active tenant schemas (GodFlow & Tradester) · Row-Level Security enforced" },
      { id: "svc-redis", name: "Redis 7.4 + BullMQ", status: "Healthy", metric: "0.8 ms ping", detail: "148k keys · 12 worker threads · 412 MB RSS" },
      { id: "svc-r2", name: "Cloudflare R2 / MinIO", status: "Healthy", metric: "2.62 TB pool", detail: "Tenant-isolated prefixes (/tenants/godflow/*, /tenants/tradester/*)" },
      { id: "svc-trilium", name: "TriliumNext ETAPI Sync", status: "Healthy", metric: "Synced 2m ago", detail: "1,284 notes indexed · 34 tagged #publish-ready" }
    ],

    bullQueues: [
      { id: "q-transcode", name: "media:transcode-hls", active: 1, waiting: 2, completed24h: 34, failed: 1, paused: false },
      { id: "q-trilium", name: "trilium:etapi-sync", active: 0, waiting: 0, completed24h: 288, failed: 1, paused: false },
      { id: "q-listmonk", name: "listmonk:dispatch", active: 0, waiting: 1, completed24h: 12, failed: 0, paused: false },
      { id: "q-postiz", name: "postiz:social-publish", active: 1, waiting: 3, completed24h: 29, failed: 1, paused: false },
      { id: "q-links", name: "affiliate:click-rollup", active: 0, waiting: 0, completed24h: 1440, failed: 0, paused: false },
      { id: "q-btcpay", name: "webhook:btcpay-settle", active: 0, waiting: 0, completed24h: 47, failed: 0, paused: false }
    ],

    failedJobs: [
      { id: "job_9951", workspaceId: "ws-godflow", channelId: "ch-godflow", queue: "postiz:social-publish", payload: "GodFlow Morning Walk Status -> IG Reels mirror", error: "IG Reels webhook rate-limit window (retry backoff 60s)", attempts: "1 / 3", failedAt: "2026-11-25 00:44" },
      { id: "job_9938", workspaceId: "ws-godflow", channelId: "ch-godflow", queue: "media:transcode-hls", payload: "whisperx-diarize askcorp-ep92-simulcast.wav", error: "CUDA/Metal worker memory cap reached (8192MB) at segment 00:49:10", attempts: "1 / 3", failedAt: "2026-11-24 23:42" },
      { id: "job_9932", workspaceId: "ws-tradester", channelId: "ch-tr-research", queue: "trilium:etapi-sync", payload: "noteId: tril-tr-114 (options-heatmap.png)", error: "ETAPI ETag checksum mismatch during concurrent note save", attempts: "1 / 3", failedAt: "2026-11-24 22:19" }
    ],

    automationEvents: [
      { id: "evt-gd1", workspaceId: "ws-godflow", channelId: "ch-godflow", source: "EmDash Web + Postiz", job: "Published GodFlow Status & Short to godflow.media + YT Shorts", status: "Live", time: "4m ago", tone: "ok" },
      { id: "evt-ac1", workspaceId: "ws-godflow", channelId: "ch-godflow", source: "OBS + Multi-RTMP Podcast", job: "Armed YouTube + X + Twitch Simulcast & go.godflow.media/ask-cloud", status: "Armed", time: "11m ago", tone: "info" },
      { id: "evt-gd2", workspaceId: "ws-godflow", channelId: "ch-godflow", source: "TriliumNext ETAPI", job: "Synced GodFlow essay #tril-gd-104 to godflow.media", status: "Completed", time: "32m ago", tone: "ok" },
      { id: "evt-tr1", workspaceId: "ws-tradester", channelId: "ch-tr-live", source: "Tradester OBS + RTMP", job: "Streaming Opening Bell Market Desk across YouTube + X + live.tradester.tv", status: "Live", time: "8m ago", tone: "ok" },
      { id: "evt-tr2", workspaceId: "ws-tradester", channelId: "ch-tr-research", source: "TriliumNext ETAPI", job: "Queued #publish-ready Q4 Liquidity Brief to research.tradester.tv", status: "Synced", time: "26m ago", tone: "ok" }
    ],

    auditLog: [
      { id: "aud-1", time: "01:02:14", actor: "Alex Mercer", role: "god_mode", workspace: "ws-godflow", action: "Reviewed GodFlow multi-channel teams (Article, Podcast, Live, Social)", tone: "info" },
      { id: "aud-2", time: "00:54:09", actor: "Vikram Rao", role: "trader_host", workspace: "ws-tradester", action: "Armed Tradester OBS-4K pre-market checklist", tone: "ok" },
      { id: "aud-3", time: "00:41:52", actor: "Liam O'Connor", role: "podcast_producer", workspace: "ws-godflow", action: "Prepared Ep. 92 script + armed YouTube/X/Twitch podcast live simulcast", tone: "ok" },
      { id: "aud-4", time: "00:29:18", actor: "Priya Nair", role: "finance_ops", workspace: "ws-tradester", action: "Verified CME Group invoice INV-TR-2026-12 ($9,500)", tone: "info" }
    ],

    watcherConfig: {
      enabled: true,
      speedMultiplier: 1,
      referenceToday: "2026-11-25"
    },

    activeWatchers: [
      /* GodFlow */
      { userId: "usr-alex", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "stock", tool: "GodFlow Multi-Channel Ops", taskTitle: "Overseeing GodFlow teams", running: true, todaySeconds: 16200, weekTargetHours: 42 },
      { userId: "usr-nadia", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "article", tool: "Research Desk + EmDash CMS", taskTitle: "Calm Digital Gardens article + Listmonk draft", running: true, todaySeconds: 14100, weekTargetHours: 38 },
      { userId: "usr-liam", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "podcast", tool: "Podcast Script + Multi-RTMP Simulcast", taskTitle: "Scripting Ep. 92 & arming YT/X/Twitch live stream", running: true, todaySeconds: 15480, weekTargetHours: 40 },
      { userId: "usr-tariq", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "stock", tool: "GodFlow OBS-4K + godflow.media/live", taskTitle: "Live Infra & Macro Desk Broadcast + Affiliates", running: true, todaySeconds: 18600, weekTargetHours: 40 },
      { userId: "usr-kira", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "stock", tool: "Dual-PC OBS + Replay Buffer", taskTitle: "Dual-PC live stream scenes & replay markers", running: true, todaySeconds: 10920, weekTargetHours: 36 },
      { userId: "usr-devon", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "social", tool: "Image Canvas + Postiz", taskTitle: "Publishing Morning Walk Shorts & habit statuses", running: true, todaySeconds: 11850, weekTargetHours: 36 },
      { userId: "usr-sora", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "music", tool: "Logic Pro + DaVinci Resolve", taskTitle: "Neon Static 24-bit FLAC vocal mastering", running: true, todaySeconds: 14680, weekTargetHours: 35 },
      { userId: "usr-maya", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "podcast", tool: "GodFlow Workspace Admin", taskTitle: "Team role & sponsor deliverables coordination", running: true, todaySeconds: 12960, weekTargetHours: 40 },
      { userId: "usr-hannah", workspaceId: "ws-godflow", channelId: "ch-godflow", scenario: "article", tool: "Multi-Channel P&L & Affiliate Payouts", taskTitle: "GodFlow affiliate & invoice close", running: false, todaySeconds: 8400, weekTargetHours: 32 },
      /* Tradester */
      { userId: "usr-tr-vikram", workspaceId: "ws-tradester", channelId: "ch-tr-live", scenario: "stock", tool: "Tradester OBS-4K + TradingView", taskTitle: "Opening Bell S&P 500 Gamma Pin Live Stream", running: true, todaySeconds: 19340, weekTargetHours: 40 },
      { userId: "usr-tr-chloe", workspaceId: "ws-tradester", channelId: "ch-tr-live", scenario: "podcast", tool: "Podcast Script + X/YT Live Cast", taskTitle: "Scripting Ep. 41 Volatility Show & Simulcast prep", running: true, todaySeconds: 13200, weekTargetHours: 38 },
      { userId: "usr-tr-omar", workspaceId: "ws-tradester", channelId: "ch-tr-research", scenario: "article", tool: "Research Desk + EmDash CMS", taskTitle: "Q4 Liquidity & Yen Carry institutional brief", running: true, todaySeconds: 14800, weekTargetHours: 40 },
      { userId: "usr-tr-nina", workspaceId: "ws-tradester", channelId: "ch-tr-research", scenario: "social", tool: "Image Canvas + Postiz", taskTitle: "0DTE Gamma Heatmap visual deck export", running: false, todaySeconds: 9200, weekTargetHours: 35 }
    ],

    workEvents: [
      /* GodFlow */
      { id: "we-gd-1", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-devon", scenario: "social", title: "GodFlow Shorts + Morning Status Drop (Web + Social)", date: "2026-11-25", startHour: 9, durationHours: 2.5, trackedSeconds: 9000, status: "Live Tracking", tool: "GodFlow Shorts + Postiz", pipelineId: "pipe-gd1" },
      { id: "we-gd-2", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-nadia", scenario: "article", title: "GodFlow Article: Calm Digital Gardens → Web + X", date: "2026-11-25", startHour: 12, durationHours: 3.0, trackedSeconds: 10800, status: "Live Tracking", tool: "Research Desk + EmDash", pipelineId: "pipe-gd2" },
      { id: "we-ac-1", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-tariq", scenario: "stock", title: "GodFlow Live Stream: Enterprise Macro & Affiliates", date: "2026-11-25", startHour: 9, durationHours: 3.0, trackedSeconds: 10800, status: "Live Tracking", tool: "GodFlow OBS-4K", pipelineId: "pipe-ac1" },
      { id: "we-ac-2", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-liam", scenario: "podcast", title: "Podcast Script + Live Simulcast Prep (Ep. 92)", date: "2026-11-25", startHour: 15, durationHours: 2.5, trackedSeconds: 9000, status: "Live Tracking", tool: "Podcast Script + Multi-RTMP", pipelineId: "pipe-ac2" },
      { id: "we-gf-mus", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-sora", scenario: "music", title: "\"Neon Static\" Vocal Stem & FLAC Bounce", date: "2026-11-25", startHour: 16, durationHours: 3.0, trackedSeconds: 10800, status: "Live Tracking", tool: "Logic Pro + R2", pipelineId: "pipe-03" },
      { id: "we-gf-gam", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-kira", scenario: "stock", title: "Dual-PC Challenge Night Live Stream", date: "2026-11-25", startHour: 20, durationHours: 3.0, trackedSeconds: 10800, status: "Live Tracking", tool: "Dual-PC OBS", pipelineId: "pipe-02" },
      { id: "we-gd-3", workspaceId: "ws-godflow", channelId: "ch-godflow", userId: "usr-liam", scenario: "podcast", title: "GodFlow Podcast Ep. 48 + 3 Shorts Cuts", date: "2026-11-24", startHour: 14, durationHours: 3.5, trackedSeconds: 12600, status: "Completed", tool: "Castopod godflow.media", pipelineId: "pipe-ac2" },
      /* Tradester */
      { id: "we-tr-1", workspaceId: "ws-tradester", channelId: "ch-tr-live", userId: "usr-tr-vikram", scenario: "stock", title: "Opening Bell S&P 500 Gamma Desk", date: "2026-11-25", startHour: 9, durationHours: 3.0, trackedSeconds: 10800, status: "Live Tracking", tool: "Tradester OBS-4K", pipelineId: "pipe-tr-1" },
      { id: "we-tr-2", workspaceId: "ws-tradester", channelId: "ch-tr-research", userId: "usr-tr-omar", scenario: "article", title: "Q4 Liquidity & Yen Carry Institutional Brief", date: "2026-11-25", startHour: 12, durationHours: 3.5, trackedSeconds: 12600, status: "Live Tracking", tool: "EmDash Research", pipelineId: "pipe-tr-3" },
      { id: "we-tr-3", workspaceId: "ws-tradester", channelId: "ch-tr-live", userId: "usr-tr-chloe", scenario: "podcast", title: "Ep. 41 Volatility Script & Live X/YT Simulcast", date: "2026-11-25", startHour: 16, durationHours: 2.5, trackedSeconds: 9000, status: "Live Tracking", tool: "Podcast Script + RTMP", pipelineId: "pipe-tr-2" }
    ],

    workbenchData: {
      researchSources: [
        {
          id: "src-1",
          title: "PostgreSQL 17 Row-Level Security Benchmarks for Multi-Tenant SaaS",
          domain: "cybertec-postgresql.com",
          url: "https://www.cybertec-postgresql.com/en/rls-performance-2026",
          published: "2026-11-18",
          summary: "Indexed tenant_id B-tree policies paired with prepared statements keep multi-tenant p95 query overhead under 1.1ms at 10M rows.",
          body: "Row-Level Security (RLS) isolates tenant rows directly at the storage query planner boundary. When paired with SET LOCAL app.current_tenant_id inside a Hono request transaction, application queries never leak sibling tenant rows even when a route forgets an explicit WHERE clause. Always create composite indexes starting with (tenant_id, created_at DESC) to avoid sequential scans."
        },
        {
          id: "src-2",
          title: "Listmonk + Self-Hosted SMTP vs Substack Deliverability Report",
          domain: "deliverability.engineering",
          url: "https://deliverability.engineering/listmonk-dkim-2026",
          published: "2026-11-21",
          summary: "Dual-domain DKIM signing and automated bounce suppression pushed 38k-subscriber inbox placement to 98.4% while cutting SaaS fees by $440/mo.",
          body: "Independent newsletters migrating off hosted platforms retain 100% subscriber portability in PostgreSQL. By routing transactional receipts through Postmark and bulk weekly issues through a warmed Amazon SES dedicated IP pool via Listmonk, solo creators maintain sub-0.08% complaint rates and embed dynamic sponsor cards at build time."
        },
        {
          id: "src-3",
          title: "Semiconductor CapEx & NVDA Supply Chain Margin Trends Q4 2026",
          domain: "tradester.tv/research",
          url: "https://research.tradester.tv/nvda-capex-q4",
          published: "2026-11-24",
          summary: "Hyperscaler rack-scale liquid cooling orders point to a 14% sequential expansion in datacenter power delivery bottlenecks.",
          body: "Channel checks across Taiwanese ODM assemblers indicate lead times on custom power shelves extended from 14 to 22 weeks. Watch gross margin guidance vs consensus 73.5% during the opening bell reaction stream."
        },
        {
          id: "src-4",
          title: "TriliumNext ETAPI Webhooks & Local-First Markdown Pipelines",
          domain: "docs.triliumnext.org",
          url: "https://docs.triliumnext.org/etapi/notes",
          published: "2026-11-12",
          summary: "Tagging a note #publish-ready triggers an incremental ETAPI fetch that compiles Astro MDX with zero manual copy-paste.",
          body: "Using ETAPI attribute queries (#publish-ready AND !#archived), a BullMQ worker pulls only modified branches, resolves internal image attachments to Cloudflare R2 keys, and emits typed frontmatter for EmDash CMS."
        }
      ],
      brainstormNotes: [
        { id: "br-1", tag: "Thesis", sourceTitle: "PostgreSQL 17 RLS Benchmarks", text: "Lead with concrete numbers: 1.1ms p95 overhead with tenant_id RLS + composite indexes beats maintaining separate DBs per creator brand." },
        { id: "br-2", tag: "Data Point", sourceTitle: "Listmonk Deliverability Report", text: "98.4% inbox placement across 38,640 subscribers while saving $440/mo compared to hosted newsletter SaaS." },
        { id: "br-3", tag: "Hook", sourceTitle: "TriliumNext ETAPI Docs", text: "Tag one note #publish-ready in Trilium and watch BullMQ compile EmDash MDX, R2 images, and Listmonk draft in 800ms." }
      ],
      articleDraft: {
        title: "Replacing Notion & Substack with TriliumNext, Astro & Listmonk",
        slug: "trilium-astro-listmonk-stack",
        html: "<h2>Why Own Your Creator Pipeline?</h2><p>Every creator eventually hits the SaaS tax: notes trapped in one workspace, subscribers locked in another, and affiliate analytics scattered across five dashboards.</p><blockquote><p>Tagging a single TriliumNext note <code>#publish-ready</code> triggers an incremental ETAPI sync straight into EmDash CMS and Listmonk.</p></blockquote><h3>Measured Results</h3><ul><li><strong>98.4% inbox placement</strong> across subscribers via warmed SES + Listmonk.</li><li><strong>1.1ms p95 Postgres RLS</strong> isolation across GodFlow and Tradester workspaces.</li></ul>"
      },
      podcastScript: {
        episodeTitle: "GodFlow Ep. 92 & GodFlow Crossover — Sovereign Live Creator Tech",
        episodeNumber: 92,
        channelId: "ch-godflow",
        guestName: "Maya Lin (LocalFirst Labs)",
        targetDurationMin: 45,
        html: "<h2>[00:00] Cold Open &amp; Multi-Platform Check</h2><p>Welcome everyone watching live on YouTube, X Video, Twitch, and our channel website! Drop where you are tuning in from in live chat.</p><blockquote><p><strong>HOST CUE:</strong> Ask Maya how unifying Articles, Live Streaming &amp; Podcasts under one workspace transformed team velocity.</p></blockquote><h2>[12:00] Live Demo — Multi-Platform Simulcast &amp; WhisperX Clipping</h2><ul><li>Walk through live chapter markers during broadcast</li><li>Show 9:16 vertical short cut straight to Postiz Queue</li></ul><h2>[24:00] Sponsor Read Cue</h2><p><code>&lt;SponsorRead sponsor=\"Hetzner Cloud\" slug=\"ask-cloud\" /&gt;</code> — Mention bare-metal NVMe performance and read pinned chat link <code>go.godflow.media/ask-cloud</code>.</p><h2>[35:00] Live Audience Q&amp;A &amp; Sign-Off</h2><p>Pull questions from YouTube Live + X Spaces and wrap with subscribe CTA.</p>",
        segments: [
          { id: "pseg-1", ts: "00:00", title: "Cold Open & Simulcast Greeting", cue: "Greet YouTube Live, X Video, Twitch & Website viewers" },
          { id: "pseg-2", ts: "12:00", title: "Live Architecture Walkthrough", cue: "Screen share live pipeline & script-to-clip workflow" },
          { id: "pseg-3", ts: "24:00", title: "Mid-Roll Sponsor Read", cue: "Read Hetzner script & pin /go/ask-cloud across chat" },
          { id: "pseg-4", ts: "35:00", title: "Live Chat Q&A + Wrap", cue: "Highlight viewer questions & drop chapter markers" }
        ]
      },
      podcastLiveConfig: {
        isLive: false,
        activeScene: "2-Shot Host + Guest (4K)",
        micGain: 84,
        guestGain: 78,
        soundboardLevel: 62,
        destinations: [
          { id: "plive-yt", platform: "YouTube Live", endpoint: "rtmp://a.rtmp.youtube.com/live2", enabled: true, viewers: 840, status: "Ready 1080p60" },
          { id: "plive-x", platform: "X / Twitter Video", endpoint: "rtmp://prod.pscp.tv/x", enabled: true, viewers: 615, status: "Ready 1080p" },
          { id: "plive-tw", platform: "Twitch Studio", endpoint: "rtmp://live.twitch.tv/app", enabled: true, viewers: 320, status: "Ready" },
          { id: "plive-li", platform: "LinkedIn Live", endpoint: "rtmp://1-edge.linkedin.com/live", enabled: false, viewers: 0, status: "Standby" },
          { id: "plive-web", platform: "Owned Website Player", endpoint: "wss://stream.godflow.media/hls", enabled: true, viewers: 290, status: "HLS Armed" }
        ]
      },
      stockAssets: [
        { id: "img-1", title: "Minimalist Studio Trading Desk 4K", category: "Desk & Gear", ratio: "16:9", palette: ["#0f172a", "#1e293b", "#38bdf8"], badge: "4K DESK" },
        { id: "img-2", title: "Pre-Market Semiconductor Breadth Heatmap", category: "Market Charts", ratio: "16:9", palette: ["#062c21", "#0f3d2e", "#4ade80"], badge: "MARKET DATA" },
        { id: "img-3", title: "Ribbon Mic & Candlelit Vocal Booth", category: "Music & Audio", ratio: "4:5", palette: ["#2a0f18", "#4c1d2e", "#fb7185"], badge: "ACOUSTIC" },
        { id: "img-4", title: "Podcast Dual-Cam Studio Frame", category: "Podcast", ratio: "1:1", palette: ["#2b1d07", "#4a320a", "#fbbf24"], badge: "EP. 92 LIVE" },
        { id: "img-5", title: "Astro + Hono + PG17 Architecture Diagram", category: "Code & Infra", ratio: "4:5", palette: ["#151438", "#25245e", "#818cf8"], badge: "BLUEPRINT" },
        { id: "img-6", title: "16:9 Studio Thumbnail & Shorts Frame", category: "Video & Shorts", ratio: "16:9", palette: ["#220d36", "#3d1861", "#c084fc"], badge: "VIDEO 4K" }
      ],
      imageCanvas: {
        assetId: "img-1",
        ratio: "1080x1350",
        headline: "MY 2026 CREATOR STACK",
        subhead: "Astro + Hono + PostgreSQL 17 + TriliumNext",
        badgeText: "NEW GUIDE",
        ctrBadge: "MUST WATCH",
        watermark: "@godflow · godflow.media",
        brightness: 100,
        contrast: 108,
        fontSize: 44
      },
      gifMaker: {
        delayMs: 260,
        loopLabel: "Infinite Loop · 3 Frames",
        frames: [
          { headline: "STEP 1: GATHER SOURCES", sub: "Save live research URLs & citations" },
          { headline: "STEP 2: WRITE & RECORD", sub: "Article, Podcast, Live & 9:16 Shorts" },
          { headline: "STEP 3: ORGANIZE & SHIP", sub: "Folders, Tree & Weekly Calendar Sync" }
        ]
      },
      whiteboard: [
        { id: "wb-1", workspaceId: "ws-godflow", authorId: "usr-maya", authorName: "Maya Lin", authorRole: "ADMIN", text: "Confirm Friday 16:9 + 9:16 Video & Podcast Simulcast schedule on GodFlow channel.", color: "ok", kind: "Action Item", scenario: "all", done: false, createdAt: "09:15:00" },
        { id: "wb-2", workspaceId: "ws-godflow", authorId: "usr-nadia", authorName: "Nadia Petrova", authorRole: "ARTICLE", text: "Pinned PostgreSQL 17 RLS benchmark stats for Article, Video & Podcast teams.", color: "info", kind: "Sticky Note", scenario: "article", done: false, createdAt: "09:42:00" },
        { id: "wb-3", workspaceId: "ws-godflow", authorId: "usr-hannah", authorName: "Hannah Cho", authorRole: "FINANCE / CRM", text: "Verify /go affiliate links and sponsor disclosure tags before publishing.", color: "warn", kind: "Review Feedback", scenario: "all", done: false, createdAt: "10:05:00" }
      ],
      videoStudio: {
        mode: "long",
        title: "Multi-Tenant Creator Operating System (2026 Architecture)",
        channelId: "ch-godflow",
        hookLine: "Every article, video, short, podcast & live stream running on one isolated tenant DB.",
        script: "<h2>[00:00] Hook & Benchmark Promise</h2><p>In the next 14 minutes we break down how one SQLite + PG17 workspace isolates articles, 16:9 videos, 9:16 shorts, and podcasts.</p><h2>[03:30] Source Gathering → Script → SRT Auto-Captions</h2><ul><li>Clip verified research citations directly onto the video timeline</li><li>Toggle 16:9 Full Video or 9:16 Vertical Short export</li></ul><h2>[10:45] Folder, Tree & Calendar Organizer</h2><p>Publish straight to your Content Hub &amp; Postiz social queue.</p>",
        srtCaptions: "1\n00:00:00,000 --> 00:00:04,500\nEvery workflow from Article to 9:16 Shorts now lives inside one tenant suite.\n\n2\n00:00:04,500 --> 00:00:09,200\nLet us gather sources, generate captions, and publish directly to the hub.",
        aspect: "16:9",
        fps: 60,
        durationSec: 840
      }
    }
  };
}
