# Field Brief V2

Field Brief is a defense-focused news aggregator built with Next.js and Supabase.

Core behavior:
- Pulls defense articles from RSS/Atom feeds.
- Stores and displays full article text in Field Brief.
- Extracts and links topics/entities for exploration and personalization.
- Supports signed-in comments and comment reporting.
- Ranks feed by followed topics when authenticated.
- Runs an editorial pipeline where Supabase is raw ingest and Sanity is canonical curated output.

## Stack

- Next.js App Router
- Bun
- shadcn/ui
- Supabase (SSR auth + storage + RLS)
- RSS/Atom ingestion + HTML full-text extraction (`jsdom` + `@mozilla/readability`)

## Routes

- `/` - newspaper-style front page with lead story, headline river, trending topics, followed topics, and most discussed
- `/stories/article/[id]` - full-source reading view + topic chips + comments
- `/topics/[slug]` - topic explorer with related coverage and co-occurring topics
- `/data` - defense-tech money signals (spend pulse, prime moves, awards, structural shifts, macro context) plus prime backlog/book-to-bill module
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
- `/api/cron/pull-articles` - pull + persist + content enrichment + topic extraction + clustering + editorial sync
- `/api/editorial/feed` - curated Sanity-backed editorial feed
- `/api/editorial/clusters` - curated story-cluster digests from Sanity
- `/api/data/primes` - prime backlog/book-to-bill dashboard payload
- `/api/data/signals` - defense-tech money signals payload for home/data surfaces

## Database migrations

Apply these in Supabase SQL editor:

1. `db/migrations/202602120001_interest_first_personalization.sql`
2. `db/migrations/202602120002_article_ingestion.sql`
3. `db/migrations/202602120004_article_content.sql`
4. `db/migrations/202602120005_topics.sql`
5. `db/migrations/202602120006_comments.sql`
6. `db/migrations/202602130007_editorial_pipeline.sql`
7. `db/migrations/202602130008_source_curation_metadata.sql`
8. `db/migrations/202602130009_prime_metrics.sql`
9. `db/migrations/202602160001_defense_money_signals.sql`

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

# Sanity editorial pipeline (canonical output)
SANITY_PROJECT_ID="..."
SANITY_DATASET="..."
SANITY_AGENT_TOKEN="..." # read/write token for agent actions
SANITY_SCHEMA_ID="..."
SANITY_API_VERSION="vX" # required for Transform API calls

# Optional controls
EDITORIAL_PIPELINE_ENABLED="true"
EDITORIAL_SANITY_READS_ENABLED="true"
EDITORIAL_SANITY_PREVIEW_DRAFTS="false" # dev preview: include Sanity drafts in home/story reads
EDITORIAL_TRANSFORM_ENABLED="true"
EDITORIAL_EMBEDDINGS_ENABLED="true"
EDITORIAL_CLUSTER_THRESHOLD="0.72"
EDITORIAL_MAX_EMBEDDING_ARTICLES="120"
EDITORIAL_EMBEDDING_MODEL="text-embedding-3-small"
EDITORIAL_SEMAPHOR_SYNC_ENABLED="true"
EDITORIAL_SEMAPHOR_LIMIT="200"
EDITORIAL_SEMAPHOR_CONCURRENCY="4"
EDITORIAL_SEMAPHOR_TIMEOUT_MS="20000"
OPENAI_API_KEY="..." # optional for embedding similarity in clustering
DATA_PRIMES_ENABLED="false" # enable /data and /api/data/primes
SEC_USER_AGENT="FieldBrief/1.0 (email@example.com)" # recommended for SEC data endpoints

# Defense-money signals
DATA_MONEY_SIGNALS_ENABLED="true"
USASPENDING_API_BASE_URL="https://api.usaspending.gov"
DATA_MONEY_MIN_TRANSACTION_USD="10000000"
DATA_MONEY_MAX_TRANSACTION_PAGES="25"
DATA_MONEY_ALLOWED_AWARDING_AGENCIES="Department of Defense"
DATA_MONEY_BUCKET_RULESET_VERSION="v1"
FINNHUB_API_KEY="..."
DATA_MONEY_MARKET_TICKERS="LMT,RTX,NOC,GD,BA,LHX"
DATA_MONEY_MARKET_BACKFILL_DAYS="31"
DATA_MONEY_LLM_ENABLED="true"
DATA_MONEY_LLM_MODEL="gpt-4.1-mini"
DATA_MONEY_MACRO_SNAPSHOT_PATH="/Users/brodielee/desem/scripts/data/macro-budget-context.yaml"

# Optional incident escalation
GITHUB_TOKEN="..."
GITHUB_REPO="owner/repo"
GITHUB_ISSUE_LABEL="money-signals"
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

Scrape full article text from a Semafor article URL:

```bash
bun run ingest:scrape-semafor --url https://www.semafor.com/article/MM/DD/YYYY/slug
```

Backfill/sync Semafor Security stories into Sanity `newsItem` docs (with full text):

```bash
bun run editorial:sync-semafor --limit=200 --concurrency=4
```

Backfill prime metrics from curated official seed data:

```bash
bun run data:backfill-primes
```

Sync latest prime metrics from SEC filings:

```bash
bun run data:sync-primes --filings-per-company=1
```

Sync daily defense money signals (DoD spend + market + cards):

```bash
bun run data:sync-money
```

Backfill 24 months of business-day money signals with resume checkpoint:

```bash
bun run data:backfill-money
```

Rebuild weekly/monthly structural rollups:

```bash
bun run data:rebuild-money-rollups
```

Backfill one month of market history:

```bash
bun run data:backfill-market --days=31
```

Sync curated macro context YAML into Supabase:

```bash
bun run data:sync-macro
```

## Cron ingestion

`/api/cron/pull-articles` runs:
- feed pull
- upsert sources/articles
- full-text enrichment (concurrency 5, 15s timeout each)
- topic extraction/persistence
- hybrid story clustering (lexical + optional embeddings)
- congestion scoring (Transform fallback only when cluster has >=10 stories and >=6 sources in 24h)
- deterministic digest fallback if Transform fails/unavailable
- draft-first Sanity sync for `newsItem` and `storyDigest`
- Semafor Security sync into Sanity `newsItem` docs with full body text for continuous-scroll reads
- prime metrics sync (including LHX) from SEC submissions
- defense money signals sync (DoD spend pulse, prime moves, awards cards, structural rollups, macro context)
- Supabase ops persistence in `editorial_generation_runs`, `story_clusters`, and `cluster_members`

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
