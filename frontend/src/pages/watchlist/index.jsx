import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_USER_ID,
  apiFetch,
  formatCurrency,
  formatDate,
  formatSignedPercent,
} from "../../lib/api";
import TradeModals from "./components/TradeModals";
import WatchlistDetail from "./components/WatchlistDetail";
import WatchlistList from "./components/WatchlistList";
import WatchlistSearch from "./components/WatchlistSearch";
import "./watchlist.css";

export const watchlistPageMeta = {
  eyebrow: "Priority Watchlist",
  title: "Keep conviction names close and fast to inspect.",
  description:
    "Search the asset catalog, inspect detail, and add or remove names from the watchlist.",
  metrics: [],
};

export const watchlistActivityFeed = [
  "Earnings calendar synced for all watch names",
  "Three liquidity names widened beyond threshold",
  "Analyst note attached to Semiconductor basket",
];

const HISTORY_LOOKBACK_DAYS = 180;

const toFiniteNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const parseMetric = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

function mapWatchlistItemToRow(item, existingRow) {
  const symbol = item?.symbol || "UNKNOWN";
  const latestClose = toFiniteNumber(item?.latestClose, 0);
  const dailyChange = item?.dailyChange;
  const dailyChangeText =
    dailyChange === null || dailyChange === undefined
      ? "N/A"
      : `${dailyChange > 0 ? "+" : ""}${toFiniteNumber(dailyChange).toFixed(2)}`;
  const dailyChangePercentText = formatSignedPercent(item?.dailyChangePercent);

  return {
    watchlistId: item?.watchlistId ?? null,
    assetId: item?.assetId ?? null,
    symbol,
    name: item?.name || symbol,
    type: "Stock",
    isHolding: existingRow?.isHolding || false,
    isFavourite: existingRow?.isFavourite || false,
    popularity: existingRow?.popularity || 0,
    salesVolume: existingRow?.salesVolume || 0,
    horizonMonths: existingRow?.horizonMonths || 1,
    holdingShares: existingRow?.holdingShares || 0,
    returnPct: dailyChangePercentText,
    returns: {
      Daily: dailyChangePercentText,
      Change: dailyChangeText,
      Price: formatCurrency(latestClose, item?.currency || "USD"),
    },
    cadence: item?.latestTradeDate
      ? `Last Trade ${formatDate(item.latestTradeDate)}`
      : "Last Trade N/A",
    sharpe: existingRow?.sharpe || "N/A",
    horizon: item?.latestTradeDate ? formatDate(item.latestTradeDate) : "N/A",
    drawdown: existingRow?.drawdown || "N/A",
    currency: item?.currency || "USD",
    exchange: item?.exchange || "UNKNOWN",
    region: item?.region || "UNKNOWN",
    latestClose,
    latestTradeDate: item?.latestTradeDate || null,
    dailyChange: item?.dailyChange ?? null,
    dailyChangePercent: item?.dailyChangePercent ?? null,
    addedAt: item?.addedAt || null,
    note: item?.note || "",
    priceHistory: existingRow?.priceHistory || [],
  };
}

