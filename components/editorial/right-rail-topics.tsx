import Link from 'next/link'

import type {CuratedHomeForYouTopic} from '@/lib/editorial/ui-types'
import {SectionLabel} from '@/components/editorial/section-label'

type RightRailTopicsProps = {
  topics: CuratedHomeForYouTopic[]
  title?: string
}

export function RightRailTopics({topics, title = 'Topics'}: RightRailTopicsProps) {
  if (topics.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="right-rail-topics-heading" className="space-y-2">
      <SectionLabel id="right-rail-topics-heading">
        {title}
      </SectionLabel>
      <div className="news-divider-list news-divider-list-no-top">
        {topics.map((topic) => (
          <div key={topic.id} className="news-divider-item news-divider-item-compact flex min-h-11 items-center justify-between gap-2 px-1">
            <Link href={`/topics/${topic.slug}`} className="text-sm font-medium hover:text-primary">
              {topic.label}
            </Link>
            <span className="text-muted-foreground text-xs">{topic.articleCount}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
