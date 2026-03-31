import React, { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const DAYS_IN_YEAR = 365;
const YEAR_SPAN = 3;

const formatDate = (date) => date.toISOString().slice(0, 10);

const generateSeries = (seed, startPrice) => {
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - YEAR_SPAN);

  let price = startPrice;
  let value = seed;
  const data = [];

  for (let i = 0; i <= DAYS_IN_YEAR * YEAR_SPAN; i += 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    const change = (value / 4294967296 - 0.5) * 2;
    price = Math.max(10, price + change * (startPrice * 0.015));
    const pointDate = new Date(startDate);
    pointDate.setDate(startDate.getDate() + i);
    data.push({
      date: formatDate(pointDate),
      price: Number(price.toFixed(2)),
    });
  }

  return data;
};

const seedFromSymbol = (symbol) =>
  symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const watchlistRows = [
  {
    symbol: "APPL",
    type: "Stock",
    isHolding: true,
    isFavourite: true,
    popularity: 92,
    salesVolume: 780,
    horizonMonths: 1,
    holdingShares: 120,
    returnPct: "3.5%",
    returns: {
      "7 Days": "0.8%",
      "1 Month": "3.5%",
      "6 Months": "9.1%",
      "1 Year": "14.4%",
      "3 Years": "36.2%",
    },
    cadence: "Trade Everyday",
    sharpe: "1%",
    horizon: "Everyday",
    drawdown: "10%",
    priceHistory: generateSeries(seedFromSymbol("APPL"), 188),
  },
  {
    symbol: "MSFT",
    type: "Stock",
    isHolding: true,
    isFavourite: false,
    popularity: 88,
    salesVolume: 640,
    horizonMonths: 3,
    holdingShares: 85,
    returnPct: "2.1%",
    returns: {
      "7 Days": "0.4%",
      "1 Month": "2.1%",
      "6 Months": "7.8%",
      "1 Year": "12.3%",
      "3 Years": "29.5%",
    },
    cadence: "Trade Weekly",
    sharpe: "0.8%",
    horizon: "Weekly",
    drawdown: "8%",
    priceHistory: generateSeries(seedFromSymbol("MSFT"), 320),
  },
  {
    symbol: "NVDA",
    type: "Stock",
    isHolding: false,
    isFavourite: true,
    popularity: 95,
    salesVolume: 920,
    horizonMonths: 6,
    holdingShares: 0,
    returnPct: "4.4%",
    returns: {
      "7 Days": "1.2%",
      "1 Month": "4.4%",
      "6 Months": "16.5%",
      "1 Year": "24.7%",
      "3 Years": "58.1%",
    },
    cadence: "Trade Weekly",
    sharpe: "1.3%",
    horizon: "Weekly",
    drawdown: "12%",
    priceHistory: generateSeries(seedFromSymbol("NVDA"), 460),
  },
  {
    symbol: "JPM",
    type: "Stock",
    isHolding: false,
    isFavourite: false,
    popularity: 70,
    salesVolume: 410,
    horizonMonths: 12,
    holdingShares: 0,
    returnPct: "1.6%",
    returns: {
      "7 Days": "0.2%",
      "1 Month": "1.6%",
      "6 Months": "5.2%",
      "1 Year": "9.1%",
      "3 Years": "21.0%",
    },
    cadence: "Trade Monthly",
    sharpe: "0.7%",
    horizon: "Monthly",
    drawdown: "6%",
    priceHistory: generateSeries(seedFromSymbol("JPM"), 160),
  },
  {
    symbol: "TLT",
    type: "Bond",
    isHolding: true,
    isFavourite: false,
    popularity: 65,
    salesVolume: 280,
    horizonMonths: 12,
    holdingCash: 18000,
    returnPct: "0.9%",
    returns: {
      "7 Days": "0.1%",
      "1 Month": "0.9%",
      "6 Months": "2.4%",
      "1 Year": "4.2%",
      "3 Years": "8.5%",
    },
    cadence: "Trade Monthly",
    sharpe: "0.4%",
    horizon: "Monthly",
    drawdown: "5%",
    priceHistory: generateSeries(seedFromSymbol("TLT"), 95),
  },
  {
    symbol: "IEF",
    type: "Bond",
    isHolding: false,
    isFavourite: true,
    popularity: 60,
    salesVolume: 240,
    horizonMonths: 36,
    holdingCash: 0,
    returnPct: "0.6%",
    returns: {
      "7 Days": "0.1%",
      "1 Month": "0.6%",
      "6 Months": "1.9%",
      "1 Year": "3.3%",
      "3 Years": "7.2%",
    },
    cadence: "Trade Monthly",
    sharpe: "0.3%",
    horizon: "Monthly",
    drawdown: "3%",
    priceHistory: generateSeries(seedFromSymbol("IEF"), 102),
  },
  {
    symbol: "LQD",
    type: "Bond",
    isHolding: true,
    isFavourite: true,
    popularity: 72,
    salesVolume: 310,
    horizonMonths: 12,
    holdingCash: 12500,
    returnPct: "0.8%",
    returns: {
      "7 Days": "0.1%",
      "1 Month": "0.8%",
      "6 Months": "2.2%",
      "1 Year": "3.9%",
      "3 Years": "8.1%",
    },
    cadence: "Trade Monthly",
    sharpe: "0.5%",
    horizon: "Monthly",
    drawdown: "4%",
    priceHistory: generateSeries(seedFromSymbol("LQD"), 108),
  },
  {
    symbol: "BND",
    type: "Bond",
    isHolding: false,
    isFavourite: false,
    popularity: 58,
    salesVolume: 260,
    horizonMonths: 36,
    holdingCash: 0,
    returnPct: "0.7%",
    returns: {
      "7 Days": "0.1%",
      "1 Month": "0.7%",
      "6 Months": "1.8%",
      "1 Year": "3.1%",
      "3 Years": "6.8%",
    },
    cadence: "Trade Monthly",
    sharpe: "0.4%",
    horizon: "Monthly",
    drawdown: "3%",
    priceHistory: generateSeries(seedFromSymbol("BND"), 72),
  },
  {
    symbol: "SPY",
    type: "Stock",
    isHolding: true,
    isFavourite: false,
    popularity: 90,
    salesVolume: 860,
    horizonMonths: 6,
    holdingShares: 40,
    returnPct: "1.9%",
    returns: {
      "7 Days": "0.5%",
      "1 Month": "1.9%",
      "6 Months": "6.8%",
      "1 Year": "11.6%",
      "3 Years": "26.9%",
    },
    cadence: "Trade Weekly",
    sharpe: "0.9%",
    horizon: "Weekly",
    drawdown: "7%",
    priceHistory: generateSeries(seedFromSymbol("SPY"), 430),
  },
  {
    symbol: "QQQ",
    type: "Stock",
    isHolding: false,
    isFavourite: true,
    popularity: 87,
    salesVolume: 740,
    horizonMonths: 6,
    holdingShares: 0,
    returnPct: "2.7%",
    returns: {
      "7 Days": "0.7%",
      "1 Month": "2.7%",
      "6 Months": "9.4%",
      "1 Year": "15.2%",
      "3 Years": "34.7%",
    },
    cadence: "Trade Weekly",
    sharpe: "1.1%",
    horizon: "Weekly",
    drawdown: "9%",
    priceHistory: generateSeries(seedFromSymbol("QQQ"), 380),
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
        <button
          className={activeTab === "bonds" ? "active" : ""}
          type="button"
          onClick={() => onTabChange("bonds")}
        >
          Bonds
        </button>
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
        {rows.map((row) => (
          <div key={row.symbol} className="watchlist-row-group">
            <div
              role="button"
              tabIndex={0}
              className={`watchlist-row${row.symbol === selectedSymbol ? " selected" : ""}`}
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
                      current === row.symbol ? null : row.symbol
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
        ))}
      </div>
    </section>
  );
}

