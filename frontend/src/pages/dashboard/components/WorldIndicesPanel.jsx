import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";

const PAGE_SIZE = 5;
const ROTATE_INTERVAL_MS = 5000;
const PROGRESS_TICK_MS = 120;
const LOOKBACK_DAYS = 30;
const REQUEST_TIMEOUT_MS = 8000;
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_REFETCH_INTERVAL_MS = 5 * 60 * 1000;
const MISSING_RETRY_INTERVAL_MS = 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 2;
const REFRESH_BATCH_SIZE = PAGE_SIZE;
const DEFAULT_WORLD_INDICES = [
  { symbol: "SPX", name: "S&P 500", region: "US" },
  { symbol: "IXIC", name: "NASDAQ Composite", region: "US" },
  { symbol: "DJI", name: "Dow Jones", region: "US" },
  { symbol: "RUT", name: "Russell 2000", region: "US" },
  { symbol: "VIX", name: "CBOE Volatility Index", region: "US" },
  { symbol: "FTSE", name: "FTSE 100", region: "UK" },
  { symbol: "GDAXI", name: "DAX", region: "DE" },
  { symbol: "FCHI", name: "CAC 40", region: "FR" },
  { symbol: "N225", name: "Nikkei 225", region: "JP" },
  { symbol: "HSI", name: "Hang Seng", region: "HK" },
  { symbol: "000300.SH", name: "CSI 300", region: "CN" },
  { symbol: "BSESN", name: "Sensex", region: "IN" },
  { symbol: "NSEI", name: "Nifty 50", region: "IN" },
  { symbol: "AXJO", name: "S&P/ASX 200", region: "AU" },
  { symbol: "KS11", name: "KOSPI", region: "KR" },
  { symbol: "TSX", name: "S&P/TSX Composite", region: "CA" },
  { symbol: "STI", name: "Straits Times", region: "SG" },
  { symbol: "TWII", name: "TAIEX", region: "TW" },
  { symbol: "IBOV", name: "Ibovespa", region: "BR" },
];

const CN_BENCHMARK_ALIASES = new Set([
  "000300.SH",
  "SSEC",
  "000001.SH",
  "000001.SS",
  "SHCOMP",
  "SH000001",
]);

const CN_DISABLED_SYMBOLS = new Set([
  "SSEC",
  "000001.SH",
  "000001.SS",
  "SHCOMP",
  "SH000001",
]);

function buildEmptySnapshot(indexItem) {
  const latest = toNumber(indexItem?.latestClose);
  const previous = toNumber(indexItem?.previousClose);
  const change = Number.isFinite(latest) && Number.isFinite(previous) ? latest - previous : null;
  const changePct = Number.isFinite(change) && Number.isFinite(previous) && previous !== 0
    ? (change / previous) * 100
    : null;
  const hasDbLatest = Number.isFinite(latest);
  const dbRefreshedAt = toDateOrNull(indexItem?.lastRefreshedAt);

  return {
    ...indexItem,
    latest: hasDbLatest ? latest : null,
    change,
    changePct,
    sparkline: [],
    available: hasDbLatest,
    warnings: [],
    refreshedAt: dbRefreshedAt,
    attemptedAt: hasDbLatest ? new Date() : null,
    latestTradeDate: indexItem?.latestTradeDate ?? null,
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOrNull(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function formatChange(change, changePct) {
  if (!Number.isFinite(change) || !Number.isFinite(changePct)) {
    return "N/A";
  }
  return `${formatSignedNumber(change)} (${formatSignedNumber(changePct, 2)}%)`;
}

function formatRefreshTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "Not refreshed yet";
  }
  return `Refreshed ${value.toLocaleTimeString()}`;
}

function toSparklinePolyline(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return "";
  }

  const width = 120;
  const height = 30;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1e-9);

  return points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function Sparkline({ points, tone }) {
  const polyline = toSparklinePolyline(points);
  if (!polyline) {
    return <span className="world-index-sparkline-empty">N/A</span>;
  }

  return (
    <svg className={`world-index-sparkline ${tone}`} viewBox="0 0 120 30" aria-hidden="true">
      <polyline points={polyline} />
    </svg>
  );
}

