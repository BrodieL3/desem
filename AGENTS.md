# Field Brief Agent Guide

This document is for coding agents working in this repository. It is intentionally more implementation-specific than `/Users/brodielee/desem/README.md`.

## Project goals

- Deliver a defense-focused news product that is fast to scan, deep to verify, and explicit about source attribution.
- Keep two layers of value:
  - Raw ingest and enrichment in Supabase.
  - Curated story presentation (cluster + digest) in Sanity.
- Prioritize coverage in the project focus buckets:
  - International defense/security events.
  - U.S. defense company activity.
- Maintain reader utility features:
  - Topic extraction and topic follows.
  - Signed-in comments with abuse reporting and moderator hide/restore.

## Design guidance

- Detailed design system guidance lives in `/Users/brodielee/desem/docs/design-best-practices.md`.
- Use that document for Next.js + Tailwind v4 + shadcn/ui implementation patterns, accessibility details, and UI copy conventions.
- Keep `AGENTS.md` as the concise project-specific operating policy; avoid duplicating the full design guide here.

Design non-negotiables for this project:
- Use semantic theme tokens in `/Users/brodielee/desem/app/globals.css` (avoid hardcoded colors in components).
- Keep interactive touch targets at or above 44x44px.
- Preserve keyboard accessibility, visible focus states, and reduced-motion support.
- Keep loading, empty, and error states explicit for all user-facing surfaces.
- Prefer shadcn/ui primitives and existing component patterns before creating new custom primitives.

## Goal translation for agents

Use these rules when making tradeoffs:

- Fast to scan:
  - Favor concise headlines/deks and ranked streams over long unstructured blocks.
  - Preserve current stream guardrails (source caps, opinion limits, focus filtering).
- Deep to verify:
  - Preserve evidence trails and citation links in story surfaces.
  - Prefer changes that improve traceability to original reporting.
- Explicit source attribution:
  - Never drop source metadata when mapping ingest -> digest -> UI.
  - Keep role-aware source handling (`reporting`, `analysis`, `official`, `opinion`).
- Two-layer architecture:
  - Supabase remains operational/raw source-of-record for ingest and relationships.
  - Sanity remains curated editorial output for digests and editorial docs.
- Coverage focus buckets:
  - Keep focus logic centered on international defense/security + U.S. defense companies.
  - Treat non-focus stories as lower-priority fallback content, not primary stream content.
- Reader utility:
  - Keep topic extraction/follow flows and comment/report/moderation flows functional.

## Current product state (goal-aligned)

- Home (`/`) is editorial-first and assembled by `/Users/brodielee/desem/lib/editorial/ui-server.ts`.
- Home currently prefers live Semafor Security stream coverage, then falls back to Sanity digests/raw fallback synthesis.
- Story pages (`/stories/[clusterKey]`) are verification-focused: digest narrative plus paged evidence blocks.
- Source-detail pages (`/stories/article/[id]`) preserve full-text reading + topic actions + discussion.
- Topic pages (`/topics/[slug]`) support exploration and follow personalization.
- `/briefings` and `/data` are intentionally reserved for future curated modules.
- Pipeline output targets Sanity drafts (`newsItem`, `storyDigest`) while retaining Supabase operational data.

## Sanity Studio CMS structure (non-negotiable)

- Sanity Studio navigation is intentionally custom and must be maintained via:
  - `/Users/brodielee/desem/sanity.config.ts`
  - `/Users/brodielee/desem/sanity/lib/structure.ts`
  - `/Users/brodielee/desem/sanity/lib/document-views.tsx`
- Root Studio panes must remain:
  - `Digest Workflow`
  - `Evidence Library`
  - `Operations`
- `Digest Workflow` must keep queues tied to editorial pipeline states:
  - `reviewStatus`: `needs_review`, `approved`, `published`
  - `transformStatus`: `failed` queue
  - `isCongestedCluster`: congestion queue
- `Evidence Library` must keep verification lanes tied to ingest/source quality signals:
  - `contentFetchStatus` (especially `fetched` vs missing/failed)
  - `sourceCategory` (including `official`, `opinion`)
  - `isCongestedCluster`
  - `sourceId == "semafor-security"` stream lane
- `Operations` must preserve draft and recently-updated monitoring lists for `newsItem` + `storyDigest`.
- Default document views for `newsItem` and `storyDigest` must include:
  - Form editor view
  - Verification summary view
  - JSON view
- Do not revert to default `documentTypeListItems()` root-only navigation for managed editorial types.
- If pipeline status enums or field names change, update `sanity/lib/structure.ts` filters in the same PR and keep this section in sync.

## Architecture and data flow

