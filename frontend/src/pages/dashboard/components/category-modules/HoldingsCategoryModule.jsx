import React from "react";
import { DonutChart, MetricCards } from "./CategoryShared";

export default function HoldingsCategoryModule({ category, donutSegments }) {
  return (
    <div className="holdings-dist-layout">
      <div className="holdings-dist-cards">
        <MetricCards metrics={category.metrics} accent={category.accent} />
      </div>
      <article className="holdings-pie-panel">
        <p className="perf-chart-heading">Industry Distribution</p>
        <p className="perf-chart-sub" style={{ color: category.accent }}>
          Sector breakdown by portfolio allocation
        </p>
        <DonutChart segments={donutSegments} />
      </article>
    </div>
  );
}
