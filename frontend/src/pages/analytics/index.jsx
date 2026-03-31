import React from "react";

export const analyticsPageMeta = {
  eyebrow: "Portfolio Analytics",
  title: "Track the signals shaping portfolio momentum.",
  description:
    "Surface performance trends, rebalance pressure, and concentration changes from a single control surface designed for high-frequency review.",
  metrics: [
    { label: "Net Return", value: "+12.8%", detail: "Quarter to date" },
    { label: "Risk Drift", value: "1.9 pts", detail: "Within target band" },
    { label: "Coverage", value: "148 assets", detail: "Across 12 sectors" },
  ],
};

export const analyticsActivityFeed = [
  "Exposure model refreshed 4 minutes ago",
  "Regional allocation moved +2.4% into APAC",
  "Variance alert triggered for fixed income sleeve",
];

export default function AnalyticsPage({
  label,
  meta,
  activityFeed,
  isLoggedIn,
}) {
  return (
    <>
      <section className="hero-panel">
        <p className="eyebrow">{meta.eyebrow}</p>
        <div className="hero-heading-row">
          <div>
            <h1>{meta.title}</h1>
            <p className="hero-copy">{meta.description}</p>
          </div>
          <div className="hero-status-card">
            <span>Session</span>
            <strong>
              {isLoggedIn
                ? "Ready for live portfolio review"
                : "Preview mode only"}
            </strong>
            <p>
              {isLoggedIn
                ? "Navigation, portfolio surfaces, and assistant tools are unlocked."
                : "Use guest mode to inspect layout before wiring real auth."}
            </p>
          </div>
        </div>

        <div className="hero-metrics">
          {meta.metrics.map((metric) => (
            <article key={metric.label} className="hero-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="feature-card spotlight-card">
          <p className="eyebrow">Breadcrumb Entry</p>
          <h2>{label}</h2>
          <p>
            This first analytics page now lives under
            `src/pages/analytics/index.jsx`, keeping the top-level app shell lean
            while the page content evolves independently.
          </p>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>Live Activity</span>
            <strong>{label}</strong>
          </div>
          <div className="activity-list">
            {activityFeed.map((item) => (
              <div key={item} className="activity-item">
                <span className="activity-dot" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
