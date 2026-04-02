import React from "react";

export default function TradingCategoryModule({ category }) {
  const metrics = Array.isArray(category.metrics) ? category.metrics : [];
  const tradingNarrative = {
    turnoverRate: {
      icon: "TR",
      intro: "Shows how actively the portfolio rotates positions over the recent period.",
    },
    transactionAmount: {
      icon: "TV",
      intro: "Tracks total traded notional and reflects execution intensity.",
    },
    totalFees: {
      icon: "FE",
      intro: "Captures all transaction costs and the drag on realized returns.",
    },
    tradeCount: {
      icon: "TC",
      intro: "Represents total executed orders and operational trading frequency.",
    },
    buySellRecords: {
      icon: "BS",
      intro: "Highlights directional balance between buy and sell activity.",
    },
  };

  function renderMetricCard(metric, index) {
    const narrative = tradingNarrative[metric.key] || {
      icon: "TD",
      intro: "Summarizes trading behavior and execution quality for the selected period.",
    };
    const cardClass = `risk-kpi-card${index === 0 ? " is-primary" : ""}`;
    return (
      <article
        key={metric.key}
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
    <div className="trading-layout">
      <article className="trading-panel">
        <header className="trading-panel-head">
          <p className="perf-chart-heading">Trading Diagnostics</p>
        </header>
        <div className="trading-panel-grid">
          {metrics.map((metric, index) => renderMetricCard(metric, index))}
        </div>
      </article>
    </div>
  );
}
