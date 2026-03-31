import React, { useState } from "react";

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

const watchlistRows = [
  {
    symbol: "APPL",
    type: "Stock",
    isHolding: true,
    isFavourite: true,
    popularity: 92,
    salesVolume: 780,
    horizonMonths: 1,
    returnPct: "3.5%",
    cadence: "Trade Everyday",
    sharpe: "1%",
    horizon: "Everyday",
    drawdown: "10%",
  },
  {
    symbol: "MSFT",
    type: "Stock",
    isHolding: true,
    isFavourite: false,
    popularity: 88,
    salesVolume: 640,
    horizonMonths: 3,
    returnPct: "2.1%",
    cadence: "Trade Weekly",
    sharpe: "0.8%",
    horizon: "Weekly",
    drawdown: "8%",
  },
  {
    symbol: "NVDA",
    type: "Stock",
    isHolding: false,
    isFavourite: true,
    popularity: 95,
    salesVolume: 920,
    horizonMonths: 6,
    returnPct: "4.4%",
    cadence: "Trade Weekly",
    sharpe: "1.3%",
    horizon: "Weekly",
    drawdown: "12%",
  },
  {
    symbol: "JPM",
    type: "Stock",
    isHolding: false,
    isFavourite: false,
    popularity: 70,
    salesVolume: 410,
    horizonMonths: 12,
    returnPct: "1.6%",
    cadence: "Trade Monthly",
    sharpe: "0.7%",
    horizon: "Monthly",
    drawdown: "6%",
  },
  {
    symbol: "TLT",
    type: "Bond",
    isHolding: true,
    isFavourite: false,
    popularity: 65,
    salesVolume: 280,
    horizonMonths: 12,
    returnPct: "0.9%",
    cadence: "Trade Monthly",
    sharpe: "0.4%",
    horizon: "Monthly",
    drawdown: "5%",
  },
  {
    symbol: "IEF",
    type: "Bond",
    isHolding: false,
    isFavourite: true,
    popularity: 60,
    salesVolume: 240,
    horizonMonths: 36,
    returnPct: "0.6%",
    cadence: "Trade Monthly",
    sharpe: "0.3%",
    horizon: "Monthly",
    drawdown: "3%",
  },
  {
    symbol: "LQD",
    type: "Bond",
    isHolding: true,
    isFavourite: true,
    popularity: 72,
    salesVolume: 310,
    horizonMonths: 12,
    returnPct: "0.8%",
    cadence: "Trade Monthly",
    sharpe: "0.5%",
    horizon: "Monthly",
    drawdown: "4%",
  },
  {
    symbol: "BND",
    type: "Bond",
    isHolding: false,
    isFavourite: false,
    popularity: 58,
    salesVolume: 260,
    horizonMonths: 36,
    returnPct: "0.7%",
    cadence: "Trade Monthly",
    sharpe: "0.4%",
    horizon: "Monthly",
    drawdown: "3%",
  },
  {
    symbol: "SPY",
    type: "Stock",
    isHolding: true,
    isFavourite: false,
    popularity: 90,
    salesVolume: 860,
    horizonMonths: 6,
    returnPct: "1.9%",
    cadence: "Trade Weekly",
    sharpe: "0.9%",
    horizon: "Weekly",
    drawdown: "7%",
  },
  {
    symbol: "QQQ",
    type: "Stock",
    isHolding: false,
    isFavourite: true,
    popularity: 87,
    salesVolume: 740,
    horizonMonths: 6,
    returnPct: "2.7%",
    cadence: "Trade Weekly",
    sharpe: "1.1%",
    horizon: "Weekly",
    drawdown: "9%",
  },
];

