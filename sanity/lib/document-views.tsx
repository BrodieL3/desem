import type {UserViewComponent} from 'sanity/structure'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function formatBoolean(value: boolean | null): string {
  if (value === null) return 'Unknown'
  return value ? 'Yes' : 'No'
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        border: '1px solid var(--card-border-color, #d3d6db)',
        borderRadius: '6px',
        padding: '10px 12px',
      }}
    >
      <div style={{fontSize: '12px', opacity: 0.72}}>{label}</div>
      <div style={{fontSize: '14px', fontWeight: 600, marginTop: '4px'}}>{value}</div>
    </div>
  )
}

export const VerificationSummaryView: UserViewComponent = (props) => {
  const doc = asRecord(props.document?.displayed)
  const schemaType = asString(doc?._type)

  if (!doc || !schemaType) {
    return (
      <div style={{padding: '16px'}}>
        <p style={{margin: 0}}>No displayed document state is available for verification.</p>
      </div>
    )
  }

  if (schemaType === 'storyDigest') {
    const generatedAt = asString(doc.generatedAt) ?? 'Unknown'
    const reviewStatus = asString(doc.reviewStatus) ?? 'needs_review'
    const generationMode = asString(doc.generationMode) ?? 'deterministic'
    const transformStatus = asString(doc.transformStatus) ?? 'unknown'
    const citationCount = asNumber(doc.citationCount)
    const sourceDiversity = asNumber(doc.sourceDiversity)
    const hasOfficialSource = asBoolean(doc.hasOfficialSource)
    const isCongestedCluster = asBoolean(doc.isCongestedCluster)

    return (
      <div style={{padding: '16px', display: 'grid', gap: '12px'}}>
        <p style={{margin: 0}}>
          Verify citation balance and status signals before moving this digest to published.
        </p>
        <div style={{display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))'}}>
          <Metric label="Review Status" value={reviewStatus} />
          <Metric label="Generation Mode" value={generationMode} />
          <Metric label="Transform Status" value={transformStatus} />
          <Metric label="Citations" value={citationCount === null ? 'Unknown' : String(citationCount)} />
          <Metric label="Source Diversity" value={sourceDiversity === null ? 'Unknown' : String(sourceDiversity)} />
          <Metric label="Has Official Source" value={formatBoolean(hasOfficialSource)} />
          <Metric label="Congested Cluster" value={formatBoolean(isCongestedCluster)} />
          <Metric label="Generated At" value={generatedAt} />
        </div>
      </div>
    )
  }

  if (schemaType === 'newsItem') {
    const sourceName = asString(doc.sourceName) ?? 'Unknown'
    const sourceCategory = asString(doc.sourceCategory) ?? 'Unknown'
    const sourceBadge = asString(doc.sourceBadge) ?? 'Unknown'
    const contentFetchStatus = asString(doc.contentFetchStatus) ?? 'Unknown'
    const readingMinutes = asNumber(doc.readingMinutes)
    const publishedAt = asString(doc.publishedAt) ?? 'Unknown'
    const isCongestedCluster = asBoolean(doc.isCongestedCluster)

    return (
      <div style={{padding: '16px', display: 'grid', gap: '12px'}}>
        <p style={{margin: 0}}>
          Use this pane to quickly validate evidence quality and source metadata before relying on this article in a
          digest.
        </p>
        <div style={{display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))'}}>
          <Metric label="Source Name" value={sourceName} />
          <Metric label="Source Category" value={sourceCategory} />
          <Metric label="Source Badge" value={sourceBadge} />
          <Metric label="Content Fetch Status" value={contentFetchStatus} />
          <Metric label="Reading Minutes" value={readingMinutes === null ? 'Unknown' : String(readingMinutes)} />
          <Metric label="Published At" value={publishedAt} />
          <Metric label="Congested Cluster" value={formatBoolean(isCongestedCluster)} />
        </div>
      </div>
    )
  }

  return (
    <div style={{padding: '16px'}}>
      <p style={{margin: 0}}>Verification summary is configured for storyDigest and newsItem documents.</p>
    </div>
  )
}

export const JsonDocumentView: UserViewComponent = (props) => {
  return (
    <div style={{padding: '16px'}}>
      <p style={{marginTop: 0}}>Displayed document snapshot</p>
      <pre
        style={{
          margin: 0,
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'auto',
          border: '1px solid var(--card-border-color, #d3d6db)',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        {JSON.stringify(props.document?.displayed ?? null, null, 2)}
      </pre>
    </div>
  )
}
