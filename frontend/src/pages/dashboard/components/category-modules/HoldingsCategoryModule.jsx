import React from "react";
import { InteractiveDonutChart, MetricCards } from "./CategoryShared";

export default function HoldingsCategoryModule({
  category,
  industryDonutSegments,
  symbolAllocationSegments,
  capitalSplitSegments,
  reportingCurrency,
}) {
  const industrySegments = Array.isArray(industryDonutSegments)
    ? industryDonutSegments.filter((item) => Number.isFinite(Number(item?.pct)) && Number(item.pct) > 0)
    : [];
  const symbolSegments = Array.isArray(symbolAllocationSegments)
    ? symbolAllocationSegments.filter((item) => Number.isFinite(Number(item?.pct)) && Number(item.pct) > 0)
    : [];
  const capitalSegments = Array.isArray(capitalSplitSegments)
    ? capitalSplitSegments.filter((item) => Number.isFinite(Number(item?.pct)) && Number(item.pct) > 0)
    : [];

  return (
    <div className="holdings-dist-layout">
      <div className="holdings-dist-cards">
        <MetricCards metrics={category.metrics} accent={category.accent} />
      </div>
      <article className="holdings-pie-panel">
        <div className="holdings-pie-grid">
          <div className="holdings-pie-card">
            <p className="perf-chart-heading">Industry Distribution</p>
            <p className="perf-chart-sub" style={{ color: category.accent }}>
              Sector breakdown by current holdings value.
            </p>
            <InteractiveDonutChart segments={industrySegments} currency={reportingCurrency} />
            <p className="holdings-pie-note">
              Shows how invested capital is spread across industries.
            </p>
          </div>
          <div className="holdings-pie-card">
            <p className="perf-chart-heading">Symbol Allocation</p>
            <p className="perf-chart-sub" style={{ color: category.accent }}>
              Position weights by symbol and market value.
            </p>
            <InteractiveDonutChart segments={symbolSegments} currency={reportingCurrency} />
            <p className="holdings-pie-note">
              Shows the allocation split among current holding symbols.
            </p>
          </div>
          <div className="holdings-pie-card">
            <p className="perf-chart-heading">Capital Deployment</p>
            <p className="perf-chart-sub" style={{ color: category.accent }}>
              Holdings share versus total portfolio value.
            </p>
            <InteractiveDonutChart segments={capitalSegments} currency={reportingCurrency} />
            <p className="holdings-pie-note">
              Shows how much of total portfolio value is currently invested.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
