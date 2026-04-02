import React from "react";
import CategoryPanel from "./CategoryPanel";

export default function MetricsSlider({
  categories,
  activeCategory,
  activeCategoryIndex,
  onPrev,
  onNext,
  onSelectCategory,
  sparkPoints,
  sparkLabels,
  benchPoints,
  benchmarkPoints,
  benchmarkLabels,
  benchmarkMeta,
  industryDonutSegments,
  symbolAllocationSegments,
  capitalSplitSegments,
  reportingCurrency,
}) {
  return (
    <section className="dashboard-metrics-slider">
      <button
        type="button"
        className="metrics-nav-btn metrics-nav-btn-left"
        onClick={onPrev}
        aria-label="Previous category"
      >
        <span className="metrics-nav-icon">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <polyline points="7.5,2 3.5,6 7.5,10" />
          </svg>
        </span>
      </button>

      <div className="metrics-slider-card">
        <div className="slider-tab-row">
          {categories.map((category) => {
            const isActive = category.id === activeCategory.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`slider-tab${isActive ? " active" : ""}`}
                style={
                  isActive
                    ? { borderColor: `${activeCategory.accent}55`, color: activeCategory.accent }
                    : undefined
                }
                onClick={() => onSelectCategory(category.id)}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="slider-heading-row">
          <div>
            <p className="slider-eyebrow" style={{ color: activeCategory.accent }}>
              {activeCategory.eyebrow}
            </p>
            <h2 className="slider-title">{activeCategory.label}</h2>
          </div>
          <div className="slider-count-row">
            <div className="slider-dots">
              {categories.map((category) => {
                const isActive = category.id === activeCategory.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`slider-dot${isActive ? " active" : ""}`}
                    style={isActive ? { background: activeCategory.accent } : undefined}
                    onClick={() => onSelectCategory(category.id)}
                    aria-label={`Go to ${category.label}`}
                  />
                );
              })}
            </div>
            <span className="slider-count">
              {String(activeCategoryIndex + 1).padStart(2, "0")} /{" "}
              {String(categories.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="slider-panel-viewport">
          <div key={activeCategory.id} className="slider-panel-motion">
            <CategoryPanel
              category={activeCategory}
              sparkPoints={sparkPoints}
              sparkLabels={sparkLabels}
              benchPoints={benchPoints}
              benchmarkPoints={benchmarkPoints}
              benchmarkLabels={benchmarkLabels}
              benchmarkMeta={benchmarkMeta}
              industryDonutSegments={industryDonutSegments}
              symbolAllocationSegments={symbolAllocationSegments}
              capitalSplitSegments={capitalSplitSegments}
              reportingCurrency={reportingCurrency}
            />
          </div>
        </div>

        <div className="slide-progress">
          <div
            className="slide-progress-bar"
            style={{
              width: `${((activeCategoryIndex + 1) / categories.length) * 100}%`,
              background: activeCategory.accent,
            }}
          />
        </div>
      </div>

      <button
        type="button"
        className="metrics-nav-btn metrics-nav-btn-right"
        onClick={onNext}
        aria-label="Next category"
      >
        <span className="metrics-nav-icon">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <polyline points="4.5,2 8.5,6 4.5,10" />
          </svg>
        </span>
      </button>
    </section>
  );
}