1. Source ingest (coverage breadth)
   - Pull + normalize RSS/Atom feeds: `/Users/brodielee/desem/lib/ingest/pull-defense-articles.ts`.
   - Source curation metadata and role taxonomy: `/Users/brodielee/desem/lib/ingest/sources.ts`.
2. Raw persistence (operational layer)
   - Upsert sources/articles in Supabase: `/Users/brodielee/desem/lib/ingest/persist.ts`.
3. Content enrichment (verification depth)
   - Extract full text, excerpts, images, reading metadata: `/Users/brodielee/desem/lib/ingest/enrich-articles.ts`.
4. Topic graph (reader utility + ranking)
   - Extract and classify topics: `/Users/brodielee/desem/lib/topics/extract-topics.ts`.
   - Persist topics and article links: `/Users/brodielee/desem/lib/topics/persist-topics.ts`.
5. Editorial modeling (curated layer)
   - Focus filtering: `/Users/brodielee/desem/lib/editorial/focus.ts`.
   - Clustering: `/Users/brodielee/desem/lib/editorial/clustering.ts`.
   - Congestion evaluation: `/Users/brodielee/desem/lib/editorial/congestion.ts`.
   - Deterministic digest generation + curated citation balance: `/Users/brodielee/desem/lib/editorial/deterministic-digest.ts` and `/Users/brodielee/desem/lib/editorial/curation.ts`.
   - Optional transform refinement: `/Users/brodielee/desem/lib/sanity/transform.ts`.
6. Curated sync
   - Draft sync to Sanity docs: `/Users/brodielee/desem/lib/sanity/sync.ts`.
   - Cluster/run persistence in Supabase via cron route.
7. Read-model assembly
   - Home/story API and UI models: `/Users/brodielee/desem/lib/editorial/ui-server.ts`.
   - Route handlers: `/Users/brodielee/desem/app/api/**`.

## Canonical boundaries

- Supabase boundary (raw + operational):
  - ingestion, enrichment, topics, comments, follows, run/cluster metadata.
- Sanity boundary (curated + editorial):
  - `newsItem` and `storyDigest` documents used for editorial presentation.
- UI assembly boundary:
  - `/Users/brodielee/desem/lib/editorial/ui-server.ts` owns composition and fallback behavior.
  - React components should render passed models, not re-implement ranking/curation logic.

## Project structure map

- `/Users/brodielee/desem/app`
  - App Router pages and API handlers.
  - Goal-critical pages:
    - `/Users/brodielee/desem/app/page.tsx` (scan-first home)
    - `/Users/brodielee/desem/app/stories/[clusterKey]/page.tsx` (verification-focused story view)
    - `/Users/brodielee/desem/app/stories/article/[id]/page.tsx` (source article + discussion)
    - `/Users/brodielee/desem/app/topics/[slug]/page.tsx` (topic discovery + follows)
  - Goal-critical APIs:
    - `/Users/brodielee/desem/app/api/cron/pull-articles/route.ts`
    - `/Users/brodielee/desem/app/api/editorial/*`
    - `/Users/brodielee/desem/app/api/articles/*`
    - `/Users/brodielee/desem/app/api/comments/*`
    - `/Users/brodielee/desem/app/api/me/topics/route.ts`
- `/Users/brodielee/desem/components`
  - Presentation components. Keep business logic in `lib/**`.
- `/Users/brodielee/desem/lib`
  - Product behavior and integration boundaries:
    - `ingest/`, `editorial/`, `topics/`, `articles/`, `comments/`, `sanity/`, `supabase/`, `user/`.
- `/Users/brodielee/desem/db/migrations`
  - Supabase schema contracts; app code must match migrated schema.
- `/Users/brodielee/desem/sanity/schemaTypes`
  - Curated content schema contracts; sync and read projections must match.
- `/Users/brodielee/desem/scripts`
  - Operational CLI entrypoints for ingest/backfill/scrape workflows.

## Key runtime invariants (must hold)

- Focus and ranking invariants:
  - Home stream primary pool excludes `focusBucket === 'other'`.
  - Per-source caps and opinion-only caps remain enforced.
  - Focus-bucket bias remains active for primary stream ordering.
- Attribution invariants:
  - Story cards and story detail maintain source links and role metadata.
  - Digest citations remain grounded in actual cluster members.
- Verification invariants:
  - Story detail exposes paged evidence blocks and feed blocks.
  - Source links remain navigable to original reporting URLs.
- Pipeline resiliency invariants:
  - Transform is attempted only when congestion + env prerequisites are met.
  - Transform failure must degrade to deterministic output without breaking publish path.
- Reader utility invariants:
  - Topic follows must remain auth-scoped and reversible.
  - Hidden comments render placeholders; report operations are idempotent per reporter.

## Database touchpoints

