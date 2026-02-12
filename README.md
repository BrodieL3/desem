# Field Brief

Field Brief is a shadcn-first defense briefing app with interest-first personalization.

Users can browse publicly, sign in with Supabase magic links, choose mission/domain/tech interests, and receive a weighted blended feed.

## Stack

- Next.js App Router
- Bun
- shadcn/ui
- Sanity (story authoring)
- Supabase (SSR auth + user personalization)

## Routes

- `/` - blended feed with track + quick filters and personalization status
- `/auth/sign-in` - magic-link sign-in
- `/auth/callback` - auth callback handler
- `/auth/sign-out` - sign-out redirect route
- `/onboarding` - first-login interest setup
- `/settings/interests` - interest editor
- `/story/[slug]` - story detail view with blended analyst summary + station drill-down
- `/mission/[mission]` - mission timeline view
- `/studio` - Sanity Studio

## Data model

- Story source object: `/Users/brodielee/desem/lib/defense/types.ts` (`DefenseSemaformStory`)
- User personalization:
  - `/Users/brodielee/desem/lib/user/types.ts`
  - `/Users/brodielee/desem/lib/user/interests.ts`
- SQL migrations:
  - `/Users/brodielee/desem/db/migrations/202602120001_interest_first_personalization.sql`
  - `/Users/brodielee/desem/db/migrations/202602120002_article_ingestion.sql`
  - `/Users/brodielee/desem/db/migrations/202602120003_article_tagging.sql`

## Key behavior

- Authenticated users are redirected to onboarding until interests are saved.
- Feed ranking uses `mission*3 + domain*2 + tech*1 + highImpactBonus`.
- Story UI defaults to blended analyst bullets with optional station-level drill-down.
- Legacy `station` query params are ignored.

## Run

```bash
bun install
bun run dev
```

## Database setup

Interest onboarding requires the SQL migration at:

`/Users/brodielee/desem/db/migrations/202602120001_interest_first_personalization.sql`

Apply it in Supabase SQL Editor before using `/onboarding`.

If this is not applied, onboarding save will fail with a table/schema cache error like:

`Could not find the table 'public.profiles' in the schema cache`

## Env

```bash
NEXT_PUBLIC_SANITY_PROJECT_ID="..."
NEXT_PUBLIC_SANITY_DATASET="stories"
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..."
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

Optional fallback:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..." # only needed for privileged server operations
CRON_SECRET="..." # required to authorize Vercel cron route
```

## Pull articles

Use the built-in RSS/Atom puller to fetch and normalize defense articles:

```bash
bun run ingest:pull --since-hours=72 --limit=120
```

Useful flags:

- `--sources=defense-news,breaking-defense,dod-releases` to scope sources
- `--json=./tmp/defense-articles.json` to save full output
- `--to-supabase` to upsert results into Supabase tables

Source list lives in:

- `/Users/brodielee/desem/lib/ingest/sources.ts`

To persist pulled articles, apply:

- `/Users/brodielee/desem/db/migrations/202602120002_article_ingestion.sql`
- `/Users/brodielee/desem/db/migrations/202602120003_article_tagging.sql`

## Daily cron (Vercel)

Daily ingestion is configured in:

- `/Users/brodielee/desem/vercel.json`

Cron target endpoint:

- `/api/cron/pull-articles`

It pulls feeds, applies mission/domain/technology tagging, and upserts to Supabase.

You can test it locally:

```bash
curl -H \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/pull-articles
```

Pulled/tagged articles appear on the home page in the **Live wire** section.

If no Sanity stories exist yet, local fallback stories are used from:

- `/Users/brodielee/desem/lib/defense/sample-data.ts`
