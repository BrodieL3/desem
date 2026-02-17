import Link from "next/link";
import type { ReactNode } from "react";

import { buildHomeEditionLayout } from "@/lib/editorial/home-layout";
import { resolveInternalStoryHref } from "@/lib/editorial/linking";
import { getGprData } from "@/lib/data/signals/gpr-server";
import { getAwardMatrixData } from "@/lib/data/signals/usaspending-server";
import { getDefenseMoneyChartsData } from "@/lib/data/signals/charts-server";
import type {
  CuratedHomeForYouRail,
  CuratedStoryCard,
} from "@/lib/editorial/ui-types";
import { getCuratedHomeData } from "@/lib/editorial/ui-server";
import { getUserSession } from "@/lib/user/session";
import { HomeAwardMatrixChart } from "@/components/money/charts/home-award-matrix-chart";
import { PrimeSparklinesChart } from "@/components/money/charts/prime-sparklines-chart";
import { MacroRiskCard } from "@/components/money/macro-risk-card";
import { RightRailTopics } from "@/components/editorial/right-rail-topics";
import { SectionLabel } from "@/components/editorial/section-label";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const storyTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatStoryTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return storyTimeFormatter.format(parsed);
}

function compactText(value: string, maxChars: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const slice = normalized.slice(0, maxChars + 1);
  const breakIndex = slice.lastIndexOf(" ");
  const bounded =
    breakIndex > Math.floor(maxChars * 0.6)
      ? slice.slice(0, breakIndex)
      : slice.slice(0, maxChars);
  return `${bounded.trimEnd()}...`;
}

function compactStorySummary(story: CuratedStoryCard, maxChars = 180) {
  const raw = story.whyItMatters.trim() || story.dek.trim() || "";
  return raw ? compactText(raw, maxChars) : "";
}

function resolveStoryHref(story: CuratedStoryCard) {
  return resolveInternalStoryHref({
    articleId: story.sourceLinks[0]?.articleId,
    clusterKey: story.clusterKey,
  });
}

function splitForWireColumns(stories: CuratedStoryCard[]) {
  const left: CuratedStoryCard[] = [];
  const right: CuratedStoryCard[] = [];

  stories.forEach((story, index) => {
    if (index % 2 === 0) {
      left.push(story);
      return;
    }

    right.push(story);
  });

  return [left, right] as const;
}

type StoryTitleLinkProps = {
  story: CuratedStoryCard;
  className: string;
  children: ReactNode;
};

function StoryTitleLink({ story, className, children }: StoryTitleLinkProps) {
  return (
    <Link href={resolveStoryHref(story)} className={className}>
      {children}
    </Link>
  );
}

function LeadStory({ story }: { story: CuratedStoryCard }) {
  const summary = compactStorySummary(story, 220);

  return (
    <article className="news-divider-item px-1 md:py-6">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-3 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)} ·{" "}
          {story.citationCount} sources
        </p>

        <h2 className="font-display text-[2.55rem] leading-[1.01] text-foreground transition-colors group-hover:text-primary md:text-[3.35rem]">
          {story.headline}
        </h2>

        {summary ? (
          <p className="text-muted-foreground mt-4 max-w-4xl text-[1.14rem] leading-relaxed">
            {summary}
          </p>
        ) : null}

        {story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="mt-5 h-[25rem] w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </StoryTitleLink>
    </article>
  );
}

function SectionStoryRow({
  story,
  showSummary = true,
  showImage = false,
}: {
  story: CuratedStoryCard;
  showSummary?: boolean;
  showImage?: boolean;
}) {
  const summary = compactStorySummary(story, 170);

  return (
    <article className="news-divider-item px-1">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-2 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.92rem] leading-[1.08] text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>

        {showImage && story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="mt-3 h-44 w-full object-cover"
            loading="lazy"
          />
        ) : null}

        {showSummary && summary ? (
          <p className="text-muted-foreground mt-2 text-[1.03rem] leading-relaxed">
            {summary}
          </p>
        ) : null}
      </StoryTitleLink>
    </article>
  );
}

function WireStoryRow({ story }: { story: CuratedStoryCard }) {
  return (
    <article className="news-divider-item news-divider-item-compact px-1">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.6rem] leading-tight text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>
      </StoryTitleLink>
    </article>
  );
}

type HomeColumnSectionProps = {
  heading: string;
  stories: CuratedStoryCard[];
  className?: string;
};

