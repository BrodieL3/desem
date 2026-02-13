import type {EditorialArticle} from './types'

export type EditorialSourceDomain = 'article' | 'policy' | 'poll' | 'financial'

export type EditorialAdapter<TInput> = {
  domain: EditorialSourceDomain
  normalize: (input: TInput) => EditorialArticle[]
}

// Articles are the first implemented domain. Additional adapters can be registered here.
export const editorialAdapterRegistry: Partial<Record<EditorialSourceDomain, EditorialAdapter<unknown>>> = {}
