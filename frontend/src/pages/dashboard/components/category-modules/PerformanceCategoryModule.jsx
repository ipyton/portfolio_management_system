import React from "react";
import { BenchmarkChart } from "./CategoryShared";

export default function PerformanceCategoryModule({
  category,
  benchPoints,
  benchmarkPoints,
  benchmarkLabels,
  benchmarkMeta,
}) {
  const benchmarkName = benchmarkMeta?.name || benchmarkMeta?.symbol || "Benchmark";
  const hasBenchmarkChart = Boolean(benchmarkMeta?.hasData);
  const normalizedBenchmarkSymbol = String(benchmarkMeta?.symbol || "").toUpperCase();
  const normalizedBenchmarkName = String(benchmarkName || "").toUpperCase();
  const isSp500Benchmark = normalizedBenchmarkSymbol === "SPX"
    || normalizedBenchmarkSymbol === "^GSPC"
    || normalizedBenchmarkName.includes("S&P 500")
    || normalizedBenchmarkName.includes("SP 500");

  return (
    <div className="perf-layout">
      <div className="perf-metrics-grid">
        {category.metrics.map((metric, index) => (
          <article
            key={metric.key}
            className={`slide-metric perf-metric-card${index === 0 ? " is-primary" : ""}`}
            style={{ borderColor: `${category.accent}30` }}
          >
            <p className="slide-metric-label">{metric.label}</p>
            <strong className="slide-metric-value" style={{ color: category.accent }}>
              {metric.value}
            </strong>
            <p className="slide-metric-detail">{metric.detail}</p>
          </article>
        ))}
      </div>
      <article className="perf-chart-panel">
        <p className="perf-chart-heading">Benchmark Comparisons</p>
        <p className="perf-chart-sub" style={{ color: category.accent }}>
          {hasBenchmarkChart
            ? `Portfolio vs ${benchmarkName} — Cumulative return`
            : "No comparable benchmark data for current holdings"}
        </p>
        {hasBenchmarkChart && (
          <p className={`perf-benchmark-badge${isSp500Benchmark ? " is-sp500" : ""}`}>
            {isSp500Benchmark
              ? "Benchmark: S&P 500"
              : `Benchmark: ${benchmarkMeta?.symbol || benchmarkName}`}
          </p>
        )}
        <BenchmarkChart
          primary={benchPoints}
          secondary={benchmarkPoints}
          labels={benchmarkLabels}
        />
      </article>
    </div>
  );
}
