import React, { useState } from "react";

export default function WatchlistList({
  rows,
  selectedSymbol,
  onSelect,
  activeTab,
  onTabChange,
  showRankings,
  onToggleRankings,
  rankingMetric,
  onRankingMetricChange,
  rankingOrder,
  onRankingOrderChange,
  rankingHorizon,
  onRankingHorizonChange,
  showBondTab,
}) {
  const [openReturnSymbol, setOpenReturnSymbol] = useState(null);

  return (
    <section className="watchlist-panel">
      <nav className="watchlist-tabs">
        <button
          className={activeTab === "all" ? "active" : ""}
          type="button"
          onClick={() => onTabChange("all")}
        >
          All
        </button>
        <button
          className={activeTab === "holdings" ? "active" : ""}
          type="button"
          onClick={() => onTabChange("holdings")}
        >
          Holdings
        </button>
        <button
          className={activeTab === "favourites" ? "active" : ""}
          type="button"
          onClick={() => onTabChange("favourites")}
        >
          Favourites
        </button>
        <button
          className={activeTab === "stocks" ? "active" : ""}
          type="button"
          onClick={() => onTabChange("stocks")}
        >
          Stocks
        </button>
        {showBondTab && (
          <button
            className={activeTab === "bonds" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("bonds")}
          >
            Bonds
          </button>
        )}
        <button
          className={`tab-spacer ranking-button${showRankings ? " active" : ""}`}
          type="button"
          onClick={onToggleRankings}
        >
          Rankings <span className="caret">▾</span>
        </button>
      </nav>

      {showRankings && (
        <div className="ranking-menus">
          <div className="ranking-menu">
            <button
              type="button"
              className={rankingMetric === "return" ? "active" : ""}
              onClick={() => onRankingMetricChange("return")}
            >
              Return
            </button>
            <button
              type="button"
              className={rankingMetric === "sharpe" ? "active" : ""}
              onClick={() => onRankingMetricChange("sharpe")}
            >
              Sharp Ratio
            </button>
            <button
              type="button"
              className={rankingMetric === "popularity" ? "active" : ""}
              onClick={() => onRankingMetricChange("popularity")}
            >
              Popularity
            </button>
            <button
              type="button"
              className={rankingMetric === "sales" ? "active" : ""}
              onClick={() => onRankingMetricChange("sales")}
            >
              Sales Volume
            </button>
            <button
              type="button"
              className={rankingMetric === "drawdown" ? "active" : ""}
              onClick={() => onRankingMetricChange("drawdown")}
            >
              Max Drawdown
            </button>
            <button
              type="button"
              className={rankingMetric === "horizon" ? "active" : ""}
              onClick={() => onRankingMetricChange("horizon")}
            >
              Investment Horizon
            </button>
          </div>

          <div className="ranking-menu">
            <button
              type="button"
              className={rankingOrder === "asc" ? "active" : ""}
              onClick={() => onRankingOrderChange("asc")}
            >
              Low to High
            </button>
            <button
              type="button"
              className={rankingOrder === "desc" ? "active" : ""}
              onClick={() => onRankingOrderChange("desc")}
            >
              High to Low
            </button>
          </div>

          <div className="ranking-menu">
            {["1 Month", "3 Months", "6 Months", "1 Year", "3 Years"].map(
              (label) => (
                <button
                  key={label}
                  type="button"
                  className={rankingHorizon === label ? "active" : ""}
                  onClick={() => onRankingHorizonChange(label)}
                >
                  {label}
                </button>
              )
            )}
          </div>

          <div className="ranking-actions">
            <button type="button" onClick={onToggleRankings}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="watchlist-table">
        {rows.length === 0 ? (
          <div className="watchlist-row placeholder">
            <div>
              <strong className="ticker">No matched symbols</strong>
              <div className="metric">Try another tab or search keyword.</div>
            </div>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.symbol} className="watchlist-row-group">
              <div
                role="button"
                tabIndex={0}
                className={`watchlist-row${
                  row.symbol === selectedSymbol ? " selected" : ""
                }`}
                onClick={() => onSelect(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    onSelect(row);
                  }
                }}
              >
                <div>
                  <strong className="ticker">{row.symbol}</strong>
                  <button
                    type="button"
                    className="metric metric-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenReturnSymbol((current) =>
                        current === row.symbol ? null : row.symbol,
                      );
                    }}
                  >
                    {row.returnPct} Return
                  </button>
                </div>
                <div>
                  <div className="metric">{row.cadence}</div>
                  <div className="metric">Sharp Ratio: {row.sharpe}</div>
                </div>
              </div>
              {openReturnSymbol === row.symbol && (
                <div className="return-box">
                  {Object.entries(row.returns || {}).map(([label, value]) => (
                    <div key={label} className="return-pill">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
