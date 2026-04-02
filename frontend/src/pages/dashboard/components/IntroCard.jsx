import React from "react";
import LoadingInline from "../../../components/LoadingInline";

export default function IntroCard({ meta, activityFeed, status, scrollActivity = false }) {
  const statusHeading = String(status?.heading || "").trim();
  const statusMessage = String(status?.message || "").trim();
  const isStatusLoading = Boolean(status?.loading);
  const showStatusCard = Boolean(statusHeading || statusMessage);

  // Render the reserved top introduction panel.
  return (
    <section className="hero-panel">
      <p className="eyebrow">{meta.eyebrow}</p>
      <div className="hero-heading-row">
        <div>
          <h1>{meta.title}</h1>
          <p className="hero-copy">{meta.description}</p>
        </div>
        {showStatusCard && (
          <div className="hero-status-card">
            <strong>
              {isStatusLoading
                ? <LoadingInline label={statusHeading || "Loading"} size="xs" />
                : statusHeading}
            </strong>
            <p>{statusMessage}</p>
          </div>
        )}
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
        scrollActivity ? (
          <div className="activity-list activity-list-ticker" style={{ marginTop: 14 }}>
            <div className="activity-list-ticker-track">
              {[...activityFeed.slice(0, 3), ...activityFeed.slice(0, 3)].map((item, index) => (
                <div key={`${item}-${index}`} className="activity-item">
                  <span className="activity-dot" />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="activity-list" style={{ marginTop: 14 }}>
            {activityFeed.slice(0, 3).map((item, index) => (
              <div key={`${item}-${index}`} className="activity-item">
                <span className="activity-dot" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        )
      )}
    </section>
  );
}
