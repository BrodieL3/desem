# Component Catalog

Quick reference for every reusable component. Grouped by domain so you can think about placement and composition.

---

## Layout & Navigation

| Component | Path | Type | Purpose |
|-----------|------|------|---------|
| **ModuleShell** | `components/data/module-shell.tsx` | Server | Section wrapper — eyebrow, title, description, optional actions slot. Every data module on `/data` uses this. |
| **BackToFrontPageButton** | `components/back-to-front-page-button.tsx` | Server | Fixed top-left chevron link back to `/`. |
| **SiteDrawer** | `components/site-drawer.tsx` | Client | Fixed top-right hamburger — search, theme toggle, account dropdown. |
| **SiteSearch** | `components/site-search.tsx` | Client | Expandable search input with live typeahead and top-hit dropdown. |
| **ThemeToggle** | `components/theme-toggle.tsx` | Client | Light/dark mode toggle with localStorage persistence. |
| **SectionLabel** | `components/editorial/section-label.tsx` | Server | Uppercase label with optional top rule. Used in editorial rails. |

---

## Money Signal Cards (narrative)

These render AI-generated briefing cards — text-heavy, no charts.

| Component | Path | Type | Props summary | Renders |
|-----------|------|------|---------------|---------|
| **DataMoneyModule** | `components/money/data-money-module.tsx` | Server | `heading`, `card`, `emptyLabel` | Single money signal card: action lens, summary, "so what", citations. |
| **HomeMoneyTiles** | `components/money/home-money-tiles.tsx` | Server | `dailySpendPulse`, `primeMoves`, `thisWeekSignal?`, `gprSummary?` | Homepage preview grid (2 cards + macro risk). Links to `/data`. |
| **ChartSummaryBlock** | `components/money/charts/chart-summary-block.tsx` | Client | `summary` | Inline narrative below a chart — action lens, claims with citations, "so what". |
| **CitationLinks** | `components/money/citation-links.tsx` | Server | `citations`, `max?` | Renders up to N source links. Embedded in cards and summaries. |

---

## Money Signal Charts (visual)

All client components. All accept a `stale` boolean for freshness badges.

| Component | Path | Data source | Renders |
|-----------|------|-------------|---------|
| **DemandMomentumChart** | `charts/demand-momentum-chart.tsx` | `moneyCharts.demandMomentum` | Area chart — trailing 20-day DoD obligations. |
| **ContractVelocityChart** | `charts/contract-velocity-chart.tsx` | `contractVelocity.points` | Dual-source area chart — USAspending (historical) + Defense.gov (recent). |
| **WeeklyCategoryShareChart** | `charts/weekly-category-share-chart.tsx` | `moneyCharts.weeklyCategoryShare` | Stacked area — 12-week category share evolution (aircraft, ships, etc.). |
| **ConcentrationTrendChart** | `charts/concentration-trend-chart.tsx` | `moneyCharts.concentrationTrend` | Dual mini line charts — weekly + monthly Top-5 recipient concentration. |
| **RecipientLeaderboardChart** | `charts/recipient-leaderboard-chart.tsx` | `moneyCharts.recipientLeaderboard` | Horizontal bars — top 8 recipients by trailing 30-day obligations. |
| **PrimeSparklinesChart** | `charts/prime-sparklines-chart.tsx` | `moneyCharts.primeSparklines` | Sparkline rows for LMT, RTX, NOC, GD, BA, LHX — trailing quotes + change %. |
| **NewsMoneyHeatmap** | `charts/news-money-heatmap.tsx` | `heatmapData` | Table heatmap — editorial topics vs contract spending buckets. |

---

## Pipeline Intelligence

| Component | Path | Type | Renders |
|-----------|------|------|---------|
| **PipelineFunnelChart** | `charts/pipeline-funnel-chart.tsx` | Client | SAM.gov funnel counts + horizontal bars by spending bucket. |

_(Approaching-deadlines list is inline in `/data/page.tsx` — not yet extracted.)_

---

## Macro Context

| Component | Path | Type | Renders |
|-----------|------|------|---------|
| **MacroRiskCard** | `components/money/macro-risk-card.tsx` | Client | GPR Index — level badge, score, delta, 24-month sparkline, source link. |

---

## Prime Contractor Metrics

