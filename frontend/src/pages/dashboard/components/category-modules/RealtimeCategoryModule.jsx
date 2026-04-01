import React from "react";
import { MetricCards, PnlSparkline } from "./CategoryShared";

export default function RealtimeCategoryModule({
  category,
  sparkPoints,
  sparkLabels,
}) {
  return (
    <div className="rt-layout">
      <article className="rt-pnl-card">
        <p className="rt-pnl-label">Today&apos;s P&amp;L</p>
        <span className="rt-pnl-value">{category.pnl.value}</span>
        <p className="rt-pnl-detail">{category.pnl.detail}</p>
        <PnlSparkline points={sparkPoints} labels={sparkLabels} />
      </article>
      <div className="rt-metrics-grid">
        <MetricCards metrics={category.metrics} accent={category.accent} />
      </div>
    </div>
  );
}
