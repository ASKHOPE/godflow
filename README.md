# GodFlow — Multi-Tenant Creator-Media Operating System (Astro)

Interactive **Astro** frontend preview of **GodFlow**, featuring **independent dual rails** (left navigation rail + right session/6-scenario/audit context sidebar), **multi-tenant workspaces**, **login/session switching**, **user impersonation**, **10 RBAC roles mapped to 6 production scenarios**, and a **God Mode & Admin console**.

## Run Locally

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321).

To build or preview the compiled static site:

```sh
npm run build
npm run preview
```

## Astro Pages & Architecture

1. **`/` (`src/pages/index.astro`) — Command Center**: Tenant-scoped KPIs, Quick Capture → TriliumNext bar, active workflows, and Automation Queue.
2. **`/studio` (`src/pages/studio.astro`) — Scenario Workbenches**: RBAC-isolated creative studios for all 6 scenarios — Article Studio (Research Desk + Brainstorm + Rich Text/HTML Editor), Image/Social Studio (Asset Search + Canvas Editor), Stock Trading Desk, Gaming Stream + Replay Clipper, Music Stem Mixer + Lyrics, and Podcast Chapter + Clip Extractor.
3. **`/calendar` (`src/pages/calendar.astro`) — Mega Calendar & Auto Work-Watcher**: Monthly, Weekly, Daily, Custom Date Range, and Teammate Watcher views with live automatic working-hours tracking (`1x`–`3600x` emulation speed).
3. **`/pipeline` (`src/pages/pipeline.astro`) — Production Pipeline**: 4-stage Kanban (`Capture → Produce → Hub → Distribute`) across the 6 production scenarios with RBAC-aware slide-over drawer.
3. **`/hub` (`src/pages/hub.astro`) — Content & Media Hub**: EmDash MDX articles with `<SponsorBox/>` & `<AffiliateCard/>` live blocks, Castopod Podcast RSS + WhisperX transcript, Music releases + lyrics, and TriliumNext `#publish-ready` sync.
4. **`/distribution` (`src/pages/distribution.astro`) — Distribution**: Split view for Listmonk email broadcasts and Postiz social scheduling.
5. **`/affiliates` (`src/pages/affiliates.astro`) — Affiliates & Link Engine**: `/go/:slug` manager with inline edits, click sparklines, and UTM builder.
6. **`/sponsors` (`src/pages/sponsors.astro`) — Sponsors & Collabs**: 5-stage CRM, guest release tracker, and Live Media Kit modal.
7. **`/finance` (`src/pages/finance.astro`) — Finance & Ledger**: Multi-currency B2B sponsor invoicing (`USD`, `EUR`, `GBP`, `BTC`) with PDF preview modal, plus unified income ledger.
8. **`/team` (`src/pages/team.astro`) — Team & 6-Scenario Roles**: Team roster, 6-scenario role ownership, inline role assignment, user impersonation, and interactive RBAC capability matrix.
9. **`/admin` (`src/pages/admin.astro`) — God Mode & Multi-Tenancy**: Cross-tenant metrics, PostgreSQL RLS `tenant_id` inspector, tenant provisioning, feature flag switches, and security audit log.
10. **`/system` (`src/pages/system.astro`) — System & Infrastructure Health**: PostgreSQL, Redis/BullMQ, R2/MinIO, TriliumNext ETAPI monitors, queue pause/resume, and Failed Jobs retry table.
