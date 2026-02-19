import {describe, expect, it} from 'bun:test'

import {extractArticleContentFromHtml} from './extract-article-content'

function makeSemaforHtml() {
  const payload = {
    article: {
      intro: null,
      description: [
        {
          _type: 'block',
          children: [
            {
              _type: 'span',
              text: 'A concise summary introduces the update and frames why the policy shift matters for regional security planning.',
            },
          ],
        },
      ],
      semaforms: [
        {
          _type: 'scoop',
          title: 'The News',
          scoop: [
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Officials said the talks resumed after months of backchannel outreach, with negotiators focused on de-escalation steps and verification timelines that both sides can publicly defend.',
                },
              ],
            },
            {
              _type: 'block',
              children: [
                {
                  _type: 'span',
                  text: 'Diplomats cautioned that unresolved sanctions language and inspection sequencing still pose major hurdles, but both delegations agreed to continue technical sessions next week.',
                },
              ],
            },
          ],
        },
      ],
      sematexts: null,
      signal: null,
      tragedy: null,
    },
    error: null,
    forceShowLedePhoto: false,
  }

  const nextChunk = `2d:${JSON.stringify(['$', '$L2e', null, payload])}\n`
  const encodedChunk = JSON.stringify(nextChunk)

  return `<!doctype html><html><head><meta property="og:image" content="https://img.semafor.com/example.jpg"></head><body><nav>Navigation text that should not be treated as article content.</nav><script>self.__next_f.push([1,${encodedChunk}])</script></body></html>`
}

describe('extractArticleContentFromHtml', () => {
  it('extracts Semafor article text from embedded Next flight payload', async () => {
    const html = makeSemaforHtml()
    const result = await extractArticleContentFromHtml(
      'https://www.semafor.com/article/02/13/2026/test-semafor-extraction',
      html
    )

    expect(result.contentFetchStatus).toBe('fetched')
    expect(result.wordCount).toBeGreaterThan(40)
    expect(result.fullText).toContain('The News')
    expect(result.fullText).toContain('Officials said the talks resumed')
    expect(result.fullText).not.toContain('Navigation text')
    expect(result.leadImageUrl).toBe('https://img.semafor.com/example.jpg')
  })
})