| Component | Path | Type | Renders |
|-----------|------|------|---------|
| **MetricChartCard** | `components/data/metric-chart-card.tsx` | Client | Generic multi-line chart for any prime metric. Configurable formatter, reference line. |
| **BookToBillTrendChart** | `components/data/book-to-bill-trend-chart.tsx` | Client | Wrapper around MetricChartCard with 1.0 reference line. |
| **BacklogComparisonChart** | `components/data/backlog-comparison-chart.tsx` | Client | Bar chart + YoY delta table — cross-company backlog comparison. |
| **MetricsTable** | `components/data/metrics-table.tsx` | Client | Sortable/filterable table — backlog, book-to-bill, revenue, orders. Column toggles. |
| **AlertsPanel** | `components/data/alerts-panel.tsx` | Server | List of severity-tagged alerts (book-to-bill < 1, backlog decline, disclosure gaps). |
| **SourcesDrawer** | `components/data/sources-drawer.tsx` | Client | Sheet drawer listing filing sources (10-K, 8-K) with dates and links. |
| **RelationshipPlaceholder** | `components/data/relationship-placeholder.tsx` | Server | Placeholder for future company relationship network feature. |

---

## Editorial / Story Components

| Component | Path | Type | Renders |
|-----------|------|------|---------|
| **StoryCard** | `components/editorial/story-card.tsx` | Server | Preview card — source, timestamp, risk badge, headline, summary, diversity dots. |
| **RailSection** | `components/editorial/rail-section.tsx` | Server | Topic rail — heading + grid of StoryCards. |
| **StoryBriefingHeader** | `components/editorial/story-briefing-header.tsx` | Server | Story detail header — topic, attribution, headline, dek, "why it matters". |
| **StoryNewsFeed** | `components/editorial/story-news-feed.tsx` | Client | Expandable briefing narrative with paragraphs and images. |
| **SourceLinkList** | `components/editorial/source-link-list.tsx` | Server | Source articles grouped by role (official, reporting, analysis, opinion). |
| **EvidenceBlockList** | `components/editorial/evidence-block-list.tsx` | Client | Paginated evidence articles linked to a story cluster. Load-more pattern. |
| **TopicSpotlight** | `components/editorial/topic-spotlight.tsx` | Server | Featured topics list (max 8) with follow buttons. |
| **RightRailTopics** | `components/editorial/right-rail-topics.tsx` | Server | Sidebar topic nav with follow actions and manage link. |

---

## User Engagement

| Component | Path | Type | Renders |
|-----------|------|------|---------|
| **ContinuousStoryFeed** | `components/aggregator/continuous-story-feed.tsx` | Client | Infinite-scroll article feed with intersection observer. |
| **FollowTopicButton** | `components/aggregator/follow-topic-button.tsx` | Client | Follow/unfollow toggle with optimistic update. |
| **CommentThread** | `components/aggregator/comment-thread.tsx` | Client | Comment form + thread — post, report, moderate. |
| **ShareLinkButton** | `components/aggregator/share-link-button.tsx` | Client | Copy-URL-to-clipboard button. |
| **SignInForm** | `components/auth/sign-in-form.tsx` | Client | Magic link email input for Supabase auth. |

---

## UI Primitives (shadcn)

Accordion, Badge, Button, Card, DropdownMenu, ScrollArea, Separator, Sheet, Tabs, Toggle, ToggleGroup — all in `components/ui/`.

---

## Current Page Layouts

### Homepage (`app/page.tsx`)
```
BackToFrontPageButton + SiteDrawer
├─ Header (title, notice, GPR badge)
├─ Lead story (StoryCard featured)
├─ 2-col grid
│   ├─ Left: RailSections (topic rails of StoryCards)
│   └─ Right sidebar
│       ├─ HomeMoneyTiles (dailySpendPulse, primeMoves, MacroRiskCard)
│       ├─ TopicSpotlight
│       └─ RightRailTopics ("For You")
└─ ContinuousStoryFeed
```

### Data page (`app/data/page.tsx`)
```
BackToFrontPageButton
├─ Header (title, stale badges, GPR level badge)
├─ ModuleShell "Defense-tech money signals"
│   └─ 2-col grid of DataMoneyModules (daily, prime, awards, macro)
├─ ModuleShell "Weekly and monthly shifts"
│   └─ 2-col grid of DataMoneyModules (weekly, monthly)
├─ ModuleShell "Pipeline intelligence"
│   └─ PipelineFunnelChart + approaching deadlines list
├─ ModuleShell "Money signal charts"
│   └─ 2-col grid of all chart components
├─ ModuleShell "Prime signal monitor"
│   └─ Severity counters + AlertsPanel
├─ ModuleShell "Trend analysis"
│   └─ BookToBillTrendChart + BacklogComparisonChart
├─ ModuleShell "Quarterly detail"
│   └─ MetricsTable
├─ ModuleShell "Methodology and provenance"
│   └─ SourcesDrawer
└─ ModuleShell "Company collaboration signals"
    └─ RelationshipPlaceholder
```

### Story detail (`app/stories/[slug]/page.tsx`)
```
BackToFrontPageButton + SiteDrawer
├─ StoryBriefingHeader
├─ StoryNewsFeed
├─ SourceLinkList
├─ EvidenceBlockList
└─ CommentThread
```
