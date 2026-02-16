Your site already has a strong “morning brief” shape; the biggest improvements are (1) making the value prop and navigation clearer, and (2) tightening “data freshness + trust” so readers believe the signals. Right now the homepage reads like a single-source feed (“Showing Semafor Security coverage”) with a finance/signal module bolted in, so a bit more structure will make it feel like a product instead of a page of links. [desem.vercel](https://desem.vercel.app/)

## Immediate fixes (high leverage)
The Data page currently surfaces several “broken/stale” states in the UI (e.g., “0 records,” “Money signals may be stale,” and “Prime metrics disabled. Set `DATA_PRIMES_ENABLED=true` to enable.”), and that undermines confidence even if the rest is good.  Change these into explicit, user-friendly states: “Last updated,” “Next refresh,” and “What’s included today,” and hide/grey modules that are disabled instead of showing raw env-var instructions to end users. [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)

- Replace “0 records” with a clear empty-state reason + action (e.g., “No data ingested in the last 24h → Run ingest / Check status” for you, “Data updating → check back at 8am ET” for users) [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)
- Add “Last refreshed at …” to Money Signals and the briefing feed so “stale” becomes measurable, not scary [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)
- If you keep “SELL” labels, add a short disclaimer and rename to something less trading-coded (e.g., “Signal: Cooling / Heating”) to avoid misinterpretation as investment advice [desem.vercel](https://desem.vercel.app/)

## Homepage UX (make scanning faster)
Your homepage has good ingredients—source, timestamp, headline, and a link to story pages—but it needs a clearer hierarchy and a couple of “reader tools” for speed.  Treat the page as three lanes: (A) top 5 “must read,” (B) the broader feed, (C) topics/personalization, and make it obvious how to switch sources beyond Semafor. [desem.vercel](https://desem.vercel.app/)

- Add a “Featured” cluster at the top (5 items max) with 1-line “why it matters” per story  
- Add filters above the feed: Source, Topic, Region, “Today / Week,” and a “Only analysis” toggle (this helps you expand beyond “Showing Semafor Security coverage”) [desem.vercel](https://desem.vercel.app/)
- Add “Save / Mark read” so personalization isn’t only behind “Sign in and follow topics” [desem.vercel](https://desem.vercel.app/)

## Trust & transparency (especially for signals)
On /data you already explain the intent (“Mission-linked defense money signals…”), but users will trust it more if you show methodology and evidence more consistently.  Also, the page literally contains “Source gap: insufficient citation-resolvable evidence for claims” in a few spots, which reads like an internal debug message—move that to logs and present a normal “Insufficient data” UI instead. [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)

- Add a “How signals are generated” page: sources used, update frequency, and what each bucket (e.g., c5isr) means [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)
- Wherever you produce an implication (e.g., “Prioritize c5isr pipeline positioning”), add a “Because …” line that cites the underlying metric (award count, concentration, delta vs baseline) [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)
- Provide a consistent “Evidence” drawer per card: links to USAspending/SAM.gov/Finnhub and the computed fields you used [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)

## Engineering hygiene (so it stays fast)
You’ve described this as a Next.js + Sanity + Supabase style build, which is a great fit for “public pages + personalized overlays,” but you’ll want strong caching and guardrails around third-party data calls.  In particular, anything that hits external APIs (USAspending, SAM.gov, market data) should be fetched server-side with caching + rate limits, and the UI should degrade gracefully when those calls fail. [desem.vercel](https://desem.vercel.app/)

- Add per-module caching (e.g., 15–60 min) and show “cached as of …”  
- Add error budgets: if primes are disabled or stale, don’t block the whole page—just collapse that module with a friendly note [perplexity](https://www.perplexity.ai/search/3d03eea2-1a7c-443b-b56d-daca1e9200cd)
- Add basic observability: request IDs, module-level timings, and a simple status page (“Ingestion OK / Degraded / Down”)

What’s the main goal you care about most right now: daily active readers, time-on-page, sign-ins, or “people click through to /data and actually use it”?
