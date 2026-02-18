import type { ReactNode } from "react";
import Link from "next/link";

import { getGprData } from "@/lib/data/signals/gpr-server";
import { getDefenseMoneyChartsData } from "@/lib/data/signals/charts-server";
import { getSemaforRailStories } from "@/lib/editorial/ui-server";
import { resolveInternalStoryHref } from "@/lib/editorial/linking";
import type { CuratedStoryCard } from "@/lib/editorial/ui-types";
import { MacroRiskCard } from "@/components/money/macro-risk-card";
import { PrimeSparklinesChart } from "@/components/money/charts/prime-sparklines-chart";

const storyTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  "Semafor Security": "Semafor",
};

function displaySourceName(name: string) {
  return SOURCE_DISPLAY_NAMES[name] ?? name;
}

function formatStoryTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return storyTimeFormatter.format(parsed);
}

function SemaforRailRow({
  story,
  showImage,
}: {
  story: CuratedStoryCard;
  showImage: boolean;
}) {
  const href = resolveInternalStoryHref({
    articleId: story.sourceLinks[0]?.articleId,
    clusterKey: story.clusterKey,
  });

  return (
    <article className="news-divider-item news-divider-item-compact px-1">
      <Link
        href={href}
        className="group block rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="text-muted-foreground mb-1 text-[0.32rem] leading-normal uppercase">
          {displaySourceName(story.sourceName)} · {formatStoryTimestamp(story.publishedAt)}
        </p>

        <h3 className="font-display text-[1.45rem] leading-tight text-foreground transition-colors group-hover:text-primary">
          {story.headline}
        </h3>

        {showImage && story.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="mt-3 h-36 w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </Link>
    </article>
  );
}

type StandardRightRailProps = {
  children?: ReactNode;
};

export async function StandardRightRail({ children }: StandardRightRailProps) {
  const [gprSummary, moneyCharts, semaforStories] = await Promise.all([
    getGprData(),
    getDefenseMoneyChartsData(),
    getSemaforRailStories(10),
  ]);

  return (
    <aside className="news-column-rule right-rail-scroll space-y-4">
      {gprSummary.latest ? (
        <div className="news-divider-list news-divider-list-no-top">
          <MacroRiskCard summary={gprSummary} />
        </div>
      ) : null}

      <PrimeSparklinesChart
        module={moneyCharts.primeSparklines}
        stale={moneyCharts.staleData.market}
      />

      {children}

      {semaforStories.length > 0 ? (
        <div className="news-divider-list news-divider-list-no-top">
          {semaforStories.map((story, index) => (
            <SemaforRailRow
              key={story.clusterKey}
              story={story}
              showImage={index === 0}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
