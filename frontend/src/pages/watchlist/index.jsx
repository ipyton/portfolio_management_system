import React from "react";

export const watchlistPageMeta = {
  eyebrow: "Priority Watchlist",
  title: "Keep conviction names close and fast to inspect.",
  description:
    "Review strategic holdings, event-driven names, and liquidity-sensitive positions with a focused watch surface for next actions.",
  metrics: [
    { label: "High Conviction", value: "18", detail: "Flagged by PM team" },
    { label: "Event Window", value: "7", detail: "Within 10 trading days" },
    { label: "Liquidity Watch", value: "5", detail: "Needs staged execution" },
  ],
};

export const watchlistActivityFeed = [
  "Earnings calendar synced for all watch names",
  "Three liquidity names widened beyond threshold",
  "Analyst note attached to Semiconductor basket",
];

export default function WatchlistPage({
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
            <span>Watch Mode</span>
            <strong>
              {isLoggedIn
                ? "Names and triggers are in focus"
                : "Previewing watch surface"}
            </strong>
            <p>
              {isLoggedIn
                ? "Use this lane to track event windows, liquidity conditions, and next actions."
                : "Guest mode is helpful for layout review before connecting live datasets."}
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
          <p className="eyebrow">Page Module</p>
          <h2>{label}</h2>
          <p>
            Watchlist content now lives under `src/pages/watchlist/index.jsx`,
            making it easier to turn this placeholder into a real monitored
            universe page.
          </p>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>Monitoring Feed</span>
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