export default function WatchlistPage() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showRankings, setShowRankings] = useState(false);
  const [rankingMetric, setRankingMetric] = useState("return");
  const [rankingOrder, setRankingOrder] = useState("desc");
  const [rankingHorizon, setRankingHorizon] = useState("1 Month");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestionRows, setSuggestionRows] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingHistoryFor, setLoadingHistoryFor] = useState("");
  const [savingSymbol, setSavingSymbol] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [tradeModal, setTradeModal] = useState({ open: false, type: null });
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeCashAmount, setTradeCashAmount] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const rowsRef = useRef(rows);

  const cashBalance = 125000;
  const numericAmount = Number.parseFloat(tradeAmount || "0");
  const isOverBalance = numericAmount > cashBalance;
  const holdingLimit = selected?.type === "Bond"
    ? Number(selected?.holdingCash || 0)
    : Number(selected?.holdingShares || 0);
  const isOverHolding = tradeModal.type === "sell" && numericAmount > holdingLimit;
  const latestPrice =
    selected?.priceHistory?.[selected.priceHistory.length - 1]?.price
    || selected?.latestClose
    || 0;
  const stockCashValue = selected?.holdingShares
    ? selected.holdingShares * latestPrice
    : 0;
  const calculatedCash = tradeAmount ? Number(tradeAmount) * latestPrice : 0;

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(`/api/watchlists?userId=${DEFAULT_USER_ID}`);
      const previousBySymbol = new Map(
        rowsRef.current.map((row) => [row.symbol, row]),
      );
      const nextRows = (response?.items || []).map((item) =>
        mapWatchlistItemToRow(item, previousBySymbol.get(item.symbol)),
      );

      setRows(nextRows);
      setSelected((current) => {
        if (!current) {
          return null;
        }
        return (
          nextRows.find(
            (row) =>
              row.assetId === current.assetId || row.symbol === current.symbol,
          ) || null
        );
      });
    } catch (requestError) {
      setError(requestError.message || "Failed to load watchlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    const keyword = searchTerm.trim();
    if (!keyword) {
      setSuggestionRows([]);
      setSearchError("");
      return;
    }

    let disposed = false;
    const timer = setTimeout(async () => {
      try {
        setSearchError("");
        const response = await apiFetch(
          `/api/assets/suggestions?query=${encodeURIComponent(keyword)}&limit=8`,
        );
        if (disposed) {
          return;
        }
        const items = (response?.items || []).map((item) => ({
          assetId: item.assetId ?? null,
          symbol: item.symbol,
          name: item.name,
          type: item.assetType || "UNKNOWN",
          exchange: item.exchange || null,
          region: item.region || null,
        }));
        setSuggestionRows(items);
      } catch (requestError) {
        if (!disposed) {
          setSuggestionRows([]);
          setSearchError(requestError.message || "Failed to search symbols.");
        }
      }
    }, 250);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    const symbol = selected?.symbol;
    if (!symbol || selected?.priceHistory?.length) {
      return undefined;
    }

    let disposed = false;
    const loadHistory = async () => {
      setLoadingHistoryFor(symbol);
      try {
        const response = await apiFetch(
          `/api/assets/price-history?query=${encodeURIComponent(symbol)}&days=${HISTORY_LOOKBACK_DAYS}`,
        );
        if (disposed) {
          return;
        }
        const history = (response?.items || [])
          .map((item) => ({
            date: item.tradeDate,
            price: toFiniteNumber(item.close, NaN),
          }))
          .filter((point) => Number.isFinite(point.price));

        setRows((currentRows) =>
          currentRows.map((row) =>
            row.symbol === symbol ? { ...row, priceHistory: history } : row,
          ),
        );
        setSelected((current) =>
          current && current.symbol === symbol
            ? { ...current, priceHistory: history }
            : current,
        );
      } catch (requestError) {
        if (!disposed) {
          setError(
            requestError.message || `Failed to load price history for ${symbol}.`,
          );
        }
      } finally {
        if (!disposed) {
          setLoadingHistoryFor("");
        }
      }
    };

    loadHistory();
    return () => {
      disposed = true;
    };
  }, [selected?.symbol, selected?.priceHistory?.length]);

  const addSymbolToWatchlist = useCallback(async (candidate) => {
    if (!candidate?.symbol) {
      return;
    }

    setSavingSymbol(candidate.symbol);
    setError("");
    setNotice("");
    try {
      const payload = {
        userId: DEFAULT_USER_ID,
        assetId: candidate.assetId,
        symbol: candidate.symbol,
        name: candidate.name,
        exchange: candidate.exchange,
        region: candidate.region,
      };
      const created = await apiFetch("/api/watchlists", {
        method: "POST",
        body: payload,
      });
      const row = mapWatchlistItemToRow(created, null);
      setRows((currentRows) => [row, ...currentRows.filter((item) => item.symbol !== row.symbol)]);
      setSelected(row);
      setNotice(`${row.symbol} has been added to watchlist.`);
      setSearchTerm(row.symbol);
      setShowSuggestions(false);
    } catch (requestError) {
      setError(requestError.message || "Failed to add the symbol to watchlist.");
      await loadWatchlist();
    } finally {
      setSavingSymbol("");
    }
  }, [loadWatchlist]);

  const removeSelectedFromWatchlist = useCallback(async () => {
    if (!selected?.assetId) {
      return;
    }

    setSavingSymbol(selected.symbol);
    setError("");
    setNotice("");
    try {
      await apiFetch(
        `/api/watchlists/${selected.assetId}?userId=${DEFAULT_USER_ID}`,
        { method: "DELETE" },
      );
      setRows((currentRows) =>
        currentRows.filter((row) => row.assetId !== selected.assetId),
      );
      setSelected(null);
      setNotice(`${selected.symbol} has been removed from watchlist.`);
    } catch (requestError) {
      setError(requestError.message || "Failed to remove watchlist item.");
    } finally {
      setSavingSymbol("");
    }
  }, [selected]);

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
    if (rankingMetric === "return") return parseMetric(row.returnPct);
    if (rankingMetric === "sharpe") return parseMetric(row.sharpe);
    if (rankingMetric === "drawdown") return parseMetric(row.drawdown);
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
    <section className="watchlist-page watchlist-shell watchlist-component">
      <header className="watchlist-header">
        <h1 className="watchlist-title">Watch List</h1>
        <WatchlistSearch
          searchTerm={searchTerm}
          onSearchChange={(value) => {
            setSearchTerm(value);
            setShowSuggestions(true);
          }}
          showSuggestions={showSuggestions}
          suggestionRows={suggestionRows}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          onSuggestionSelect={async (candidate) => {
            const existing = rows.find((row) => row.symbol === candidate.symbol);
            if (existing) {
              setSearchTerm(existing.symbol);
              setSelected(existing);
              setShowSuggestions(false);
              return;
            }
            await addSymbolToWatchlist(candidate);
            setShowSuggestions(false);
          }}
        />
      </header>
      {loading && <p className="watchlist-note">Loading watchlist...</p>}
      {loadingHistoryFor && (
        <p className="watchlist-note">
          Loading {loadingHistoryFor} price history...
        </p>
      )}
      {savingSymbol && (
        <p className="watchlist-note">Syncing {savingSymbol}...</p>
      )}
      {notice && <p className="watchlist-note">{notice}</p>}
      {error && <p className="inline-error">{error}</p>}
      {searchError && <p className="inline-error">{searchError}</p>}

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
          isRemoving={savingSymbol === selected?.symbol}
          onRemove={removeSelectedFromWatchlist}
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
