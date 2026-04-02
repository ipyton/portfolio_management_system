import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildFxRateMap,
  convertAmountByFx,
  DEFAULT_USER_ID,
  apiFetch,
  fetchFxLatest,
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
const FAV_STORAGE_KEY = `watchlist-favourites-${DEFAULT_USER_ID}`;
const USD_CURRENCY = "USD";

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

function loadFavouriteSymbols() {
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      return new Set();
    }
    return new Set(list.map((item) => String(item).toUpperCase()));
  } catch {
    return new Set();
  }
}

function saveFavouriteSymbols(rows) {
  const symbols = rows
    .filter((row) => row.isFavourite)
    .map((row) => row.symbol.toUpperCase());
  window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(symbols));
}

function normalizeHorizonMonths(daysCount) {
  if (daysCount >= 500) return 36;
  if (daysCount >= 240) return 12;
  if (daysCount >= 120) return 6;
  if (daysCount >= 60) return 3;
  return 1;
}

function computeHistoryInsights(history, currency, fxRateMap) {
  if (!history?.length) {
    return null;
  }

  const first = Number(history[0].price);
  const last = Number(history[history.length - 1].price);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return null;
  }

  const prev = Number(history[history.length - 2]?.price);
  const dailyChange = Number.isFinite(prev) ? last - prev : null;
  const dailyChangeUsd = dailyChange === null ? null : convertAmountByFx(dailyChange, currency, fxRateMap, USD_CURRENCY);
  const lastPriceUsd = convertAmountByFx(last, currency, fxRateMap, USD_CURRENCY);
  const dailyChangePercent = Number.isFinite(prev) && prev > 0 ? last / prev - 1 : null;
  const totalReturn = last / first - 1;

  const dailyReturns = [];
  for (let index = 1; index < history.length; index += 1) {
    const prior = Number(history[index - 1].price);
    const current = Number(history[index].price);
    if (!Number.isFinite(prior) || !Number.isFinite(current) || prior <= 0) {
      continue;
    }
    dailyReturns.push(current / prior - 1);
  }

  let sharpe = null;
  if (dailyReturns.length > 1) {
    const avg = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, value) => sum + (value - avg) ** 2, 0)
      / (dailyReturns.length - 1);
    const std = Math.sqrt(Math.max(variance, 0));
    if (std > 1e-8) {
      sharpe = (avg / std) * Math.sqrt(252);
    }
  }

  let peak = first;
  let maxDrawdown = 0;
  history.forEach((point) => {
    const price = Number(point.price);
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }
    if (price > peak) {
      peak = price;
    }
    const drawdown = price / peak - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return {
    returnPct: formatSignedPercent(totalReturn),
    sharpe: sharpe === null ? "N/A" : Number(sharpe).toFixed(2),
    drawdown: formatSignedPercent(maxDrawdown),
    horizonMonths: normalizeHorizonMonths(history.length),
    returns: {
      Daily: formatSignedPercent(dailyChangePercent),
      Change:
        dailyChangeUsd === null
          ? "N/A"
          : `${dailyChangeUsd > 0 ? "+" : ""}${formatCurrency(dailyChangeUsd, USD_CURRENCY)}`,
      Total: formatSignedPercent(totalReturn),
      Price: lastPriceUsd === null ? "N/A" : formatCurrency(lastPriceUsd, USD_CURRENCY),
    },
  };
}

