import React from "react";

export const dashboardPageMeta = {
  eyebrow: "Operations Dashboard",
  title: "Run the desk from one calm operational view.",
  description:
    "Monitor approvals, cash events, and workflow bottlenecks with a board that stays readable even when the day gets noisy.",
  metrics: [
    { label: "Open Tasks", value: "24", detail: "6 need review" },
    { label: "Cash Alerts", value: "3", detail: "Before market close" },
    { label: "Sync Health", value: "99.2%", detail: "Live ingestion uptime" },
  ],
};

export const dashboardActivityFeed = [
  "Custodian file matched successfully",
  "Two approvals are waiting on compliance review",
  "Settlement queue shows one exception in HK",
];

export default function DashboardPage({
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
            <span>Ops Status</span>
            <strong>
              {isLoggedIn ? "Workflow oversight is active" : "Previewing board"}
            </strong>
            <p>
              {isLoggedIn
                ? "Use this page to watch approvals, queues, and ingestion health in one place."
                : "Guest mode keeps the interface visible while live actions stay disabled."}
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
            Dashboard-specific copy and metrics are isolated inside
            `src/pages/dashboard/index.jsx`, so `App.jsx` only coordinates page
            selection and shared chrome.
          </p>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>Operational Pulse</span>
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
