import React, { useEffect, useState } from "react";
import {
  DEFAULT_USER_ID,
  apiFetch,
  classForDelta,
  formatCurrency,
  formatDate,
  formatSignedPercent,
} from "../../lib/api";

export const dashboardPageMeta = {
  eyebrow: "Operations Dashboard",
  title: "Run the desk from one calm operational view.",
  description:
    "Holdings, cash balances, FX, and portfolio totals are loaded from backend APIs.",
  metrics: [],
};

function SummaryCard({ label, value, detail, tone }) {
  return (
    <article className="hero-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default function DashboardPage({ meta }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [analytics, holdings, cashBalances, fx] = await Promise.all([
          apiFetch(`/api/portfolio/dashboard?baseCurrency=CNY&userId=${DEFAULT_USER_ID}`),
          apiFetch(`/api/holdings?userId=${DEFAULT_USER_ID}`),
          apiFetch(`/api/cash-accounts?userId=${DEFAULT_USER_ID}`),
          apiFetch("/api/fx/latest?quoteCurrency=CNY"),
        ]);

        if (!cancelled) {
          setDashboard({ analytics, holdings, cashBalances, fx });
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

  const analytics = dashboard?.analytics || {};
  const realtime = analytics.realtime || {};
  const metaSection = analytics.meta || {};
  const holdings = dashboard?.holdings?.items || [];
  const balances = dashboard?.cashBalances?.items || [];
  const fxRates = dashboard?.fx?.rates || [];
  const warnings = metaSection.warnings || [];

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
            <span>Runtime</span>
            <strong>{error ? "Request failed" : loading ? "Requesting data" : "Data loaded"}</strong>
            <p>
              {loading
                ? "Loading dashboard data."
                : error
                  ? error
                  : `Portfolio snapshot as of ${analytics.asOf || "N/A"}.`}
            </p>
          </div>
        </div>

        <div className="hero-metrics">
          <SummaryCard
            label="Holdings Value"
            value={formatCurrency(realtime.holdingMarketValue, metaSection.reportingCurrency || "CNY")}
            detail="Current holding market value"
          />
          <SummaryCard
            label="Cash Balance"
            value={formatCurrency(realtime.cashBalance, metaSection.reportingCurrency || "CNY")}
            detail="Aggregated across accounts"
          />
          <SummaryCard
            label="Today's P&L"
            value={formatCurrency(realtime.todayPnl, metaSection.reportingCurrency || "CNY")}
            detail="Portfolio daily move"
            tone={classForDelta(realtime.todayPnl)}
          />
        </div>
      </section>

      <section className="content-grid">
        <article className="feature-card">
          <div className="card-head">
            <span>Cash Accounts</span>
            <strong>{balances.length} wallets</strong>
          </div>
          <div className="metric-stack">
            {balances.map((item) => (
              <div key={item.cashAccountId} className="metric-stack__row">
                <div>
                  <strong>{item.currency}</strong>
                  <p>Available {formatCurrency(item.availableBalance, item.currency)}</p>
                </div>
                <div>
                  <strong>{formatCurrency(item.balance, item.currency)}</strong>
                  <p>Frozen {formatCurrency(item.frozenBalance, item.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>FX Snapshot</span>
            <strong>{dashboard?.fx?.reportingCurrency || "CNY"}</strong>
          </div>
          <div className="pill-list">
            {fxRates.map((rate) => (
              <div key={`${rate.baseCurrency}-${rate.quoteCurrency}`} className="pill-list__item">
                <strong>
                  {rate.baseCurrency}/{rate.quoteCurrency}
                </strong>
                <span>{Number(rate.rate).toFixed(4)}</span>
                <p>{rate.symbol || rate.source || "N/A"}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="feature-card">
          <div className="card-head">
            <span>Positions</span>
            <strong>{holdings.length} active holdings</strong>
          </div>
          <div className="metric-stack">
            {holdings.slice(0, 5).map((item) => (
              <div key={item.holdingId} className="metric-stack__row">
                <div>
                  <strong>{item.symbol}</strong>
                  <p>
                    {Number(item.quantity).toFixed(2)} shares at{" "}
                    {formatCurrency(item.avgCost, item.currency)}
                  </p>
                </div>
                <div>
                  <strong>{formatCurrency(item.marketValue, item.currency)}</strong>
                  <p className={classForDelta(item.dailyChangePercent)}>
                    {formatSignedPercent(item.dailyChangePercent)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>System Notes</span>
            <strong>{warnings.length ? `${warnings.length} checks` : "Clear"}</strong>
          </div>
          {warnings.length ? (
            <div className="activity-list">
              {warnings.map((item) => (
                <div key={item} className="activity-item">
                  <span className="activity-dot" />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="card-subtitle">No runtime notices were returned for this snapshot.</p>
          )}
        </article>
      </section>

      <article className="feature-card table-card">
        <div className="card-head">
          <span>Holdings Table</span>
          <strong>{analytics.asOf || "N/A"}</strong>
        </div>
        <p className="card-subtitle">
          Directly wired to `/api/holdings` with live market values and daily changes.
        </p>
        <div className="data-table">
          <div className="data-table__header">
            <span>Symbol</span>
            <span>Name</span>
            <span>Qty</span>
            <span>Price</span>
            <span>P&L</span>
            <span>Updated</span>
          </div>
          {holdings.map((item) => (
            <div key={item.holdingId} className="data-table__row">
              <span>{item.symbol}</span>
              <span>{item.name}</span>
              <span>{Number(item.quantity).toFixed(2)}</span>
              <span>{formatCurrency(item.latestClose, item.currency)}</span>
              <span className={classForDelta(item.unrealizedPnl)}>
                {formatCurrency(item.unrealizedPnl, item.currency)}
              </span>
              <span>{formatDate(item.latestTradeDate)}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
