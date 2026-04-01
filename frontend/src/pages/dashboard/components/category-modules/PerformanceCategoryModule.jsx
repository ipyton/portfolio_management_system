import React from "react";
import { BenchmarkChart, MetricCards } from "./CategoryShared";

export default function PerformanceCategoryModule({
  category,
  benchPoints,
  benchmarkPoints,
  benchmarkLabels,
}) {
  return (
    <div className="perf-layout">
      <div className="perf-cards">
        <MetricCards metrics={category.metrics} accent={category.accent} />
      </div>
      <article className="perf-chart-panel">
        <p className="perf-chart-heading">Benchmark Comparisons</p>
        <p className="perf-chart-sub" style={{ color: category.accent }}>
          Portfolio vs S&amp;P 500 — YTD cumulative return
        </p>
        <BenchmarkChart
          primary={benchPoints}
          secondary={benchmarkPoints}
          labels={benchmarkLabels}
        />
      </article>
    </div>
  );
}