function mapWatchlistItemToRow(item, existingRow, holdingItem, isFavourite, fxRateMap) {
  const symbol = item?.symbol || "UNKNOWN";
  const latestClose = toFiniteNumber(item?.latestClose, 0);
  const latestCloseUsd = convertAmountByFx(latestClose, item?.currency, fxRateMap, USD_CURRENCY);
  const dailyChange = item?.dailyChange;
  const dailyChangeUsd = dailyChange === null || dailyChange === undefined
    ? null
    : convertAmountByFx(dailyChange, item?.currency, fxRateMap, USD_CURRENCY);
  const dailyChangeText =
    dailyChangeUsd === null
      ? "N/A"
      : `${dailyChangeUsd > 0 ? "+" : ""}${formatCurrency(dailyChangeUsd, USD_CURRENCY)}`;
  const dailyChangePercentText = formatSignedPercent(item?.dailyChangePercent);
  const holdingShares = toFiniteNumber(holdingItem?.quantity, existingRow?.holdingShares || 0);
  const historyInsights = existingRow?.priceHistory?.length
    ? computeHistoryInsights(existingRow.priceHistory, item?.currency || existingRow?.currency, fxRateMap)
    : null;

  return {
    watchlistId: item?.watchlistId ?? null,
    assetId: item?.assetId ?? null,
    symbol,
    name: item?.name || symbol,
    type: existingRow?.type || "Stock",
    isHolding: holdingShares > 0,
    isFavourite: Boolean(isFavourite),
    popularity: existingRow?.popularity || 0,
    salesVolume: existingRow?.salesVolume || 0,
    horizonMonths: historyInsights?.horizonMonths || existingRow?.horizonMonths || 1,
    holdingShares,
    returnPct: historyInsights?.returnPct || existingRow?.returnPct || dailyChangePercentText,
    returns: historyInsights?.returns || existingRow?.returns || {
      Daily: dailyChangePercentText,
      Change: dailyChangeText,
      Price: latestCloseUsd === null ? "N/A" : formatCurrency(latestCloseUsd, USD_CURRENCY),
    },
    cadence: item?.latestTradeDate
      ? `Last Trade ${formatDate(item.latestTradeDate)}`
      : "Last Trade N/A",
    sharpe: historyInsights?.sharpe || existingRow?.sharpe || "N/A",
    horizon: item?.latestTradeDate ? formatDate(item.latestTradeDate) : "N/A",
    drawdown: historyInsights?.drawdown || existingRow?.drawdown || "N/A",
    currency: item?.currency || "USD",
    exchange: item?.exchange || "UNKNOWN",
    region: item?.region || "UNKNOWN",
    sector: item?.sector || existingRow?.sector || null,
    industry: item?.industry || existingRow?.industry || null,
    marketCap: item?.marketCap ?? existingRow?.marketCap ?? null,
    peRatio: item?.peRatio ?? existingRow?.peRatio ?? null,
    latestClose,
    latestTradeDate: item?.latestTradeDate || null,
    dailyChange: item?.dailyChange ?? null,
    dailyChangePercent: item?.dailyChangePercent ?? null,
    latestCloseUsd,
    addedAt: item?.addedAt || null,
    note: item?.note || "",
    priceHistory: existingRow?.priceHistory || [],
  };
}

