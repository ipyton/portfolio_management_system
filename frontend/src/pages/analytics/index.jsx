import React, { useEffect, useState } from "react";
import {
  DEFAULT_USER_ID,
  apiFetch,
  classForDelta,
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedPercent,
} from "../../lib/api";

export const analyticsPageMeta = {
  eyebrow: "Portfolio Dashboard",
  title: "Track the signals shaping portfolio momentum.",
  description:
    "Live portfolio, benchmark, risk, and distribution data pulled from the dashboard API.",
  metrics: [],
};

function MetricCard({ label, value, detail, tone }) {
  return (
    <article className="hero-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default function AnalyticsPage({ label, meta }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(
          `/api/portfolio/dashboard?baseCurrency=CNY&userId=${DEFAULT_USER_ID}`,
        );
        if (!cancelled) {
          setAnalytics(response);
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

  const performance = analytics?.performance || {};
  const risk = analytics?.risk || {};
  const holdings = analytics?.holdings || {};
  const trading = analytics?.trading || {};
  const realtime = analytics?.realtime || {};
  const metaSection = analytics?.meta || {};
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
            <span>Session</span>
            <strong>{error ? "Request failed" : loading ? "Requesting data" : "Dashboard ready"}</strong>
            <p>
              {loading
                ? "Loading portfolio summary from the backend."
                : error
                  ? error
                  : `As of ${analytics?.asOf || "N/A"} in ${metaSection.reportingCurrency || "CNY"}.`}
            </p>
          </div>
        </div>

        <div className="hero-metrics">
          <MetricCard
            label="Total Return"
            value={formatSignedPercent(performance.totalReturn)}
            detail="Portfolio total return"
            tone={classForDelta(performance.totalReturn)}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={
              risk.sharpeRatio === null || risk.sharpeRatio === undefined
                ? "N/A"
                : Number(risk.sharpeRatio).toFixed(2)
            }
            detail="Risk-adjusted return"
            tone={classForDelta(risk.sharpeRatio)}
          />
          <MetricCard
            label="Today's P&L"
            value={formatCurrency(realtime.todayPnl, metaSection.reportingCurrency || "CNY")}
            detail="Latest mark-to-market move"
            tone={classForDelta(realtime.todayPnl)}
          />
        </div>
      </section>

      <section className="content-grid">
        <article className="feature-card spotlight-card">
          <p className="eyebrow">Dashboard Feed</p>
          <h2>{label}</h2>
          <p>
            Performance, benchmark, and risk sections are now hydrated from
            `/api/portfolio/dashboard`.
          </p>
          <div className="stats-grid live-stats">
            <div>
              <span>Annualized Return</span>
              <strong>{formatSignedPercent(performance.annualizedReturn)}</strong>
            </div>
            <div>
              <span>Annualized Volatility</span>
              <strong>{formatPercent(risk.annualizedVolatility)}</strong>
            </div>
            <div>
              <span>Max Drawdown</span>
              <strong className={classForDelta(risk.maxDrawdown)}>
                {formatSignedPercent(risk.maxDrawdown)}
              </strong>
            </div>
            <div>
              <span>Turnover Rate</span>
              <strong>{formatPercent(trading.turnoverRate)}</strong>
            </div>
          </div>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>Runtime Notes</span>
            <strong>{warnings.length ? "Warnings" : "No warnings"}</strong>
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
            <p className="card-subtitle">No runtime warnings were returned by the API.</p>
          )}
        </article>
      </section>

      <section className="content-grid analytics-grid">
        <article className="feature-card">
          <div className="card-head">
            <span>Benchmark</span>
            <strong>{risk.benchmarkSymbol || "N/A"}</strong>
          </div>
          <div className="metric-stack">
            {(performance.benchmarkComparisons || []).map((item) => (
              <div key={item.symbol} className="metric-stack__row">
                <div>
                  <strong>{item.symbol}</strong>
                  <p>{item.name}</p>
                </div>
                <div>
                  <strong className={classForDelta(item.totalReturn)}>
                    {formatSignedPercent(item.totalReturn)}
                  </strong>
                  <p>Alpha {formatSignedPercent(item.alpha)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="feature-card">
          <div className="card-head">
            <span>Allocation</span>
            <strong>{metaSection.reportingCurrency || "CNY"}</strong>
          </div>
          <div className="pill-list">
            {(holdings.assetClassDistribution || []).map((item) => (
              <div key={item.name} className="pill-list__item">
                <strong>{item.name}</strong>
                <span>{formatPercent(item.weight)}</span>
                <p>{formatCurrency(item.marketValue, metaSection.reportingCurrency || "CNY")}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="feature-card table-card">
        <div className="card-head">
          <span>Trade Tape</span>
          <strong>{trading.tradeCount || 0} trades</strong>
        </div>
        <p className="card-subtitle">
          Latest executed trades from `/api/portfolio/dashboard`.
        </p>
        <div className="data-table">
          <div className="data-table__header">
            <span>Symbol</span>
            <span>Asset</span>
            <span>Side</span>
            <span>Notional</span>
            <span>Fee</span>
            <span>Traded</span>
          </div>
          {(trading.buySellRecords || []).slice(0, 6).map((trade) => (
            <div key={trade.tradeId} className="data-table__row">
              <span>{trade.symbol}</span>
              <span>{trade.assetName}</span>
              <span>{trade.tradeType}</span>
              <span>
                {formatCurrency(
                  trade.reportingCurrencyAmount,
                  metaSection.reportingCurrency || "CNY",
                )}
              </span>
              <span>
                {formatCurrency(
                  trade.reportingCurrencyFee,
                  metaSection.reportingCurrency || "CNY",
                )}
              </span>
              <span>{formatDate(trade.tradedAt)}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
