import React, { useMemo, useState } from "react";
import TradeModals from "./components/TradeModals";
import WatchlistDetail from "./components/WatchlistDetail";
import WatchlistList from "./components/WatchlistList";
import WatchlistSearch from "./components/WatchlistSearch";
import { watchlistRows } from "./watchlistData";
import "./watchlist.css";

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

export default function WatchlistPage() {
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
  const latestPrice =
    selected?.priceHistory?.[selected.priceHistory.length - 1]?.price || 0;
  const stockCashValue = selected?.holdingShares
    ? selected.holdingShares * latestPrice
    : 0;
  const calculatedCash = tradeAmount ? Number(tradeAmount) * latestPrice : 0;

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => {
          if (activeTab === "holdings") return row.isHolding;
          if (activeTab === "favourites") return row.isFavourite;
          if (activeTab === "stocks") return row.type === "Stock";
          if (activeTab === "bonds") return row.type === "Bond";
          return true;
        })
        .filter((row) => {
          if (!searchTerm) return true;
          const value = `${row.symbol} ${row.type}`.toLowerCase();
          return value.includes(searchTerm.toLowerCase());
        }),
    [rows, activeTab, searchTerm],
  );

  const suggestionRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!searchTerm) return false;
        const value = `${row.symbol} ${row.type}`.toLowerCase();
        return value.startsWith(searchTerm.toLowerCase());
      }),
    [rows, searchTerm],
  );

  const horizonMap = {
    "1 Month": 1,
    "3 Months": 3,
    "6 Months": 6,
    "1 Year": 12,
    "3 Years": 36,
  };

  const horizonFilteredRows = showRankings
    ? filteredRows.filter((row) => row.horizonMonths === horizonMap[rankingHorizon])
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

  const rankedRows = useMemo(() => {
    if (!showRankings) return filteredRows;
    return [...horizonFilteredRows].sort((a, b) => {
      const delta = metricValue(a) - metricValue(b);
      return rankingOrder === "asc" ? delta : -delta;
    });
  }, [showRankings, filteredRows, horizonFilteredRows, rankingOrder, rankingMetric]);

  return (
    <section className="watchlist-shell watchlist-component">
      <header className="watchlist-header">
        <h1 className="watchlist-title">Watch List</h1>
        <WatchlistSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showSuggestions={showSuggestions}
          suggestionRows={suggestionRows}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          onSuggestionSelect={(row) => {
            setSearchTerm(row.symbol);
            setSelected(row);
            setShowSuggestions(false);
          }}
        />
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
        <WatchlistDetail
          selected={selected}
          onToggleFavourite={(symbol) => {
            setRows((current) =>
              current.map((row) =>
                row.symbol === symbol
                  ? { ...row, isFavourite: !row.isFavourite }
                  : row,
              ),
            );
            setSelected((current) =>
              current && current.symbol === symbol
                ? { ...current, isFavourite: !current.isFavourite }
                : current,
            );
          }}
          onTrade={(type) => {
            setTradeAmount("");
            setTradeCashAmount("");
            setTradeModal({ open: true, type });
          }}
        />
      </div>

      <TradeModals
        tradeModal={tradeModal}
        setTradeModal={setTradeModal}
        selected={selected}
        tradeAmount={tradeAmount}
        setTradeAmount={setTradeAmount}
        tradeCashAmount={tradeCashAmount}
        setTradeCashAmount={setTradeCashAmount}
        cashBalance={cashBalance}
        isOverBalance={isOverBalance}
        isOverHolding={isOverHolding}
        stockCashValue={stockCashValue}
        calculatedCash={calculatedCash}
        confirmation={confirmation}
        setConfirmation={setConfirmation}
      />
    </section>
  );
}
