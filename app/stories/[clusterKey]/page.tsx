import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToFrontPageButton } from "@/components/back-to-front-page-button";
import { RightRailTopics } from "@/components/editorial/right-rail-topics";
import { SectionLabel } from "@/components/editorial/section-label";
import {
  StoryAudioPlayer,
  type AudioStory,
} from "@/components/editorial/story-audio-player";
import { StoryBriefingHeader } from "@/components/editorial/story-briefing-header";
import { StoryNewsFeed } from "@/components/editorial/story-news-feed";
import { PrimeSparklinesChart } from "@/components/money/charts/prime-sparklines-chart";
import { getDefenseMoneyChartsData } from "@/lib/data/signals/charts-server";
import { resolveInternalStoryHref } from "@/lib/editorial/linking";
import type {
  CuratedStoryDetail,
  CuratedHomeForYouRail,
  CuratedStoryCard,
} from "@/lib/editorial/ui-types";
import {
  getCuratedHomeData,
  getCuratedStoryDetail,
} from "@/lib/editorial/ui-server";
import { getUserSession } from "@/lib/user/session";

function storyToAudioEntry(detail: CuratedStoryDetail): AudioStory {
  const parts = [detail.headline];
  if (detail.dek.trim()) parts.push(detail.dek.trim());
  for (const block of detail.feedBlocks) {
    if (block.body.trim()) parts.push(block.body.trim());
  }
  return {
    clusterKey: detail.clusterKey,
    headline: detail.headline,
    text: parts.join(".\n\n"),
  };
}

type StoryPageProps = {
  params: Promise<{ clusterKey: string }>;
};

