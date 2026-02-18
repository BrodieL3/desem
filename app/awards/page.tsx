import {BackToFrontPageButton} from '@/components/back-to-front-page-button'
import {AwardMatrixChart} from '@/components/money/charts/award-matrix-chart'
import {StandardRightRail} from '@/components/standard-right-rail'

export default async function DataPage() {

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="editorial-shell mx-auto max-w-[1380px] p-5 md:p-8">
        <div className="mb-5">
          <BackToFrontPageButton />
        </div>

        <header className="mb-8 border-b border-border pb-6">
          <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Field Brief</p>
          <h1 className="font-display text-4xl leading-tight">Awards</h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <AwardMatrixChart />
          </div>

          <StandardRightRail />
        </div>
      </div>
    </main>
  )
}
