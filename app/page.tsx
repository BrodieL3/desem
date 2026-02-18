import Link from "next/link";
import type { ReactNode } from "react";

import { resolveInternalStoryHref } from "@/lib/editorial/linking";
import { getAwardMatrixData } from "@/lib/data/signals/usaspending-server";
import type { CuratedStoryCard } from "@/lib/editorial/ui-types";
import { getCuratedHomeData } from "@/lib/editorial/ui-server";
import { getUserSession } from "@/lib/user/session";
import { HomeAwardMatrixChart } from "@/components/money/charts/home-award-matrix-chart";
import { StandardRightRail } from "@/components/standard-right-rail";

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
          {story.sourceName} · {formatStoryTimestamp(story.publishedAt)}
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

      {story.topics && story.topics.length > 0 ? (
        <nav className="mt-2 text-sm" aria-label="Story topics">
          {story.topics.map((topic, i) => (
            <span key={topic.slug}>
              {i > 0 ? " · " : ""}
              <Link
                href={`/topics/${topic.slug}`}
                className="text-muted-foreground transition-colors hover:text-purple-500"
              >
                {topic.label}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}
    </article>
  );
}

function FeedStoryRow({
  story,
  showImage = false,
}: {
  story: CuratedStoryCard;
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
      </StoryTitleLink>

      {summary ? (
        <p className="text-muted-foreground mt-2 text-[1.03rem] leading-relaxed">
          {summary}
        </p>
      ) : null}

      {story.topics && story.topics.length > 0 ? (
        <nav className="mt-2 text-sm" aria-label="Story topics">
          {story.topics.map((topic, i) => (
            <span key={topic.slug}>
              {i > 0 ? " · " : ""}
              <Link
                href={`/topics/${topic.slug}`}
                className="text-muted-foreground transition-colors hover:text-purple-500"
              >
                {topic.label}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}
    </article>
  );
}

function SemaforRailRow({
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
        <p className="text-muted-foreground mb-1 text-[0.65rem] tracking-[0.06em] uppercase">
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

export default async function HomePage() {
  const session = await getUserSession();
  const [home, awardMatrixData] = await Promise.all([
    getCuratedHomeData({
      limit: 75,
      fallbackRaw: true,
      userId: session.userId,
    }),
    (() => {
      const end = new Date();
      const start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - 6);
      return getAwardMatrixData({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
    })(),
  ]);

  const now = dateFormatter.format(new Date());

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

        {home.stories.length === 0 ? (
          <p className="news-divider-list news-divider-item px-1 text-base text-muted-foreground">
            Today&apos;s briefing is being prepared. Check back shortly.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-10">
              <section aria-labelledby="lead-heading">
                <div className="news-divider-list news-divider-list-no-top">
                  <LeadStory story={home.stories[0]} />
                </div>
              </section>

              <HomeAwardMatrixChart data={awardMatrixData} />

              <div className="news-divider-list news-divider-list-no-top">
                {home.stories.slice(1).map((story, index) => (
                  <FeedStoryRow
                    key={story.clusterKey}
                    story={story}
                    showImage={index < 3}
                  />
                ))}
              </div>

            </div>

            <StandardRightRail>
              {home.semaforRail.length > 0 ? (
                <div className="news-divider-list news-divider-list-no-top">
                  {home.semaforRail.map((story, index) => (
                    <SemaforRailRow
                      key={story.clusterKey}
                      story={story}
                      showImage={index === 0}
                    />
                  ))}
                </div>
              ) : null}
            </StandardRightRail>
          </div>
        )}
      </div>
    </main>
  );
}