function StoryDetailSection({ detail }: { detail: CuratedStoryDetail }) {
  return (
    <article className="story-prose space-y-5">
      <StoryBriefingHeader detail={detail} />

      {detail.heroImageUrl ? (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={detail.heroImageUrl}
            alt={detail.headline}
            className="story-inline-image"
            loading="lazy"
          />
        </figure>
      ) : null}

      <StoryNewsFeed blocks={detail.feedBlocks} />

      {detail.topics.length > 0 || detail.sourceLinks.length > 0 ? (
        <footer className="space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
          {detail.topics.length > 0 ? (
            <nav aria-label="Topics in this story">
              {detail.topics.map((topic, i) => (
                <span key={topic.id}>
                  {i > 0 ? " · " : ""}
                  <Link
                    href={`/topics/${topic.slug}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {topic.label}
                  </Link>
                </span>
              ))}
            </nav>
          ) : null}

          {detail.sourceLinks.length > 0 ? (
            <nav aria-label="Sources in this story">
              {detail.sourceLinks.map((link, i) => (
                <span key={`${link.articleId}-${link.url}`}>
                  {i > 0 ? " · " : ""}
                  <Link
                    href={resolveInternalStoryHref({
                      articleId: link.articleId,
                      clusterKey: detail.clusterKey,
                    })}
                    className="hover:text-foreground transition-colors"
                  >
                    {link.sourceName}
                  </Link>
                </span>
              ))}
            </nav>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function countSharedTopics(
  primary: CuratedStoryDetail,
  candidate: CuratedStoryDetail,
) {
  const primaryTopicIds = new Set(primary.topics.map((topic) => topic.id));
  let sharedCount = 0;

  for (const topic of candidate.topics) {
    if (primaryTopicIds.has(topic.id)) {
      sharedCount += 1;
    }
  }

  return sharedCount;
}

function ForYouSideRail({
  rail,
  isAuthenticated,
  stories,
}: {
  rail: CuratedHomeForYouRail;
  isAuthenticated: boolean;
  stories: CuratedStoryCard[];
}) {
  return (
    <>
      <section className="space-y-4" aria-labelledby="story-for-you-heading">
        <SectionLabel id="story-for-you-heading">{rail.title}</SectionLabel>

        {rail.notice ? (
          <p className="text-muted-foreground text-sm">{rail.notice}</p>
        ) : null}

        <RightRailTopics
          topics={rail.topics}
          title="Topic actions"
          headingId="story-for-you-topic-actions-heading"
          collapsedMax={3}
          showFollowActions
          isAuthenticated={isAuthenticated}
        />
      </section>

      {stories.length > 0 ? (
        <div className="news-divider-list news-divider-list-no-top">
          {stories.map((story) => (
            <article
              key={story.clusterKey}
              className="news-divider-item news-divider-item-compact px-1"
            >
              <Link
                href={resolveInternalStoryHref({
                  articleId: story.sourceLinks[0]?.articleId,
                  clusterKey: story.clusterKey,
                })}
                className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-muted-foreground mb-1 text-xs tracking-[0.12em] uppercase">
                  {story.sourceName}
                </p>
                <h3 className="font-display text-[1.45rem] leading-tight text-foreground transition-colors group-hover:text-primary">
                  {story.headline}
                </h3>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Personalized stories will appear here as you follow topics.
        </p>
      )}
    </>
  );
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { clusterKey } = await params;
  const session = await getUserSession();

  const [detail, briefing, moneyCharts] = await Promise.all([
    getCuratedStoryDetail(clusterKey, {
      offset: 0,
      limit: 12,
      userId: session.userId,
    }),
    getCuratedHomeData({
      limit: 24,
      userId: session.userId,
    }),
    getDefenseMoneyChartsData(),
  ]);

  if (!detail) {
    notFound();
  }

  const relatedClusterKeys = briefing.stories
    .map((story) => story.clusterKey)
    .filter((key) => key !== clusterKey);
  const relatedStoryResults = await Promise.all(
    relatedClusterKeys.map((key) =>
      getCuratedStoryDetail(key, {
        offset: 0,
        limit: 12,
        userId: session.userId,
      }),
    ),
  );
  const relatedStories = relatedStoryResults.filter(
    (story): story is CuratedStoryDetail => Boolean(story),
  );
  const sortedRelatedStories = relatedStories
    .map((story, index) => ({
      story,
      index,
      sharedTopics: countSharedTopics(detail, story),
    }))
    .sort(
      (left, right) =>
        right.sharedTopics - left.sharedTopics || left.index - right.index,
    )
    .map((entry) => entry.story);

  const audioStories: AudioStory[] = [
    storyToAudioEntry(detail),
    ...sortedRelatedStories.map(storyToAudioEntry),
  ];

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1320px] p-5 md:p-8">
        <div className="mb-5">
          <BackToFrontPageButton />
        </div>

        <StoryAudioPlayer stories={audioStories} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-16">
            <StoryDetailSection detail={detail} />

            {sortedRelatedStories.length > 0 ? (
              <section
                className="story-prose space-y-8 border-t border-border pt-8"
                aria-labelledby="related-stories-heading"
              >
                <div className="space-y-2">
                  <h2
                    id="related-stories-heading"
                    className="font-display text-[2rem] leading-tight"
                  >
                    Related stories
                  </h2>
                  <nav aria-label="Related story links">
                    <ul className="space-y-1">
                      {sortedRelatedStories.slice(0, 5).map((related) => (
                        <li key={related.clusterKey}>
                          <Link
                            href={`/stories/${related.clusterKey}`}
                            className="news-divider-item block px-1 transition-colors hover:text-primary"
                          >
                            {related.headline}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                  <p className="text-muted-foreground text-sm">
                    Scroll to continue through the full briefing feed.
                  </p>
                </div>

                <div className="space-y-16">
                  {sortedRelatedStories.map((related) => (
                    <StoryDetailSection
                      key={related.clusterKey}
                      detail={related}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="news-column-rule right-rail-scroll space-y-4">
            {briefing.forYou ? (
              <ForYouSideRail
                rail={briefing.forYou}
                isAuthenticated={session.isAuthenticated}
                stories={briefing.forYou.stories}
              />
            ) : null}

            <PrimeSparklinesChart
              module={moneyCharts.primeSparklines}
              stale={moneyCharts.staleData.market}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
