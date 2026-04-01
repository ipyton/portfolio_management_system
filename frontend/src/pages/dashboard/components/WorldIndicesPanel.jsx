import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";

const PAGE_SIZE = 5;
const ROTATE_INTERVAL_MS = 30000;
const LOOKBACK_DAYS = 30;
const REQUEST_TIMEOUT_MS = 8000;
const AUTO_REFRESH_INTERVAL_MS = Math.max(
  15000,
  Number(import.meta.env.VITE_WORLD_INDICES_REFRESH_MS || 90000),
);

const WORLD_INDICES = [
  { symbol: "SPX", name: "S&P 500", region: "US" },
  { symbol: "IXIC", name: "NASDAQ Composite", region: "US" },
  { symbol: "DJI", name: "Dow Jones", region: "US" },
  { symbol: "FTSE", name: "FTSE 100", region: "UK" },
  { symbol: "GDAXI", name: "DAX", region: "DE" },
  { symbol: "FCHI", name: "CAC 40", region: "FR" },
  { symbol: "N225", name: "Nikkei 225", region: "JP" },
  { symbol: "HSI", name: "Hang Seng", region: "HK" },
  { symbol: "000300.SH", name: "CSI 300", region: "CN" },
  { symbol: "SSEC", name: "SSE Composite", region: "CN" },
  { symbol: "BSESN", name: "Sensex", region: "IN" },
  { symbol: "NSEI", name: "Nifty 50", region: "IN" },
  { symbol: "AXJO", name: "S&P/ASX 200", region: "AU" },
  { symbol: "KS11", name: "KOSPI", region: "KR" },
  { symbol: "TSX", name: "S&P/TSX Composite", region: "CA" },
];

function buildEmptySnapshot(indexItem) {
  return {
    ...indexItem,
    latest: null,
    change: null,
    changePct: null,
    sparkline: [],
    available: false,
    warnings: [],
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

async function fetchIndexSnapshot(indexItem) {
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

    return {
      ...indexItem,
      latest,
      change,
      changePct,
      sparkline: closes.slice(-20),
      available: closes.length > 0,
      warnings,
    };
  } catch (error) {
    return {
      ...buildEmptySnapshot(indexItem),
      warnings: [error instanceof Error ? error.message : "Request failed."],
    };
  }
}

export default function WorldIndicesPanel() {
  const [rows, setRows] = useState(() => WORLD_INDICES.map((item) => buildEmptySnapshot(item)));
  const [pageIndex, setPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const refreshInFlightRef = useRef(false);
  const nextAutoPageRef = useRef(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(WORLD_INDICES.length / PAGE_SIZE)),
    [],
  );

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, pageIndex]);

  const refreshData = useCallback(async (targetItems, options = {}) => {
    if (refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;

    const showLoading = Boolean(options.showLoading);
    if (showLoading) {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      const settled = await Promise.allSettled(targetItems.map((item) => fetchIndexSnapshot(item)));
      const snapshots = settled.map((result, index) => (
        result.status === "fulfilled"
          ? result.value
          : buildEmptySnapshot(targetItems[index])
      ));
      setRows((current) => {
        const updatesBySymbol = new Map(snapshots.map((item) => [item.symbol, item]));
        return current.map((item) => updatesBySymbol.get(item.symbol) || item);
      });
      setUpdatedAt(new Date());

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

  useEffect(() => {
    refreshData(WORLD_INDICES.slice(0, PAGE_SIZE), { showLoading: true });
  }, [refreshData]);

  useEffect(() => {
    setPageIndex((current) => {
      if (current < totalPages) {
        return current;
      }
      return 0;
    });
  }, [totalPages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPageIndex((current) => (current + 1) % totalPages);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [totalPages]);

  useEffect(() => {
    const timer = setInterval(() => {
      const targetPage = nextAutoPageRef.current % totalPages;
      const start = targetPage * PAGE_SIZE;
      const targetItems = WORLD_INDICES.slice(start, start + PAGE_SIZE);
      refreshData(targetItems);
      nextAutoPageRef.current = (targetPage + 1) % totalPages;
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshData, totalPages]);

  const statusText = isLoading
    ? "Loading index board..."
    : updatedAt
      ? `Updated ${updatedAt.toLocaleTimeString()}`
      : "No updates yet";

  return (
    <section className="feature-card world-indices-panel">
      <div className="world-indices-head">
        <h3>World Indices</h3>
        <div className="world-indices-actions">
          <span className="world-indices-page">Page {pageIndex + 1}/{totalPages}</span>
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
