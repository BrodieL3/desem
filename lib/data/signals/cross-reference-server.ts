import {createOptionalSupabaseServerClient} from '@/lib/supabase/server'

type ArticleRow = {
  id: string
  title: string
  article_url: string
  source_name: string
  published_at: string | null
}

type ContractLinkRow = {
  article_id: string
  contract_source: string
  contract_id: string
  match_type: string
  match_confidence: number
}

export type LinkedArticle = {
  id: string
  title: string
  articleUrl: string
  sourceName: string
  publishedAt: string | null
  matchType: string
  matchConfidence: number
}

export type LinkedContract = {
  contractSource: string
  contractId: string
  matchType: string
  matchConfidence: number
}

export async function getRelatedArticlesForContract(
  contractSource: string,
  contractId: string,
  limit = 5
): Promise<LinkedArticle[]> {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return []
  }

  const {data: linkRows} = await supabase
    .from('article_contract_links')
    .select('article_id, match_type, match_confidence')
    .eq('contract_source', contractSource)
    .eq('contract_id', contractId)
    .order('match_confidence', {ascending: false})
    .limit(limit)
    .returns<Array<{article_id: string; match_type: string; match_confidence: number}>>()

  if (!linkRows || linkRows.length === 0) {
    return []
  }

  const articleIds = linkRows.map((row) => row.article_id)
  const {data: articleRows} = await supabase
    .from('ingested_articles')
    .select('id, title, article_url, source_name, published_at')
    .in('id', articleIds)
    .returns<ArticleRow[]>()

  const articleMap = new Map((articleRows ?? []).map((row) => [row.id, row]))
  const linkMap = new Map(linkRows.map((row) => [row.article_id, row]))

  return articleIds
    .map((id) => {
      const article = articleMap.get(id)
      const link = linkMap.get(id)

      if (!article || !link) {
        return null
      }

      return {
        id: article.id,
        title: article.title,
        articleUrl: article.article_url,
        sourceName: article.source_name,
        publishedAt: article.published_at,
        matchType: link.match_type,
        matchConfidence: link.match_confidence,
      }
    })
    .filter((item): item is LinkedArticle => item !== null)
}

export async function getLinkedContractsForArticle(articleId: string): Promise<LinkedContract[]> {
  const supabase = await createOptionalSupabaseServerClient()

  if (!supabase) {
    return []
  }

  const {data: linkRows} = await supabase
    .from('article_contract_links')
    .select('contract_source, contract_id, match_type, match_confidence')
    .eq('article_id', articleId)
    .order('match_confidence', {ascending: false})
    .limit(10)
    .returns<ContractLinkRow[]>()

  return (linkRows ?? []).map((row) => ({
    contractSource: row.contract_source,
    contractId: row.contract_id,
    matchType: row.match_type,
    matchConfidence: row.match_confidence,
  }))
}