function WatchlistList({
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
}) {
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
        <button
          className={activeTab === "bonds" ? "active" : ""}
          type="button"
          onClick={() => onTabChange("bonds")}
        >
          Bonds
        </button>
        <button
          className={`tab-spacer${showRankings ? " active" : ""}`}
          type="button"
          onClick={onToggleRankings}
        >
          Rankings
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
        {rows.map((row) => (
          <button
            key={row.symbol}
            type="button"
            className={`watchlist-row${row.symbol === selectedSymbol ? " selected" : ""}`}
            onClick={() => onSelect(row)}
          >
            <div>
              <strong className="ticker">{row.symbol}</strong>
              <div className="metric">{row.returnPct} Return</div>
            </div>
            <div>
              <div className="metric">{row.cadence}</div>
              <div className="metric">Sharp Ratio: {row.sharpe}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function WatchlistDetail({ selected, onToggleFavourite }) {
  if (!selected) {
    return (
      <section className="watchlist-panel detail-panel">
        <div className="chart-placeholder" aria-hidden="true" />
        <div className="stats-grid">
          <div className="stat">Select a stock to view details.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="watchlist-panel detail-panel">
      <div className="chart-placeholder" aria-hidden="true" />
      <div className="stats-grid">
        <div className="stat">Return: {selected.returnPct}</div>
        <div className="stat">Investment Horizon: {selected.horizon}</div>
        <div className="stat">Sharp Ratio: {selected.sharpe}</div>
        <div className="stat">Max Drawdown: {selected.drawdown}</div>
      </div>
      <div className="action-row">
        <button type="button">Buy</button>
        <button type="button">Sell</button>
        <button
          type="button"
          className={`icon-btn${selected.isFavourite ? " is-favourite" : ""}`}
          aria-label="Favourite"
          onClick={() => onToggleFavourite(selected.symbol)}
        >
          {selected.isFavourite ? "★" : "☆"}
        </button>
      </div>
    </section>
  );
}

function WatchlistLayout() {
  const [rows, setRows] = useState(watchlistRows);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showRankings, setShowRankings] = useState(false);
  const [rankingMetric, setRankingMetric] = useState("return");
  const [rankingOrder, setRankingOrder] = useState("desc");
  const [rankingHorizon, setRankingHorizon] = useState("1 Month");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRows = rows.filter((row) => {
    if (activeTab === "holdings") return row.isHolding;
    if (activeTab === "favourites") return row.isFavourite;
    if (activeTab === "stocks") return row.type === "Stock";
    if (activeTab === "bonds") return row.type === "Bond";
    return true;
  }).filter((row) => {
    if (!searchTerm) return true;
    const value = `${row.symbol} ${row.type}`.toLowerCase();
    return value.includes(searchTerm.toLowerCase());
  });

  const horizonMap = {
    "1 Month": 1,
    "3 Months": 3,
    "6 Months": 6,
    "1 Year": 12,
    "3 Years": 36,
  };

  const horizonFilteredRows = showRankings
    ? filteredRows.filter(
        (row) => row.horizonMonths === horizonMap[rankingHorizon]
      )
    : filteredRows;

  const metricValue = (row) => {
    if (rankingMetric === "return") return parseFloat(row.returnPct);
    if (rankingMetric === "sharpe") return parseFloat(row.sharpe);
    if (rankingMetric === "drawdown") return parseFloat(row.drawdown);
    if (rankingMetric === "popularity") return row.popularity;
    if (rankingMetric === "sales") return row.salesVolume;
    if (rankingMetric === "horizon") return row.horizonMonths;
    return 0;
  };

  const rankedRows = showRankings
    ? [...horizonFilteredRows].sort((a, b) => {
        const delta = metricValue(a) - metricValue(b);
        return rankingOrder === "asc" ? delta : -delta;
      })
    : filteredRows;

  return (
    <section className="watchlist-shell watchlist-component">
      <header className="watchlist-header">
        <h1 className="watchlist-title">Watch List</h1>
        <div className="watchlist-search">
          <input
            type="text"
            placeholder="Search"
            aria-label="Search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </header>

      <div className="watchlist-grid">
        <WatchlistList
          rows={rankedRows}
          selectedSymbol={selected?.symbol}
          onSelect={setSelected}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelected(null);
          }}
          showRankings={showRankings}
          onToggleRankings={() => setShowRankings((prev) => !prev)}
          rankingMetric={rankingMetric}
          onRankingMetricChange={setRankingMetric}
          rankingOrder={rankingOrder}
          onRankingOrderChange={setRankingOrder}
          rankingHorizon={rankingHorizon}
          onRankingHorizonChange={setRankingHorizon}
        />
        {selected && (
          <WatchlistDetail
            selected={selected}
            onToggleFavourite={(symbol) => {
              setRows((current) =>
                current.map((row) =>
                  row.symbol === symbol
                    ? { ...row, isFavourite: !row.isFavourite }
                    : row
                )
              );
              setSelected((current) =>
                current && current.symbol === symbol
                  ? { ...current, isFavourite: !current.isFavourite }
                  : current
              );
            }}
          />
        )}
      </div>
    </section>
  );
}

export default function WatchlistPage({
  label,
  meta,
  activityFeed,
  isLoggedIn,
}) {
  return <WatchlistLayout />;
}