async function fetchWithTimeout(path, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(path, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeIndexItem(raw) {
  const symbol = typeof raw?.symbol === "string" ? raw.symbol.trim().toUpperCase() : "";
  if (!symbol) {
    return null;
  }
  if (CN_DISABLED_SYMBOLS.has(symbol)) {
    return null;
  }

  const name = typeof raw?.name === "string" && raw.name.trim()
    ? raw.name.trim()
    : symbol;
  const region = typeof raw?.region === "string" && raw.region.trim()
    ? raw.region.trim().toUpperCase()
    : "N/A";
  const latestTradeDate = toDateOrNull(raw?.latestTradeDate);
  const latestClose = toNumber(raw?.latestClose);
  const previousClose = toNumber(raw?.previousClose);
  const lastRefreshedAt = toDateOrNull(raw?.lastRefreshedAt);

  return {
    symbol,
    name,
    region,
    latestTradeDate,
    latestClose,
    previousClose,
    lastRefreshedAt,
  };
}

function mergeWithDefaultIndices(configuredItems) {
  const merged = new Map();
  DEFAULT_WORLD_INDICES.forEach((item) => merged.set(item.symbol, item));
  configuredItems.forEach((item) => {
    if (!item?.symbol) {
      return;
    }
    const base = merged.get(item.symbol);
    merged.set(item.symbol, base ? { ...base, ...item } : item);
  });

  const values = Array.from(merged.values());
  const primaryCnBenchmark = values.find((item) => item.symbol === "000300.SH")
    || values.find((item) => CN_BENCHMARK_ALIASES.has(item.symbol));

  if (!primaryCnBenchmark) {
    return values;
  }

  return values.filter((item) => (
    !CN_BENCHMARK_ALIASES.has(item.symbol)
      || item.symbol === primaryCnBenchmark.symbol
  ));
}

async function fetchIndexSnapshot(indexItem) {
  const attemptedAt = new Date();
  try {
    const payload = await fetchWithTimeout(
      `/api/assets/price-history?query=${encodeURIComponent(indexItem.symbol)}&days=${LOOKBACK_DAYS}`,
    );
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const closes = items
      .map((point) => toNumber(point?.close))
      .filter((value) => Number.isFinite(value));

    const latest = closes.length ? closes[closes.length - 1] : null;
    const previous = closes.length > 1 ? closes[closes.length - 2] : null;
    const change = Number.isFinite(latest) && Number.isFinite(previous) ? latest - previous : null;
    const changePct = Number.isFinite(change) && Number.isFinite(previous) && previous !== 0
      ? (change / previous) * 100
      : null;
    const warnings = Array.isArray(payload?.warnings)
      ? payload.warnings.filter((item) => typeof item === "string" && item.trim())
      : [];
    const latestPoint = [...items].reverse().find(
      (point) => Number.isFinite(toNumber(point?.close)) && point?.tradeDate,
    );
    const latestTradeDate = toDateOrNull(latestPoint?.tradeDate) || indexItem.latestTradeDate || null;

    return {
      ...indexItem,
      latest,
      change,
      changePct,
      sparkline: closes.slice(-20),
      available: closes.length > 0,
      warnings,
      refreshedAt: closes.length > 0 ? attemptedAt : null,
      attemptedAt,
      latestTradeDate,
    };
  } catch (error) {
    return {
      ...buildEmptySnapshot(indexItem),
      warnings: [error instanceof Error ? error.message : "Request failed."],
      refreshedAt: null,
      attemptedAt,
    };
  }
}

async function fetchIndexSnapshotsWithLimit(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const snapshots = [];
  for (let i = 0; i < items.length; i += MAX_CONCURRENT_REQUESTS) {
    const chunk = items.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const settled = await Promise.allSettled(chunk.map((item) => fetchIndexSnapshot(item)));
    settled.forEach((result, index) => {
      snapshots.push(
        result.status === "fulfilled"
          ? result.value
          : buildEmptySnapshot(chunk[index]),
      );
    });
  }
  return snapshots;
}

export default function WorldIndicesPanel() {
  const [indexItems, setIndexItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageProgress, setPageProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const refreshInFlightRef = useRef(false);
  const indexItemsRef = useRef([]);
  const rowsRef = useRef([]);

  useEffect(() => {
    indexItemsRef.current = indexItems;
  }, [indexItems]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(indexItems.length / PAGE_SIZE)),
    [indexItems.length],
  );

  const rowBySymbol = useMemo(
    () => new Map(rows.map((item) => [item.symbol, item])),
    [rows],
  );

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return indexItems
      .slice(start, start + PAGE_SIZE)
      .map((item) => rowBySymbol.get(item.symbol) || buildEmptySnapshot(item));
  }, [indexItems, pageIndex, rowBySymbol]);

  const refreshData = useCallback(async (targetItems, options = {}) => {
    if (refreshInFlightRef.current) {
      return;
    }

    const showLoading = Boolean(options.showLoading);
    const force = Boolean(options.force);
    const batchSize = Number.isFinite(options.batchSize) && options.batchSize > 0
      ? Math.floor(options.batchSize)
      : REFRESH_BATCH_SIZE;
    const now = Date.now();
    const existingBySymbol = new Map(rowsRef.current.map((item) => [item.symbol, item]));
    let pendingItems = Array.isArray(targetItems)
      ? targetItems.filter((item) => {
        if (!item?.symbol) {
          return false;
        }
        if (force) {
          return true;
        }
        const existing = existingBySymbol.get(item.symbol);
        if (!existing) {
          return true;
        }

        const attemptedAt = existing.attemptedAt instanceof Date
          ? existing.attemptedAt.getTime()
          : NaN;
        const elapsedMs = Number.isFinite(attemptedAt) ? now - attemptedAt : Number.POSITIVE_INFINITY;
        const hasLocalHistory = existing.latestTradeDate instanceof Date && !Number.isNaN(existing.latestTradeDate.getTime());
        const requiredIntervalMs = hasLocalHistory ? MIN_REFETCH_INTERVAL_MS : MISSING_RETRY_INTERVAL_MS;
        return elapsedMs >= requiredIntervalMs;
      })
      : [];

    pendingItems = pendingItems
      .sort((a, b) => {
        const aExisting = existingBySymbol.get(a.symbol);
        const bExisting = existingBySymbol.get(b.symbol);
        const aLatestDate = toDateOrNull(aExisting?.latestTradeDate) || toDateOrNull(a.latestTradeDate);
        const bLatestDate = toDateOrNull(bExisting?.latestTradeDate) || toDateOrNull(b.latestTradeDate);
        const aMissing = !(aLatestDate instanceof Date);
        const bMissing = !(bLatestDate instanceof Date);
        if (aMissing !== bMissing) {
          return aMissing ? -1 : 1;
        }
        if (aMissing && bMissing) {
          return a.symbol.localeCompare(b.symbol);
        }
        const dateGap = aLatestDate.getTime() - bLatestDate.getTime();
        if (dateGap !== 0) {
          return dateGap;
        }
        return a.symbol.localeCompare(b.symbol);
      })
      .slice(0, batchSize);

    if (pendingItems.length === 0) {
      return;
    }

    refreshInFlightRef.current = true;

    if (showLoading) {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      const snapshots = await fetchIndexSnapshotsWithLimit(pendingItems);
      setRows((current) => {
        const updatesBySymbol = new Map(snapshots.map((item) => [item.symbol, item]));
        return current.map((item) => {
          const next = updatesBySymbol.get(item.symbol);
          if (!next) {
            return item;
          }
          // Keep the last good snapshot when refresh is throttled or fails.
          if (!next.available && item.available) {
            return {
              ...item,
              warnings: Array.isArray(next.warnings) ? next.warnings : item.warnings,
              attemptedAt: next.attemptedAt instanceof Date ? next.attemptedAt : item.attemptedAt,
            };
          }
          return next;
        });
      });

      if (snapshots.every((item) => !item.available)) {
        const warning = snapshots
          .flatMap((item) => (Array.isArray(item.warnings) ? item.warnings : []))
          .find((item) => typeof item === "string" && item.trim());
        setErrorMessage(warning || "No index data was returned for this refresh.");
      }
    } catch (error) {
      setErrorMessage("Failed to refresh global index data.");
    } finally {
      refreshInFlightRef.current = false;
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadIndices = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const payload = await fetchWithTimeout("/api/assets/world-indices");
      const configuredItems = Array.isArray(payload?.items)
        ? payload.items.map(normalizeIndexItem).filter((item) => item !== null)
        : [];
      const items = mergeWithDefaultIndices(configuredItems);

      setIndexItems(items);
      setRows((current) => {
        const existingBySymbol = new Map(current.map((item) => [item.symbol, item]));
        return items.map((item) => {
          const existing = existingBySymbol.get(item.symbol);
          if (!existing) {
            return buildEmptySnapshot(item);
          }
          return {
            ...item,
            ...existing,
            latestTradeDate: toDateOrNull(existing.latestTradeDate) || toDateOrNull(item.latestTradeDate),
            refreshedAt: toDateOrNull(existing.refreshedAt) || toDateOrNull(item.lastRefreshedAt),
          };
        });
      });
      setPageIndex(0);

      if (items.length === 0) {
        setIsLoading(false);
        setErrorMessage("No world indices configured in database.");
        return;
      }

      setIsLoading(false);
    } catch (error) {
      const fallbackItems = indexItemsRef.current.length > 0
        ? indexItemsRef.current
        : DEFAULT_WORLD_INDICES;
      setIndexItems(fallbackItems);
      setRows((current) => {
        const existingBySymbol = new Map(current.map((item) => [item.symbol, item]));
        return fallbackItems.map((item) => existingBySymbol.get(item.symbol) || buildEmptySnapshot(item));
      });
      setIsLoading(false);
      setErrorMessage("Failed to load world indices config. Showing cached/default indices.");
    }
  }, [refreshData]);

  useEffect(() => {
    loadIndices();
  }, [loadIndices]);

  useEffect(() => {
    setPageIndex((current) => {
      if (current < totalPages) {
        return current;
      }
      return 0;
    });
  }, [totalPages]);

  useEffect(() => {
    if (totalPages <= 1) {
      setPageProgress(100);
      return undefined;
    }

    const startedAt = Date.now();
    let hasRotated = false;
    setPageProgress(0);

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, (elapsed / ROTATE_INTERVAL_MS) * 100);
      setPageProgress(nextProgress);

      if (elapsed >= ROTATE_INTERVAL_MS && !hasRotated) {
        hasRotated = true;
        setPageIndex((current) => (current + 1) % totalPages);
      }
    }, PROGRESS_TICK_MS);

    return () => window.clearInterval(timer);
  }, [pageIndex, totalPages]);

  useEffect(() => {
    if (indexItems.length === 0) {
      return undefined;
    }

    refreshData(indexItems, { batchSize: REFRESH_BATCH_SIZE });
  }, [indexItems, pageIndex, refreshData]);

  useEffect(() => {
    if (indexItems.length === 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      refreshData(indexItems, { batchSize: REFRESH_BATCH_SIZE });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [indexItems, pageIndex, refreshData]);

  const statusText = isLoading
    ? "Loading index board..."
    : indexItems.length === 0
      ? "No indices configured"
      : "Auto refresh every 5 minutes";

  const pageText = indexItems.length === 0 ? "0/0" : `${pageIndex + 1}/${totalPages}`;

  return (
    <section className="feature-card world-indices-panel">
      <div className="world-indices-head">
        <h3>World Indices</h3>
        <div className="world-indices-actions">
          <span className="world-indices-page">Page {pageText}</span>
          <div className="slide-progress world-indices-progress" aria-hidden="true">
            <div
              className="slide-progress-bar world-indices-progress-bar"
              style={{ width: `${pageProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="world-indices-status-row">
        <strong>{statusText}</strong>
        {errorMessage ? <span>{errorMessage}</span> : null}
      </div>

      <div className="world-indices-list">
        {pageRows.map((item) => {
          const tone = Number.isFinite(item.change) && item.change > 0
            ? "positive"
            : Number.isFinite(item.change) && item.change < 0
              ? "negative"
              : "";
          return (
            <article key={item.symbol} className="world-index-row">
              <div className="world-index-main">
                <strong>{item.name}</strong>
                <span>{item.symbol} · {item.region}</span>
                <p className={`world-index-main-line ${tone}`}>
                  {formatPrice(item.latest)} · {formatChange(item.change, item.changePct)}
                </p>
                <span className="world-index-refresh-time">{formatRefreshTime(item.refreshedAt)}</span>
              </div>
              <div className="world-index-trend">
                <Sparkline points={item.sparkline} tone={tone} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
