import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_USER_ID,
  apiFetch,
  classForDelta,
  formatCurrency,
  formatDate,
  formatSignedPercent,
} from "../../lib/api";

export const watchlistPageMeta = {
  eyebrow: "Priority Watchlist",
  title: "Keep conviction names close and fast to inspect.",
  description:
    "Search the asset catalog, inspect detail, and add or remove names from the watchlist.",
  metrics: [],
};

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function PriceHistoryChart({ points }) {
  if (!points?.length) {
    return (
      <div className="history-empty">
        <strong>No price history</strong>
        <p>No daily close data returned for this symbol.</p>
      </div>
    );
  }

  const width = 560;
  const height = 180;
  const padding = 12;
  const values = points.map((item) => Number(item.close)).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return (
      <div className="history-empty">
        <strong>No price history</strong>
        <p>No valid close values returned.</p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const path = points
    .map((item, index) => {
      const x = padding + index * stepX;
      const y = padding + ((max - Number(item.close)) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaPct = first === 0 ? 0 : delta / first;

  return (
    <div className="history-chart">
      <div className="history-meta">
        <span>30D Trend</span>
        <strong className={classForDelta(delta)}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)} ({(deltaPct * 100).toFixed(2)}%)
        </strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Price trend chart">
        <path d={path} className="history-line" />
      </svg>
    </div>
  );
}

function CorrelationMeter({ value }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  const normalized = Math.max(0, Math.min(100, ((Number(value) + 1) / 2) * 100));
  return (
    <div className="correlation-meter">
      <div className="correlation-meter-track">
        <span className="correlation-meter-mid" />
        <span className="correlation-meter-dot" style={{ left: `${normalized}%` }} />
      </div>
      <div className="correlation-meter-labels">
        <span>-1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  );
}

export default function WatchlistPage({ meta }) {
  const [watchlist, setWatchlist] = useState([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [searching, setSearching] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [correlation, setCorrelation] = useState(null);
  const [correlationLoading, setCorrelationLoading] = useState(false);
  const [correlationError, setCorrelationError] = useState("");

  async function refreshWatchlist() {
    const response = await apiFetch(`/api/watchlists?userId=${DEFAULT_USER_ID}`);
    const items = response.items || [];
    setWatchlist(items);
    return items;
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const items = await refreshWatchlist();
        if (!cancelled) {
          setSelectedSymbol(items[0]?.symbol || "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const keyword = query.trim();

    if (!keyword) {
      setSuggestions([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setActionError("");
        const response = await apiFetch(
          `/api/assets/suggestions?query=${encodeURIComponent(keyword)}&limit=6`,
        );
        if (!cancelled) {
          setSuggestions(response.items || []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setActionError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const selectedWatchlistItem = useMemo(
    () => watchlist.find((item) => item.symbol === selectedSymbol) || null,
    [selectedSymbol, watchlist],
  );

  const databaseDetail = selectedAsset?.database;
  const remoteDetail = selectedAsset?.yahooFinance;
  const resolvedSymbol = (selectedAsset?.resolvedSymbol || selectedSymbol || "").toUpperCase();
  const symbolMatchedWatchlistItem = watchlist.find(
    (item) => (item.symbol || "").toUpperCase() === resolvedSymbol,
  );
  const trackedAssetId = databaseDetail?.assetId || selectedWatchlistItem?.assetId;
  const effectiveAssetId = trackedAssetId || symbolMatchedWatchlistItem?.assetId || null;
  const inWatchlist = trackedAssetId
    ? watchlist.some((item) => item.assetId === trackedAssetId)
    : watchlist.some((item) => (item.symbol || "").toUpperCase() === resolvedSymbol);
  const displayName =
    databaseDetail?.name ||
    selectedWatchlistItem?.name ||
    remoteDetail?.longName ||
    remoteDetail?.shortName ||
    selectedSymbol;
  const displayAssetType = databaseDetail?.assetType || remoteDetail?.quoteType || "Unknown";
  const displayExchange =
    databaseDetail?.exchange || selectedWatchlistItem?.exchange || remoteDetail?.exchange || "N/A";
  const displayRegion =
    databaseDetail?.region || selectedWatchlistItem?.region || remoteDetail?.region || "N/A";
  const displayCurrency =
    databaseDetail?.currency || selectedWatchlistItem?.currency || remoteDetail?.currency || "USD";
  const displayPrice =
    databaseDetail?.latestDbPrice ?? selectedWatchlistItem?.latestClose ?? remoteDetail?.regularMarketPrice;
  const displaySector = databaseDetail?.sector || remoteDetail?.sector || "N/A";
  const displayIndustry = databaseDetail?.industry || remoteDetail?.industry || "N/A";
  const displayPriceDate =
    databaseDetail?.latestDbTradeDate || selectedWatchlistItem?.latestTradeDate;
  const sourceLabel =
    databaseDetail || selectedWatchlistItem ? "Database" : remoteDetail ? "Finnhub" : "Search";
  const priceLabel = databaseDetail || selectedWatchlistItem ? "Latest DB Price" : "Latest Market Price";
  const historyQuery = selectedAsset?.resolvedSymbol || selectedSymbol;
  const canMutateWatchlist = Boolean(effectiveAssetId || resolvedSymbol);

  async function handleSearch(rawQuery = query) {
    const keyword = rawQuery.trim();
    if (!keyword) {
      setActionError("Enter a symbol or name to search.");
      return;
    }

    setDetailLoading(true);
    setActionError("");

    try {
      const response = await apiFetch(
        `/api/assets/search?query=${encodeURIComponent(keyword)}`,
      );
      setSelectedAsset(response);
      setSelectedSymbol(response.resolvedSymbol || keyword.toUpperCase());
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    handleSearch();
  }

  useEffect(() => {
    let cancelled = false;
    if (!historyQuery) {
      setPriceHistory([]);
      return undefined;
    }

    async function loadHistory() {
      setPriceHistoryLoading(true);
      try {
        const response = await apiFetch(
          `/api/assets/price-history?query=${encodeURIComponent(historyQuery)}&days=30`,
        );
        if (!cancelled) {
          setPriceHistory(response.items || []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPriceHistory([]);
        }
      } finally {
        if (!cancelled) {
          setPriceHistoryLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [historyQuery]);

  useEffect(() => {
    let cancelled = false;
    const symbol = (selectedAsset?.resolvedSymbol || selectedSymbol || "").trim();
    if (!symbol) {
      setCorrelation(null);
      setCorrelationError("");
      return undefined;
    }

    async function loadCorrelation() {
      setCorrelationLoading(true);
      setCorrelationError("");
      try {
        const response = await apiFetch(
          `/api/portfolio/analysis/correlation?userId=${DEFAULT_USER_ID}&symbol=${encodeURIComponent(symbol)}&days=120`,
        );
        if (!cancelled) {
          setCorrelation(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCorrelation(null);
          setCorrelationError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setCorrelationLoading(false);
        }
      }
    }

    loadCorrelation();
    return () => {
      cancelled = true;
    };
  }, [selectedAsset, selectedSymbol]);

  async function handleAddOrRemove() {
    if (!effectiveAssetId && !resolvedSymbol) {
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      if (inWatchlist) {
        if (!effectiveAssetId) {
          throw new Error("Unable to resolve asset id for watchlist removal.");
        }
        await apiFetch(`/api/watchlists/${effectiveAssetId}?userId=${DEFAULT_USER_ID}`, {
          method: "DELETE",
        });
      } else {
        await apiFetch("/api/watchlists", {
          method: "POST",
          body: {
            userId: DEFAULT_USER_ID,
            assetId: effectiveAssetId,
            symbol: resolvedSymbol || null,
            name: displayName || null,
            currency: displayCurrency || null,
            exchange: displayExchange === "N/A" ? null : displayExchange,
            region: displayRegion === "N/A" ? null : displayRegion,
            note: "Added from portfolio console",
          },
        });
      }

      const items = await refreshWatchlist();
      if (!items.some((item) => (item.symbol || "").toUpperCase() === resolvedSymbol)) {
        setSelectedAsset(null);
        setSelectedSymbol(items[0]?.symbol || "");
      }
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="hero-panel">
        <p className="eyebrow">{meta.eyebrow}</p>
        <div className="hero-heading-row">
          <div>
            <h1>{meta.title}</h1>
            <p className="hero-copy">{meta.description}</p>
          </div>
          <div className="hero-status-card">
            <span>Watchlist</span>
            <strong>{error ? "Request failed" : loading ? "Requesting data" : "Watchlist synced"}</strong>
            <p>
              {loading
                ? "Loading watchlist."
                : error
                  ? error
                  : `${watchlist.length} assets currently tracked for user ${DEFAULT_USER_ID}.`}
            </p>
          </div>
        </div>

        <div className="hero-metrics">
          <article className="hero-metric">
            <span>Tracked Assets</span>
            <strong>{watchlist.length}</strong>
            <p>Returned by `/api/watchlists`</p>
          </article>
          <article className="hero-metric">
            <span>Selected Symbol</span>
            <strong>{selectedSymbol || "N/A"}</strong>
            <p>Search result or selected watchlist row</p>
          </article>
          <article className="hero-metric">
            <span>Search State</span>
            <strong>{searching ? "Searching" : "Ready"}</strong>
            <p>Suggestions from `/api/assets/suggestions`</p>
          </article>
        </div>
      </section>

      <section className="watchlist-shell watchlist-component">
        <div className="watchlist-header">
          <div>
            <p className="eyebrow">Search Assets</p>
            <h2 className="watchlist-title">Live watchlist workflow</h2>
          </div>
          <form className="watchlist-search-form" onSubmit={handleSearchSubmit}>
            <label className="watchlist-search">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search AAPL / MSFT / NVDA"
              />
            </label>
            <button type="submit" className="search-button" disabled={detailLoading}>
              {detailLoading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {actionError ? <p className="inline-error">{actionError}</p> : null}

        <div className="watchlist-grid">
          <section className="watchlist-panel">
            <div className="card-head">
              <span>Current Watchlist</span>
              <strong>{watchlist.length} names</strong>
            </div>
            <div className="watchlist-table">
              {watchlist.length === 0 ? (
                <EmptyState
                  title="Watchlist is empty"
                  description="Use search to add an asset to the watchlist."
                />
              ) : (
                watchlist.map((item) => (
                  <button
                    key={item.watchlistId}
                    type="button"
                    className={`watchlist-row${item.symbol === selectedSymbol ? " selected" : ""}`}
                    onClick={() => {
                      setSelectedAsset(null);
                      setSelectedSymbol(item.symbol);
                    }}
                  >
                    <div>
                      <strong className="ticker">{item.symbol}</strong>
                      <p>{item.name}</p>
                    </div>
                    <div>
                      <strong>{formatCurrency(item.latestClose, item.currency)}</strong>
                      <p className={classForDelta(item.dailyChangePercent)}>
                        {formatSignedPercent(item.dailyChangePercent)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="search-results">
              <div className="card-head">
                <span>Suggestions</span>
                <strong>{suggestions.length}</strong>
              </div>
              {!query.trim() ? (
                <EmptyState
                  title="Type to search"
                  description="Suggestions appear once you enter a symbol or name."
                />
              ) : (
                suggestions.map((item) => (
                  <button
                    key={`${item.assetId ?? "remote"}-${item.symbol}`}
                    type="button"
                    className="search-result"
                    onClick={() => {
                      setQuery(item.symbol);
                      setSuggestions([]);
                      handleSearch(item.symbol);
                    }}
                  >
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="watchlist-panel detail-panel">
            <div className="card-head">
              <span>Asset Detail</span>
              <strong>{selectedSymbol || "None selected"}</strong>
            </div>

            {detailLoading ? (
              <EmptyState
                title="Loading detail"
                description="Fetching asset detail from the backend."
              />
            ) : !selectedSymbol ? (
              <EmptyState
                title="Choose an asset"
                description="Select a watchlist row, or run a search to inspect detail."
              />
            ) : (
              <>
                <div className="asset-detail">
                  <div>
                    <span className="eyebrow">{sourceLabel}</span>
                    <h3>{displayName}</h3>
                    <p>
                      {displayAssetType} · {displayExchange} · {displayRegion}
                    </p>
                  </div>
                  <div className="stats-grid live-stats">
                    <div>
                      <span>{priceLabel}</span>
                      <strong>
                        {formatCurrency(displayPrice, displayCurrency)}
                      </strong>
                    </div>
                    <div>
                      <span>Sector</span>
                      <strong>{displaySector}</strong>
                    </div>
                    <div>
                      <span>Industry</span>
                      <strong>{displayIndustry}</strong>
                    </div>
                    <div>
                      <span>Price Date</span>
                      <strong>{displayPriceDate ? formatDate(displayPriceDate) : (remoteDetail?.marketState || "N/A")}</strong>
                    </div>
                  </div>
                </div>

                <div className="price-history-panel">
                  <div className="card-head">
                    <span>Price History</span>
                    <strong>{priceHistoryLoading ? "Loading..." : `${priceHistory.length} points`}</strong>
                  </div>
                  {priceHistoryLoading ? (
                    <EmptyState
                      title="Loading chart"
                      description="Fetching the latest 30-day daily close series."
                    />
                  ) : (
                    <PriceHistoryChart points={priceHistory} />
                  )}
                </div>

                <div className="correlation-panel">
                  <div className="card-head">
                    <span>Portfolio Correlation</span>
                    <strong>
                      {correlationLoading
                        ? "Calculating..."
                        : correlation?.correlation === null || correlation?.correlation === undefined
                          ? "N/A"
                          : Number(correlation.correlation).toFixed(3)}
                    </strong>
                  </div>
                  {correlationLoading ? (
                    <EmptyState
                      title="Calculating correlation"
                      description="Aligning asset and portfolio daily return series."
                    />
                  ) : correlationError ? (
                    <p className="inline-error">{correlationError}</p>
                  ) : !correlation ? (
                    <EmptyState
                      title="No correlation data"
                      description="Correlation result is unavailable for this symbol."
                    />
                  ) : (
                    <>
                      <CorrelationMeter value={correlation.correlation} />
                      <p className="correlation-hint">{correlation.riskHint || "No risk hint provided."}</p>
                      <p className="watchlist-note">
                        Based on {correlation.alignedObservations || 0} aligned daily observations.
                      </p>
                    </>
                  )}
                </div>

                {selectedAsset?.warnings?.length ? (
                  <div className="activity-list">
                    {selectedAsset.warnings.map((warning) => (
                      <div key={warning} className="activity-item">
                        <span className="activity-dot" />
                        <p>{warning}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="action-row">
                  <button
                    type="button"
                    onClick={handleAddOrRemove}
                    disabled={saving || !canMutateWatchlist}
                  >
                    {saving
                      ? "Saving..."
                      : inWatchlist
                        ? "Remove from Watchlist"
                        : "Add to Watchlist"}
                  </button>
                  {selectedWatchlistItem ? (
                    <p className="watchlist-note">
                      Added {formatDate(selectedWatchlistItem.addedAt)} ·{" "}
                      {selectedWatchlistItem.note || "No note"}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
