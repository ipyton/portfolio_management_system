import React from "react";

export default function IntroCard({ meta, activityFeed, isLoggedIn, status }) {
  const statusHeading = status?.heading
    || (isLoggedIn ? "Workflow oversight is active" : "Previewing board");
  const statusMessage = status?.message
    || (isLoggedIn
      ? "Use this page to watch approvals, queues, and ingestion health in one place."
      : "Guest mode keeps the interface visible while live actions stay disabled.");

  // Render the reserved top introduction panel.
  return (
    <section className="hero-panel">
      <p className="eyebrow">{meta.eyebrow}</p>
      <div className="hero-heading-row">
        <div>
          <h1>{meta.title}</h1>
          <p className="hero-copy">{meta.description}</p>
        </div>
        <div className="hero-status-card">
          <span>Ops Status</span>
          <strong>{statusHeading}</strong>
          <p>{statusMessage}</p>
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
      {Array.isArray(activityFeed) && activityFeed.length > 0 && (
        <div className="activity-list" style={{ marginTop: 14 }}>
          {activityFeed.slice(0, 3).map((item, index) => (
            <div key={`${item}-${index}`} className="activity-item">
              <span className="activity-dot" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