Commonly used tables:
- `news_sources`
- `ingested_articles`
- `topics`
- `article_topics`
- `user_topic_follows`
- `profiles`
- `article_comments`
- `comment_reports`
- `editorial_generation_runs`
- `story_clusters`
- `cluster_members`

When adding/changing fields:
- Update SQL migrations first.
- Update read/write mappings in lib modules and API routes.
- Update Sanity schema + sync mapping for curated fields.
- Re-check fallback paths in `ui-server` so missing fields fail gracefully.

## Environment and feature flags

Core env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or anon fallback)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `CRON_SECRET` (optional auth for cron route)

Editorial/Sanity flags:
- `EDITORIAL_PIPELINE_ENABLED`
- `EDITORIAL_SANITY_READS_ENABLED`
- `EDITORIAL_SANITY_PREVIEW_DRAFTS`
- `EDITORIAL_TRANSFORM_ENABLED`
- `EDITORIAL_EMBEDDINGS_ENABLED`
- `EDITORIAL_CLUSTER_THRESHOLD`
- `EDITORIAL_MAX_EMBEDDING_ARTICLES`
- `EDITORIAL_EMBEDDING_MODEL`
- `EDITORIAL_FOCUS_FILTER_ENABLED`
- `EDITORIAL_WINDOW_HOURS`
- `EDITORIAL_ARTICLE_LIMIT`

Sanity credentials:
- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_AGENT_TOKEN`
- `SANITY_SCHEMA_ID`
- `SANITY_API_VERSION`

Image filtering (optional):
- `NEXT_PUBLIC_SIGHTENGINE_API_KEY`
- `NEXT_PUBLIC_SIGHTENGINE_API_SECRET`
- `SIGHTENGINE_AI_GENERATED_THRESHOLD`

Recommended defaults to align with goals:
- Keep `EDITORIAL_FOCUS_FILTER_ENABLED=true` unless intentionally widening scope.
- Keep `EDITORIAL_SANITY_READS_ENABLED=true` for curated presentation.
- Keep `EDITORIAL_PIPELINE_ENABLED=true` in environments expected to produce digests.

## Operational commands

- Install and run:
  - `bun install`
  - `bun run dev`
- Quality:
  - `bun run lint`
  - `bun run test`
- Ingest:
  - `bun run ingest:pull --since-hours=72 --limit=120`
  - `bun run ingest:pull --since-hours=72 --limit=120 --to-supabase`
  - `bun run ingest:backfill`
  - `bun run ingest:scrape-semafor --url https://www.semafor.com/article/MM/DD/YYYY/slug`
- Cron pipeline:
  - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/pull-articles`

## Agent editing guardrails

- Prefer edits in `lib/**` for behavior changes; keep `components/**` mostly presentational.
- Preserve fallback behavior when dependencies are unavailable (Supabase, Sanity, Transform, embeddings, image checks).
- Do not bypass auth checks in API handlers.
- Do not use admin clients in user-facing request paths unless explicitly required (cron/moderation/backfill contexts are expected exceptions).
- Keep source attribution intact when changing digest/citation or feed composition logic.
- Prefer reversible, incremental changes over schema-wide refactors when a focused change can satisfy the goal.
- When touching ranking/curation logic, update or add tests in:
  - `/Users/brodielee/desem/lib/editorial/*.test.ts`
  - `/Users/brodielee/desem/lib/sanity/sync.test.ts`
  - `/Users/brodielee/desem/lib/topics/extract-topics.test.ts`

## Change acceptance checklist

Before finalizing a behavior change, verify:

- Does the change improve scan speed, verification depth, attribution clarity, or reader utility?
- Does it preserve Supabase raw layer + Sanity curated layer responsibilities?
- Does it keep focus-bucket prioritization intact (or explicitly document why it changes)?
- Does it preserve fallback and failure behavior?
- Are tests updated where ranking, clustering, curation, or topic extraction changed?

## Where to change what (quick lookup)

- Add/modify feed sources: `/Users/brodielee/desem/lib/ingest/sources.ts`
- Change ingestion normalization/dedup: `/Users/brodielee/desem/lib/ingest/pull-defense-articles.ts`
- Change clustering behavior: `/Users/brodielee/desem/lib/editorial/clustering.ts`
- Change editorial focus criteria: `/Users/brodielee/desem/lib/editorial/focus.ts`
- Change citation mix/role handling: `/Users/brodielee/desem/lib/editorial/curation.ts`
- Change home/story feed composition and fallbacks: `/Users/brodielee/desem/lib/editorial/ui-server.ts`
- Change comments/reporting/moderation: `/Users/brodielee/desem/lib/comments/server.ts` and `/Users/brodielee/desem/app/api/comments/*`
- Change Sanity sync payloads: `/Users/brodielee/desem/lib/sanity/sync.ts` and `/Users/brodielee/desem/sanity/schemaTypes/*`
