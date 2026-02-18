import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToFrontPageButton } from "@/components/back-to-front-page-button";
import { StoryCommentThread } from "@/components/editorial/story-comment-thread";
import {
  StoryAudioPlayer,
  type AudioStory,
} from "@/components/editorial/story-audio-player";
import { StoryBriefingHeader } from "@/components/editorial/story-briefing-header";
import { StoryNewsFeed } from "@/components/editorial/story-news-feed";
import { StandardRightRail } from "@/components/standard-right-rail";
import { resolveInternalStoryHref } from "@/lib/editorial/linking";
import type {
  CuratedStoryDetail,
  CuratedStoryCard,
} from "@/lib/editorial/ui-types";
import {
  getCuratedHomeData,
  getCuratedStoryDetail,
} from "@/lib/editorial/ui-server";
import { getCommentsForStory } from "@/lib/comments/server";
import type { ArticleComment } from "@/lib/articles/types";
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
                    className="text-muted-foreground transition-colors hover:text-purple-500"
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
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    {link.sourceName}
                  </a>
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

function SemaforSideRail({
  stories,
}: {
  stories: CuratedStoryCard[];
}) {
  if (stories.length === 0) {
    return null;
  }

  return (
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
  );
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { clusterKey } = await params;
  const session = await getUserSession();

  const [detail, briefing, comments] = await Promise.all([
    getCuratedStoryDetail(clusterKey, {
      offset: 0,
      limit: 12,
      userId: session.userId,
    }),
    getCuratedHomeData({
      limit: 24,
      userId: session.userId,
    }),
    getCommentsForStory(clusterKey, session.userId),
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

  const relatedCommentsMap = new Map<string, ArticleComment[]>();
  const relatedCommentResults = await Promise.all(
    relatedStories.map((story) =>
      getCommentsForStory(story.clusterKey, session.userId),
    ),
  );
  relatedStories.forEach((story, i) => {
    relatedCommentsMap.set(story.clusterKey, relatedCommentResults[i]);
  });
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
            <div>
              <StoryDetailSection detail={detail} />
              <div className="story-prose mt-6">
                <StoryCommentThread
                  storyKey={clusterKey}
                  isAuthenticated={session.isAuthenticated}
                  initialComments={comments}
                />
              </div>
            </div>

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
                    <div key={related.clusterKey}>
                      <StoryDetailSection detail={related} />
                      <div className="story-prose mt-6">
                        <StoryCommentThread
                          storyKey={related.clusterKey}
                          isAuthenticated={session.isAuthenticated}
                          initialComments={
                            relatedCommentsMap.get(related.clusterKey) ?? []
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <StandardRightRail>
            <SemaforSideRail stories={briefing.semaforRail} />
          </StandardRightRail>
        </div>
      </div>
    </main>
  );
}
