import React from "react";

export default function RiskCategoryModule({ category }) {
  const metrics = Array.isArray(category.metrics) ? category.metrics : [];
  const riskNarrative = {
    annualizedVolatility: {
      icon: "VOL",
      intro: "Shows typical return fluctuation, where higher values imply a less stable portfolio path.",
    },
    maxDrawdown: {
      icon: "MDD",
      intro: "Captures the deepest historical drop and highlights downside resilience under stress.",
    },
    sharpeRatio: {
      icon: "SR",
      intro: "Measures return per unit of risk, with higher values indicating better risk efficiency.",
    },
    beta: {
      icon: "B",
      intro: "Indicates benchmark sensitivity, where values above 1 mean more aggressive market exposure.",
    },
    alpha: {
      icon: "A",
      intro: "Estimates active excess return after market adjustment, with positive values showing value add.",
    },
    riskFreeRate: {
      icon: "RF",
      intro: "Defines the baseline hurdle rate used by risk-adjusted metrics such as Sharpe and Alpha.",
    },
  };

  function renderMetricCard(metric, index, scope) {
    const narrative = riskNarrative[metric.key] || {
      icon: "R",
      intro: "Tracks structural risk changes and should be evaluated with other risk indicators together.",
    };
    const cardClass = `risk-kpi-card${index === 0 ? " is-primary" : ""}`;
    return (
      <article
        key={`${scope}-${metric.key}`}
        className={cardClass}
        style={{ borderColor: `${category.accent}30` }}
      >
        <div className="risk-kpi-data">
          <div className="risk-kpi-head">
            <span className="risk-kpi-icon" style={{ color: category.accent }}>
              {narrative.icon}
            </span>
            <p className="risk-kpi-title">{metric.label}</p>
          </div>
          <strong className="risk-kpi-value" style={{ color: category.accent }}>
            {metric.value}
          </strong>
          <p className="risk-kpi-meta">{metric.detail}</p>
        </div>
        <div className="risk-kpi-intro">
          <p>{narrative.intro}</p>
        </div>
      </article>
    );
  }

  return (
    <div className="risk-layout">
      <article className="risk-panel">
        <header className="risk-panel-head">
          <p className="perf-chart-heading">Risk Diagnostics</p>
        </header>
        <div className="risk-panel-grid">
          {metrics.map((metric, index) => renderMetricCard(metric, index, "grid"))}
        </div>
      </article>
    </div>
  );
}