export default function WatchlistPage({ isLoggedIn = true }) {
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
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [cashByCurrency, setCashByCurrency] = useState({});
  const [fxRateMap, setFxRateMap] = useState({ USD: 1 });
  const rowsRef = useRef(rows);
  const loadedHistorySymbolsRef = useRef(new Set());
  const loadingHistorySymbolsRef = useRef(new Set());

  const requireLogin = useCallback(
    (actionLabel) => {
      if (isLoggedIn) {
        return true;
      }
      setNotice("");
      setError(`Guest mode cannot ${actionLabel}. Switch to Logged in to continue.`);
      return false;
    },
    [isLoggedIn],
  );

  const toUsdAmount = useCallback(
    (value, sourceCurrency) => convertAmountByFx(value, sourceCurrency, fxRateMap, USD_CURRENCY),
    [fxRateMap],
  );

  const formatUsdValue = useCallback(
    (value, sourceCurrency) => {
      const converted = toUsdAmount(value, sourceCurrency);
      return converted === null ? "N/A" : formatCurrency(converted, USD_CURRENCY);
    },
    [toUsdAmount],
  );

  const cashBalance = useMemo(() => {
    const selectedCurrency = (selected?.currency || "").toUpperCase();
    if (selectedCurrency && Number.isFinite(cashByCurrency[selectedCurrency])) {
      return cashByCurrency[selectedCurrency];
    }
    const firstBalance = Object.values(cashByCurrency)[0];
    return Number.isFinite(firstBalance) ? firstBalance : 0;
  }, [cashByCurrency, selected?.currency]);

  const numericShareAmount = Number.parseFloat(tradeAmount || "0");
  const numericCashAmount = Number.parseFloat(tradeCashAmount || "0");
  const latestPrice =
    selected?.priceHistory?.[selected.priceHistory.length - 1]?.price
    || selected?.latestClose
    || 0;
  const effectiveTradeQuantity = tradeAmount
    ? numericShareAmount
    : (numericCashAmount > 0 && latestPrice > 0 ? numericCashAmount / latestPrice : 0);
  const requiredCash = tradeAmount
    ? numericShareAmount * latestPrice
    : numericCashAmount;

  const isOverBalance =
    tradeModal.type === "buy"
    && Number.isFinite(requiredCash)
    && requiredCash > cashBalance;

  const holdingLimit = Number(selected?.holdingShares || 0);
  const isOverHolding =
    tradeModal.type === "sell"
    && Number.isFinite(effectiveTradeQuantity)
    && effectiveTradeQuantity > holdingLimit;

  const stockCashValue = selected?.holdingShares
    ? selected.holdingShares * latestPrice
    : 0;
  const calculatedCash = tradeAmount ? Number(tradeAmount) * latestPrice : 0;
  const cashBalanceDisplay = formatUsdValue(cashBalance, selected?.currency);
  const stockCashValueDisplay = formatUsdValue(stockCashValue, selected?.currency);
  const calculatedCashDisplay = formatUsdValue(calculatedCash, selected?.currency);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (!isLoggedIn && tradeModal.open) {
      setTradeModal({ open: false, type: null });
      setTradeAmount("");
      setTradeCashAmount("");
    }
  }, [isLoggedIn, tradeModal.open]);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [watchlistResponse, holdingsResponse, cashResponse, fxResponse] = await Promise.all([
        apiFetch(`/api/watchlists?userId=${DEFAULT_USER_ID}`),
        apiFetch(`/api/holdings?userId=${DEFAULT_USER_ID}`).catch(() => ({ items: [] })),
        apiFetch(`/api/cash-accounts?userId=${DEFAULT_USER_ID}`).catch(() => ({ items: [] })),
        fetchFxLatest(USD_CURRENCY).catch(() => null),
      ]);
      const nextFxRateMap = fxResponse ? buildFxRateMap(fxResponse, USD_CURRENCY) : { USD: 1 };
      if (fxResponse) {
        setFxRateMap(nextFxRateMap);
      }

      const previousBySymbol = new Map(
        rowsRef.current.map((row) => [row.symbol.toUpperCase(), row]),
      );
      const holdingBySymbol = new Map(
        (holdingsResponse?.items || []).map((item) => [String(item.symbol || "").toUpperCase(), item]),
      );
      const favouriteSymbols = loadFavouriteSymbols();

      const nextRows = (watchlistResponse?.items || []).map((item) => {
        const symbolKey = String(item?.symbol || "").toUpperCase();
        const previous = previousBySymbol.get(symbolKey);
        return mapWatchlistItemToRow(
          item,
          previous,
          holdingBySymbol.get(symbolKey),
          favouriteSymbols.has(symbolKey) || previous?.isFavourite,
          nextFxRateMap,
        );
      });

      const nextCashByCurrency = {};
      (cashResponse?.items || []).forEach((item) => {
        const currency = String(item?.currency || "").toUpperCase();
        if (!currency) {
          return;
        }
        nextCashByCurrency[currency] = toFiniteNumber(item?.availableBalance, toFiniteNumber(item?.balance, 0));
      });

      setRows(nextRows);
      setCashByCurrency(nextCashByCurrency);
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

  const applyHistoryToSymbol = useCallback((symbol, history) => {
    const symbolKey = String(symbol || "").toUpperCase();
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (String(row.symbol || "").toUpperCase() !== symbolKey) {
          return row;
        }
        const insights = computeHistoryInsights(history, row.currency, fxRateMap);
        return {
          ...row,
          priceHistory: history,
          ...(insights || {}),
        };
      }),
    );
    setSelected((current) => {
      if (!current || String(current.symbol || "").toUpperCase() !== symbolKey) {
        return current;
      }
      const insights = computeHistoryInsights(history, current.currency, fxRateMap);
      return {
        ...current,
        priceHistory: history,
        ...(insights || {}),
      };
    });
  }, [fxRateMap]);

  const hydrateHistoryForSymbol = useCallback(async (symbol, reportError = false) => {
    const symbolKey = String(symbol || "").toUpperCase();
    if (!symbolKey) {
      return;
    }
    if (loadedHistorySymbolsRef.current.has(symbolKey)) {
      return;
    }
    if (loadingHistorySymbolsRef.current.has(symbolKey)) {
      return;
    }

    loadingHistorySymbolsRef.current.add(symbolKey);
    if (String(selected?.symbol || "").toUpperCase() === symbolKey) {
      setLoadingHistoryFor(symbolKey);
    }

    try {
      const response = await apiFetch(
        `/api/assets/price-history?query=${encodeURIComponent(symbolKey)}&days=${HISTORY_LOOKBACK_DAYS}`,
      );
      const history = (response?.items || [])
        .map((item) => ({
          date: item.tradeDate,
          price: toFiniteNumber(item.close, NaN),
        }))
        .filter((point) => Number.isFinite(point.price));
      applyHistoryToSymbol(symbolKey, history);
      loadedHistorySymbolsRef.current.add(symbolKey);
    } catch (requestError) {
      if (reportError) {
        setError(
          requestError.message || `Failed to load price history for ${symbolKey}.`,
        );
      }
    } finally {
      loadingHistorySymbolsRef.current.delete(symbolKey);
      setLoadingHistoryFor((current) => (current === symbolKey ? "" : current));
    }
  }, [applyHistoryToSymbol, selected?.symbol]);

  useEffect(() => {
    rows.forEach((row) => {
      if (!row?.symbol || row?.priceHistory?.length) {
        return;
      }
      void hydrateHistoryForSymbol(row.symbol);
    });
  }, [rows, hydrateHistoryForSymbol]);

  useEffect(() => {
    const symbol = String(selected?.symbol || "").toUpperCase();
    if (!symbol || selected?.priceHistory?.length) {
      return;
    }
    void hydrateHistoryForSymbol(symbol, true);
  }, [selected?.symbol, selected?.priceHistory?.length, hydrateHistoryForSymbol]);

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

  const addSymbolToWatchlist = useCallback(async (candidate) => {
    if (!requireLogin("add symbols to watchlist")) {
      return;
    }

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
      const row = mapWatchlistItemToRow(created, null, null, false, fxRateMap);
      setRows((currentRows) => [row, ...currentRows.filter((item) => item.symbol !== row.symbol)]);
      setSelected(row);
      setNotice(`${row.symbol} has been added to watchlist.`);
      setSearchTerm("");
      setSuggestionRows([]);
      setShowSuggestions(false);
    } catch (requestError) {
      setError(requestError.message || "Failed to add the symbol to watchlist.");
      await loadWatchlist();
    } finally {
      setSavingSymbol("");
    }
  }, [fxRateMap, loadWatchlist, requireLogin]);

  const removeSelectedFromWatchlist = useCallback(async () => {
    if (!requireLogin("remove symbols from watchlist")) {
      return;
    }

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
      setRows((currentRows) => {
        const nextRows = currentRows.filter((row) => row.assetId !== selected.assetId);
        saveFavouriteSymbols(nextRows);
        return nextRows;
      });
      setSelected(null);
      setNotice(`${selected.symbol} has been removed from watchlist.`);
    } catch (requestError) {
      setError(requestError.message || "Failed to remove watchlist item.");
    } finally {
      setSavingSymbol("");
    }
  }, [selected, requireLogin]);

  const submitTrade = useCallback(async () => {
    if (!requireLogin("submit trades")) {
      return;
    }

    if (!selected?.assetId || !tradeModal.type) {
      return;
    }

    const normalizedQuantity = Number(effectiveTradeQuantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setError("Enter a valid share amount or cash amount before submitting.");
      return;
    }

    if (tradeModal.type === "buy" && isOverBalance) {
      setError("Insufficient available cash balance for this buy order.");
      return;
    }

    if (tradeModal.type === "sell" && isOverHolding) {
      setError("Insufficient holding quantity for this sell order.");
      return;
    }

    const normalizedPrice = Number(latestPrice);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setError(`Missing valid latest price for ${selected.symbol}.`);
      return;
    }

    setTradeSubmitting(true);
    setError("");
    setNotice("");

    try {
      const endpoint = tradeModal.type === "buy" ? "/api/trades/buy" : "/api/trades/sell";
      const bizId = `watchlist-${tradeModal.type}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

      await apiFetch(endpoint, {
        method: "POST",
        body: {
          userId: DEFAULT_USER_ID,
          assetId: selected.assetId,
          quantity: Number(normalizedQuantity.toFixed(6)),
          price: Number(normalizedPrice.toFixed(6)),
          fee: 0,
          bizId,
          note: `Submitted from watchlist (${tradeModal.type})`,
        },
      });

      const side = tradeModal.type === "buy" ? "buy" : "sell";
      const usdPrice = toUsdAmount(normalizedPrice, selected?.currency);
      const displayPrice = usdPrice === null ? "N/A" : formatCurrency(usdPrice, USD_CURRENCY);
      setConfirmation(
        `${selected.symbol} ${side} order submitted: ${normalizedQuantity.toFixed(4)} shares @ ${displayPrice}.`,
      );
      setTradeModal({ open: false, type: null });
      setTradeAmount("");
      setTradeCashAmount("");
      await loadWatchlist();
    } catch (requestError) {
      setError(requestError.message || "Failed to submit trade.");
    } finally {
      setTradeSubmitting(false);
    }
  }, [
    selected,
    tradeModal.type,
    effectiveTradeQuantity,
    isOverBalance,
    isOverHolding,
    latestPrice,
    loadWatchlist,
    requireLogin,
    selected?.currency,
    toUsdAmount,
  ]);

  const hasBondRows = useMemo(
    () => rows.some((row) => row.type === "Bond"),
    [rows],
  );

  useEffect(() => {
    if (activeTab === "bonds" && !hasBondRows) {
      setActiveTab("all");
    }
  }, [activeTab, hasBondRows]);

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
          const value = `${row.symbol} ${row.type} ${row.name}`.toLowerCase();
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

  const horizonFilteredRows = useMemo(() => {
    if (!showRankings) {
      return filteredRows;
    }

    const minHorizon = horizonMap[rankingHorizon] || 1;
    const matched = filteredRows.filter((row) => (row.horizonMonths || 1) >= minHorizon);
    return matched.length ? matched : filteredRows;
  }, [showRankings, filteredRows, rankingHorizon]);

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
      {!isLoggedIn && (
        <p className="watchlist-note">
          Guest mode: view and search only. Add, remove, favourite, and trade actions are disabled.
        </p>
      )}
      {loading && <p className="watchlist-note">Loading watchlist...</p>}
      {loadingHistoryFor && (
        <p className="watchlist-note">
          Loading {loadingHistoryFor} price history...
        </p>
      )}
      {(savingSymbol || tradeSubmitting) && (
        <p className="watchlist-note">
          {tradeSubmitting ? "Submitting trade..." : `Syncing ${savingSymbol}...`}
        </p>
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
          showBondTab={hasBondRows}
        />
        <WatchlistDetail
          selected={selected}
          isRemoving={savingSymbol === selected?.symbol}
          interactionDisabled={!isLoggedIn}
          toUsdAmount={toUsdAmount}
          onRemove={removeSelectedFromWatchlist}
          onToggleFavourite={(symbol) => {
            if (!requireLogin("toggle favourites")) {
              return;
            }
            setRows((current) => {
              const nextRows = current.map((row) =>
                row.symbol === symbol
                  ? { ...row, isFavourite: !row.isFavourite }
                  : row,
              );
              saveFavouriteSymbols(nextRows);
              return nextRows;
            });
            setSelected((current) =>
              current && current.symbol === symbol
                ? { ...current, isFavourite: !current.isFavourite }
                : current,
            );
          }}
          onTrade={(type) => {
            if (!requireLogin("open trade orders")) {
              return;
            }
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
        cashBalanceDisplay={cashBalanceDisplay}
        isOverBalance={isOverBalance}
        isOverHolding={isOverHolding}
        stockCashValueDisplay={stockCashValueDisplay}
        calculatedCashDisplay={calculatedCashDisplay}
        confirmation={confirmation}
        setConfirmation={setConfirmation}
        onConfirmTrade={submitTrade}
        tradeSubmitting={tradeSubmitting}
        interactionDisabled={!isLoggedIn}
      />
    </section>
  );
}
