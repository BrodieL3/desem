# Field Brief

**Live:** [desem.vercel.app](https://desem.vercel.app)

Field Brief is a personalized defense-tech and government news feed. It aggregates articles from 15 curated sources, clusters them into stories, and surfaces defense spending signals — all tailored to what the user follows.

## What it does

**Curated news feed** — Pulls from Breaking Defense, Defense News, C4ISRNET, Defense One, The War Zone, USNI News, and 9 more defense/security outlets. Articles are ingested via RSS, enriched with full-text extraction, and grouped into story clusters using hybrid lexical + embedding similarity.

**Topic-based personalization** — An LLM-powered pipeline extracts entities and topics from every article. Users sign in, follow topics they care about, and the feed re-ranks around their interests using a weighted scoring model (topic match strength + source quality + recency decay).

**Story clustering and digests** — Related articles are automatically grouped into narrative clusters. Each cluster gets a generated digest with citations grounded in the underlying reporting, so users can scan a story quickly and drill into source material.

**Defense money signals** — A `/data` dashboard tracks DoD contract awards (USAspending), SAM.gov opportunities, and defense-sector market data (Finnhub). Weekly rollups surface spending trends, prime contractor moves, and structural shifts in procurement.

**Comments and discussion** — Authenticated users can comment on articles and report abuse. Moderation uses a flag-and-review model.

## How personalization works

| User state | Ranking behavior |
|---|---|
| Anonymous | Newest-first, tie-break by source quality weight |
| Signed in with follows | `score = (primary_topic_matches * 5) + (secondary_topic_matches * 2) + source_weight + recency_decay` with a 36-hour half-life |

Users set their interests by following topics. The topic graph is built automatically from article content via LLM entity extraction — no manual tagging required.

## Architecture

```
RSS/Atom feeds (15 sources)
    |
    v
Ingest pipeline (pull + normalize + dedup)
    |
    v
Supabase (raw articles, topics, comments, signals)
    |
    v
Editorial pipeline (clustering + digest generation + curation)
    |
    v
Sanity CMS (curated newsItem + storyDigest documents)
    |
    v
Next.js App Router (SSR pages + personalized ranking)
```

**Two-layer data model:**
- **Supabase** — operational layer for raw ingestion, topic graphs, user follows, comments, financial data, and pipeline metadata.
- **Sanity** — editorial layer for curated story digests and reviewed news items. Supports a Studio-based editorial workflow with review queues and verification views.

**Automated daily pipeline** — A single Vercel cron triggers the full cycle: feed pull, content enrichment, topic extraction, story clustering, digest generation, Sanity sync, and financial data updates.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Database:** Supabase (SSR auth + Postgres + RLS)
- **CMS:** Sanity (editorial pipeline output + Studio admin)
- **UI:** Tailwind CSS v4 + shadcn/ui + Radix UI + Recharts
- **Ingestion:** RSS/Atom parsing + jsdom + @mozilla/readability for full-text extraction
- **Clustering:** Union-find with hybrid lexical + OpenAI embedding similarity
- **Financial data:** USAspending API, SAM.gov API, Finnhub market data, SEC EDGAR filings
- **Runtime:** Bun + Vercel

## Pages

| Route | Description |
|---|---|
| `/` | Newspaper-style front page with lead story, headline river, trending topics, followed topics |
| `/stories/[clusterKey]` | Story detail with digest narrative + paged evidence blocks from source articles |
| `/stories/article/[id]` | Full-source reading view + topic chips + comments |
| `/topics/[slug]` | Topic explorer with related coverage and co-occurring topics |
| `/topics` | Topic directory |
| `/search` | Article search |
| `/awards` | Defense contract awards dashboard |
| `/data` | Defense money signals (spend pulse, prime moves, awards, macro context) |

## Local setup

```bash
bun install
cp .env.example .env.local   # fill in your keys
bun run dev                   # http://localhost:3000
```

See `.env.example` for all required and optional environment variables.

### Database

Apply migrations in order from `db/migrations/` in the Supabase SQL editor. The numbered prefix determines the order.

### Ingestion scripts

```bash
bun run ingest:pull --since-hours=72 --limit=120 --to-supabase   # pull + persist articles
bun run ingest:backfill                                           # enrich full text + topics
bun run data:sync-money                                           # sync defense spending data
bun run data:backfill-market --days=31                            # backfill market history
```

Or trigger the full pipeline locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/pull-articles
```

### Quality

```bash
bun run lint
bun run test
```

## Project structure

```
app/                    Next.js pages and API routes
  api/cron/             Daily ingestion pipeline
  api/editorial/        Sanity-backed editorial feed endpoints
  api/data/             Financial data endpoints
  api/articles/         Article list/detail/comments
  api/me/               User personalization endpoints
lib/                    Server-side business logic
  ingest/               Feed pulling, enrichment, source metadata
  editorial/            Clustering, curation, digest generation, home assembly
  topics/               LLM topic extraction and persistence
  data/signals/         Defense spending and market data pipelines
  data/primes/          SEC filing scrape for defense contractor metrics
  sanity/               Sanity client, sync, and Transform integration
  articles/             Article queries with personalized ranking
  comments/             Comment persistence and moderation
components/             React presentation components
  editorial/            Story cards, digests, home feed blocks
  data/                 Financial visualizations
  ui/                   shadcn/ui primitives
sanity/                 Sanity Studio schema and configuration
db/migrations/          Supabase DDL migrations (apply in order)
scripts/                CLI tools for ingest, backfill, and data sync
```
