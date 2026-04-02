import React from "react";
import { PnlSparkline } from "./CategoryShared";

export default function RealtimeCategoryModule({
  category,
  sparkPoints,
  sparkLabels,
}) {
  return (
    <div className="rt-layout">
      <div className="rt-metrics-grid">
        {category.metrics.map((metric, index) => (
          <article
            key={metric.key}
            className={`slide-metric rt-metric-card${index === 0 ? " is-primary" : ""}`}
            style={{ borderColor: `${category.accent}30` }}
          >
            <p className="slide-metric-label">{metric.label}</p>
            <strong
              className="slide-metric-value"
              style={{ color: metric.valueColor || category.accent }}
            >
              {metric.value}
            </strong>
            <p className="slide-metric-detail">{metric.detail}</p>
          </article>
        ))}
      </div>
      <div className="rt-spacer" aria-hidden="true" />
      <article className="rt-pnl-card">
        <div className="rt-pnl-head">
          <p className="rt-pnl-label">Today&apos;s P&amp;L</p>
          <span className="rt-pnl-value" style={{ color: category.accent }}>{category.pnl.value}</span>
          <p className="rt-pnl-detail">{category.pnl.detail}</p>
        </div>
        <div className="rt-pnl-chart">
          <PnlSparkline points={sparkPoints} labels={sparkLabels} accent={category.accent} />
        </div>
      </article>
    </div>
  );
}
