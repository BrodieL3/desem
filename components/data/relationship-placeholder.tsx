import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'

export function RelationshipPlaceholder() {
  return (
    <Card className="rounded-lg border border-border bg-card">
      <CardHeader>
        <CardTitle className="font-display text-[1.9rem] leading-tight">Prime relationship network (planned)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          This module will map verified teaming, joint venture, and subcontract relationships once explicit relationship-event extraction is online.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Primary source: official filing/disclosure evidence with direct citation links.</li>
          <li>Event types: teaming, joint venture, subcontract, supplier.</li>
          <li>Confidence model: candidate -&gt; verified -&gt; rejected.</li>
        </ul>
      </CardContent>
    </Card>
  )
}
