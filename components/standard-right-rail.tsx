import type { ReactNode } from "react";

import { getGprData } from "@/lib/data/signals/gpr-server";
import { getDefenseMoneyChartsData } from "@/lib/data/signals/charts-server";
import { MacroRiskCard } from "@/components/money/macro-risk-card";
import { PrimeSparklinesChart } from "@/components/money/charts/prime-sparklines-chart";

type StandardRightRailProps = {
  children?: ReactNode;
};

export async function StandardRightRail({ children }: StandardRightRailProps) {
  const [gprSummary, moneyCharts] = await Promise.all([
    getGprData(),
    getDefenseMoneyChartsData(),
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
    </aside>
  );
}