function HomeColumnSection({
  heading,
  stories,
  className,
}: HomeColumnSectionProps) {
  return (
    <section
      className={className}
      aria-labelledby={`${heading.toLowerCase()}-heading`}
    >
      {stories.length === 0 ? (
        <p className="news-divider-list news-divider-item px-1 text-sm text-muted-foreground">
          Stories for this section are still being curated.
        </p>
      ) : (
        <div className="news-divider-list news-divider-list-no-top">
          {stories.map((story, index) => (
            <SectionStoryRow
              key={story.clusterKey}
              story={story}
              showImage={index === 0}
              showSummary={index < 2}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ForYouStoryRow({
  story,
  showImage,
}: {
  story: CuratedStoryCard;
  showImage: boolean;
}) {
  return (
    <article className="news-divider-item news-divider-item-compact px-1">
      <StoryTitleLink
        story={story}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.45rem] leading-tight text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>

        {showImage && story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="mt-3 h-36 w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </StoryTitleLink>
    </article>
  );
}

function ForYouTopics({
  rail,
  isAuthenticated,
}: {
  rail: CuratedHomeForYouRail;
  isAuthenticated: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="for-you-heading">
      <SectionLabel id="for-you-heading">{rail.title}</SectionLabel>

      {rail.notice ? (
        <p className="text-muted-foreground text-sm">{rail.notice}</p>
      ) : null}

      <RightRailTopics
        topics={rail.topics}
        title="Topic actions"
        headingId="for-you-topic-actions-heading"
        collapsedMax={3}
        showFollowActions
        isAuthenticated={isAuthenticated}
      />
    </section>
  );
}

function ForYouStories({
  stories,
}: {
  stories: CuratedStoryCard[];
}) {
  if (stories.length === 0) {
    return (
      <p className="news-divider-list news-divider-list-no-top news-divider-item px-1 text-sm text-muted-foreground">
        Personalized stories will appear here as you follow topics.
      </p>
    );
  }

  return (
    <div className="news-divider-list news-divider-list-no-top">
      {stories.map((story, index) => (
        <ForYouStoryRow
          key={story.clusterKey}
          story={story}
          showImage={index === 0}
        />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const session = await getUserSession();
  const [home, gprSummary, awardMatrixData, moneyCharts] = await Promise.all([
    getCuratedHomeData({
      limit: 84,
      fallbackRaw: true,
      userId: session.userId,
    }),
    getGprData(),
    (() => {
      const end = new Date();
      const start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - 6);
      return getAwardMatrixData({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
    })(),
    getDefenseMoneyChartsData(),
  ]);

  const now = dateFormatter.format(new Date());
  const layout = buildHomeEditionLayout(home.stories);
  const [wireLeft, wireRight] = splitForWireColumns(layout.wire);

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1320px] p-5 md:p-8">
        <header className="mb-8 border-b border-border pb-6 md:pb-8">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              <h1 className="font-display text-[3.25rem] leading-none text-foreground sm:text-[4.2rem] md:text-[4.7rem]">
                Field <span className="text-primary">Brief</span>
              </h1>
              <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">
                International defense desk
              </p>
              {home.notice ? (
                <p className="text-muted-foreground text-sm">{home.notice}</p>
              ) : null}
            </div>

            <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">
              {now}
            </p>
          </div>
        </header>

        {!layout.lead ? (
          <p className="news-divider-list news-divider-item px-1 text-base text-muted-foreground">
            Today&apos;s briefing is being prepared. Check back shortly.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-10">
              <section aria-labelledby="lead-heading">
                <div className="news-divider-list news-divider-list-no-top">
                  <LeadStory story={layout.lead} />
                </div>
              </section>

              <HomeAwardMatrixChart data={awardMatrixData} />

              <section
                aria-labelledby="edition-columns-heading"
                className="space-y-4"
              >
                <div className="grid gap-6 lg:grid-cols-3">
                  <HomeColumnSection
                    heading="Signals"
                    stories={layout.signals}
                  />
                  <HomeColumnSection
                    heading="World"
                    stories={layout.world}
                    className="news-column-rule"
                  />
                  <HomeColumnSection
                    heading="Industry"
                    stories={layout.industry}
                    className="news-column-rule"
                  />
                </div>
              </section>

              {gprSummary.latest ? (
                <div className="news-divider-list news-divider-list-no-top">
                  <MacroRiskCard summary={gprSummary} />
                </div>
              ) : null}

              <section aria-labelledby="wire-heading" className="space-y-4">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="news-divider-list news-divider-list-no-top">
                    {wireLeft.map((story) => (
                      <WireStoryRow key={story.clusterKey} story={story} />
                    ))}
                  </div>
                  <div className="news-divider-list news-divider-list-no-top news-column-rule">
                    {wireRight.map((story) => (
                      <WireStoryRow key={story.clusterKey} story={story} />
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <aside className="news-column-rule right-rail-scroll space-y-4">
              {home.forYou ? (
                <ForYouTopics
                  rail={home.forYou}
                  isAuthenticated={session.isAuthenticated}
                />
              ) : null}

              <PrimeSparklinesChart
                module={moneyCharts.primeSparklines}
                stale={moneyCharts.staleData.market}
              />

              {home.forYou ? (
                <ForYouStories stories={home.forYou.stories} />
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