function WatchlistDetail({ selected, onToggleFavourite, onTrade }) {
  const chartData = useMemo(() => selected?.priceHistory ?? [], [selected]);

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
      <div className="chart-placeholder" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 12, bottom: 16, left: 16 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(value) => value.slice(0, 7)}
              minTickGap={40}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              axisLine
              tickLine
            />
            <YAxis
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              axisLine
              tickLine
              width={40}
            />
            <Tooltip
              formatter={(value) => [`$${value}`, "Price"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#111111"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="stats-grid">
        <div className="stat">Return: {selected.returnPct}</div>
        <div className="stat">Investment Horizon: {selected.horizon}</div>
        <div className="stat">Sharp Ratio: {selected.sharpe}</div>
        <div className="stat">Max Drawdown: {selected.drawdown}</div>
      </div>
      <div className="action-row">
        <button type="button" onClick={() => onTrade("buy")}>Buy</button>
        <button type="button" onClick={() => onTrade("sell")}>Sell</button>
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tradeModal, setTradeModal] = useState({ open: false, type: null });
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeCashAmount, setTradeCashAmount] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const cashBalance = 125000;
  const numericAmount = Number.parseFloat(tradeAmount || "0");
  const isOverBalance = numericAmount > cashBalance;
  const holdingLimit = selected?.type === "Bond"
    ? Number(selected?.holdingCash || 0)
    : Number(selected?.holdingShares || 0);
  const isOverHolding = tradeModal.type === "sell" && numericAmount > holdingLimit;
  const latestPrice = selected?.priceHistory?.[selected.priceHistory.length - 1]?.price || 0;
  const stockCashValue = selected?.holdingShares ? selected.holdingShares * latestPrice : 0;

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

  const suggestionRows = rows.filter((row) => {
    if (!searchTerm) return false;
    const value = `${row.symbol} ${row.type}`.toLowerCase();
    return value.startsWith(searchTerm.toLowerCase());
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
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          />
          {showSuggestions && suggestionRows.length > 0 && (
            <div className="search-suggestions" role="listbox">
              {suggestionRows.map((row) => (
                <button
                  key={row.symbol}
                  type="button"
                  className="search-suggestion"
                  onClick={() => {
                    setSearchTerm(row.symbol);
                    setSelected(row);
                    setShowSuggestions(false);
                  }}
                >
                  <span>{row.symbol}</span>
                  <span>{row.type}</span>
                </button>
              ))}
            </div>
          )}
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
            onTrade={(type) => {
              setTradeAmount("");
              setTradeModal({ open: true, type });
            }}
          />
        )}
      </div>

      {tradeModal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>{tradeModal.type === "buy" ? "Buy" : "Sell"} Amount</h3>
            {tradeModal.type === "buy" && isOverBalance && (
              <div className="modal-warning">
                Please enter an amount less than your avaliable cash!
              </div>
            )}
            {tradeModal.type === "sell" && isOverHolding && (
              <div className="modal-warning">
                Please enter an amount less than your holding amount!
              </div>
            )}
            {tradeModal.type === "buy" && (
              <p className="modal-cash">Cash Available: ${cashBalance.toLocaleString()}</p>
            )}
            {tradeModal.type === "sell" && selected?.type === "Stock" && (
              <p className="modal-cash">
                Shares Owned: {selected.holdingShares || 0} · Value: ${stockCashValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            )}
            {tradeModal.type === "sell" && selected?.type === "Bond" && (
              <p className="modal-cash">
                Bond Value: ${Number(selected.holdingCash || 0).toLocaleString()}
              </p>
            )}
            <label className="modal-label" htmlFor="trade-amount">
              Share Amount
            </label>
            <input
              id="trade-amount"
              type="text"
              min="0"
              step="any"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="Enter amount"
              value={tradeAmount}
              disabled={Boolean(tradeCashAmount)}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^0-9.]/g, "");
                const sanitized = nextValue.replace(/(\..*)\./g, "$1");
                setTradeAmount(sanitized);
                if (sanitized) {
                  setTradeCashAmount("");
                }
              }}
            />
            <label className="modal-label" htmlFor="trade-cash">
              Cash Amount
            </label>
            <input
              id="trade-cash"
              type="text"
              min="0"
              step="any"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="Enter cash amount"
              value={tradeCashAmount}
              disabled={Boolean(tradeAmount)}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^0-9.]/g, "");
                const sanitized = nextValue.replace(/(\..*)\./g, "$1");
                setTradeCashAmount(sanitized);
                if (sanitized) {
                  setTradeAmount("");
                }
              }}
            />
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  if (tradeModal.type === "sell" && isOverHolding) {
                    return;
                  }
                  setTradeModal({ open: false, type: null });
                  const verb = tradeModal.type === "sell" ? "sold" : "bought";
                  const unitLabel = selected?.type === "Bond" ? "amount" : "shares";
                  const shareText = tradeAmount ? `${tradeAmount} ${unitLabel}` : "0 shares";
                  const cashText = tradeCashAmount ? `$${tradeCashAmount}` : "$0";
                  setConfirmation(
                    `A ${verb} of ${shareText} and ${cashText} of ${
                      selected?.symbol || "stock"
                    } is confirmed`
                  );
                  setTradeAmount("");
                  setTradeCashAmount("");
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <p className="modal-confirmation">{confirmation}</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmation("")}>OK</button>
            </div>
          </div>
        </div>
      )}
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
