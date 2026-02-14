import {ChevronLeft} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {ContinuousStoryFeed} from '@/components/aggregator/continuous-story-feed'
import {EvidenceBlockList} from '@/components/editorial/evidence-block-list'
import {SourceLinkList} from '@/components/editorial/source-link-list'
import {StoryBriefingHeader} from '@/components/editorial/story-briefing-header'
import {StoryNewsFeed} from '@/components/editorial/story-news-feed'
import {Button} from '@/components/ui/button'
import {getArticleListForApi} from '@/lib/articles/server'
import {getCuratedStoryDetail} from '@/lib/editorial/ui-server'

type StoryPageProps = {
  params: Promise<{clusterKey: string}>
}

export default async function StoryPage({params}: StoryPageProps) {
  const {clusterKey} = await params

  const detail = await getCuratedStoryDetail(clusterKey, {
    offset: 0,
    limit: 12,
  })

  if (!detail) {
    notFound()
  }

  const sourceArticleIds = detail.sourceLinks.map((link) => link.articleId)
  const initialFeedStories = (
    await getArticleListForApi({
      limit: 18,
    })
  )
    .filter((story) => !sourceArticleIds.includes(story.id))
    .slice(0, 8)
  const showEvidenceTimeline = detail.totalEvidence >= 10

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[980px] p-5 md:p-8">
        <div className="mb-5">
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to front page">
            <Link href="/" title="Back to front page">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
        </div>

        <article className="mx-auto w-full max-w-[74ch] space-y-8">
          <StoryBriefingHeader detail={detail} />

          {detail.heroImageUrl ? (
            <figure className="story-prose">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.heroImageUrl} alt={detail.headline} className="story-inline-image" loading="lazy" />
            </figure>
          ) : null}

          <StoryNewsFeed blocks={detail.feedBlocks} />

          <SourceLinkList clusterKey={detail.clusterKey} links={detail.sourceLinks} />

          {showEvidenceTimeline ? (
            <EvidenceBlockList clusterKey={detail.clusterKey} initialBlocks={detail.evidence} totalEvidence={detail.totalEvidence} />
          ) : null}

          <ContinuousStoryFeed
            initialStories={initialFeedStories}
            excludeArticleIds={sourceArticleIds}
            heading="Continuous coverage"
          />
        </article>
      </div>
    </main>
  )
}
