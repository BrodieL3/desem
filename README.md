# Field Brief V2

Field Brief is a defense-focused news aggregator built with Next.js and Supabase.

Core behavior:
- Pulls defense articles from RSS/Atom feeds.
- Stores and displays full article text in Field Brief.
- Extracts and links topics/entities for exploration and personalization.
- Supports signed-in comments and comment reporting.
- Ranks feed by followed topics when authenticated.

## Stack

- Next.js App Router
- Bun
- shadcn/ui
- Supabase (SSR auth + storage + RLS)
- RSS/Atom ingestion + HTML full-text extraction (`jsdom` + `@mozilla/readability`)

## Routes

- `/` - newspaper-style front page with lead story, headline river, trending topics, followed topics, and most discussed
- `/articles/[id]` - full article reading view + topic chips + comments
- `/topics/[slug]` - topic explorer with related coverage and co-occurring topics
- `/auth/sign-in` - magic-link sign-in
- `/auth/callback` - auth callback handler
- `/auth/sign-out` - sign-out redirect route

## API routes

- `/api/articles` - list/search/filter articles (`q`, `topic`, `limit`, `offset`)
- `/api/articles/[id]` - article detail payload
- `/api/articles/[id]/comments` - list/create comments
- `/api/comments/[id]/report` - report comment abuse
- `/api/comments/[id]/moderate` - moderator-only hide/restore action
- `/api/me/topics` - read/update followed topics
- `/api/cron/pull-articles` - pull + persist + content enrichment + topic extraction

## Database migrations

Apply these in Supabase SQL editor:

1. `db/migrations/202602120001_interest_first_personalization.sql`
2. `db/migrations/202602120002_article_ingestion.sql`
3. `db/migrations/202602120004_article_content.sql`
4. `db/migrations/202602120005_topics.sql`
5. `db/migrations/202602120006_comments.sql`

Notes:
- Migration `202602120003_article_tagging.sql` is legacy and no longer required for V2 behavior.
- Existing ingested articles are preserved; new columns are additive.

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..." # required for cron/backfill enrichment
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
CRON_SECRET="..." # optional, used to authorize cron route
```

## Run locally

```bash
bun install
bun run dev
```

Lint and tests:

```bash
bun run lint
bun run test
```

## Pull and persist articles

Pull feed metadata only:

```bash
bun run ingest:pull --since-hours=72 --limit=120
```

Pull and upsert into Supabase:

```bash
bun run ingest:pull --since-hours=72 --limit=120 --to-supabase
```

Then enrich full text + topics for existing rows:

```bash
bun run ingest:backfill
```

## Cron ingestion

`/api/cron/pull-articles` runs:
- feed pull
- upsert sources/articles
- full-text enrichment (concurrency 5, 15s timeout each)
- topic extraction/persistence

Example local invocation:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/pull-articles
```

## Personalization and ranking

- Anonymous: newest-first (`published_at desc`, tie-break by source weight)
- Authenticated with follows:
  - `score = (primary_topic_matches * 5) + (secondary_topic_matches * 2) + source_weight + recency_decay`
  - `recency_decay` uses a 36-hour half-life

## Moderation model (V1)

- Any authenticated user can comment.
- Any authenticated user can report comments.
- Hidden comments are rendered as collapsed moderation placeholders (body removed).
- Flat comment threads only (no nesting in V1).
