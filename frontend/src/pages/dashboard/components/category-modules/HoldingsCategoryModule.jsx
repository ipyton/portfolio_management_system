import React from "react";
import { DonutChart, MetricCards } from "./CategoryShared";

export default function HoldingsCategoryModule({ category, donutSegments }) {
  const legendItems = Array.isArray(donutSegments)
    ? donutSegments.filter((item) => Number.isFinite(Number(item?.pct)) && Number(item.pct) > 0)
    : [];

  function formatLegendPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "N/A";
    }
    const rounded = Number(numeric.toFixed(2));
    const digits = Number.isInteger(rounded) ? 0 : 1;
    return `${rounded.toFixed(digits)}%`;
  }

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
        <div className="holdings-pie-content">
          <div className="holdings-pie-chart-wrap">
            <DonutChart segments={donutSegments} />
          </div>
          <ul className="holdings-pie-legend">
            {legendItems.map((item, index) => (
              <li className="holdings-pie-legend-item" key={`${item.label || "segment"}-${index}`}>
                <span
                  className="holdings-pie-legend-swatch"
                  style={{ backgroundColor: item.color || category.accent }}
                  aria-hidden="true"
                />
                <span className="holdings-pie-legend-label" title={item.label || "Unknown"}>
                  {item.label || "Unknown"}
                </span>
                <span className="holdings-pie-legend-value">
                  {formatLegendPercent(item.pct)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}
