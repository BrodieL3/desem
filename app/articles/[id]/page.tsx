import {redirect} from 'next/navigation'

type LegacyArticlePageProps = {
  params: Promise<{id: string}>
}

export default async function LegacyArticlePage({params}: LegacyArticlePageProps) {
  const {id} = await params
  redirect(`/stories/article/${encodeURIComponent(id)}`)
}
