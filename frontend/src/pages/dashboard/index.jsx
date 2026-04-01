import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_USER_ID,
  apiFetch,
  formatCurrency,
  formatPercent,
  formatSignedPercent,
} from "../../lib/api";
import HoldingsTable, { HOLDING_COLUMN_OPTIONS } from "./components/HoldingsTable";
import IntroCard from "./components/IntroCard";
import MetricsSlider from "./components/MetricsSlider";
import TradeList from "./components/TradeList";
import "./dashboard.css";

export const dashboardPageMeta = {
  eyebrow: "Dashboard",
  title: "Dashboard",
  description:
    "This page is to display the general real-time information of the current portfolio.",
  metrics: [
    { label: "Total Amount", value: "24", detail: "The total fund amount." },
    { label: "Current Profit", value: "3", detail: "Profit" },
    { label: "Ratio", value: "99.2%", detail: "live ratio of the current" },
  ],
};

export const dashboardActivityFeed = [
  "Custodian file matched successfully",
  "Two approvals are waiting on compliance review",
  "Settlement queue shows one exception in HK",
];

const DEFAULT_CATEGORIES = [
  {
    id: "realtime",
    label: "Realtime",
    eyebrow: "Live Snapshot",
    accent: "#38bdf8",
    pnl: { value: "+$12,480", detail: "Mark-to-market · Today" },
    metrics: [
      { key: "holdingMarketValue", label: "Holding Market Value", value: "$1.84M", detail: "Current positions" },
      { key: "cashBalance", label: "Cash Balance", value: "$312,500", detail: "Available cash" },
      { key: "availableFunds", label: "Available Funds", value: "$298,000", detail: "Post-settlement" },
      { key: "cashByCurrency", label: "Cash by Currency", value: "USD / HKD", detail: "Multi-currency" },
      { key: "holdings", label: "Holdings Count", value: "42", detail: "Active positions" },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    eyebrow: "Returns & Benchmarks",
    accent: "#4f7bff",
    metrics: [
      { key: "totalReturn", label: "Total Return", value: "+18.4%", detail: "Since inception" },
      { key: "annualizedReturn", label: "Annualized Return", value: "+12.8%", detail: "CAGR" },
      { key: "timeWeightedReturn", label: "Time-Weighted Return", value: "+11.3%", detail: "TWR adjusted" },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    eyebrow: "Volatility & Ratios",
    accent: "#f59e0b",
    metrics: [
      { key: "annualizedVolatility", label: "Annualized Volatility", value: "14.7%", detail: "1Y rolling" },
      { key: "maxDrawdown", label: "Max Drawdown", value: "-8.3%", detail: "Peak to trough" },
      { key: "sharpeRatio", label: "Sharpe Ratio", value: "1.42", detail: "Risk-adjusted" },
      { key: "beta", label: "Beta", value: "0.87", detail: "vs benchmark" },
      { key: "alpha", label: "Alpha", value: "3.2%", detail: "Annual excess" },
      { key: "riskFreeRate", label: "Risk-Free Rate", value: "5.25%", detail: "3M T-bill" },
    ],
  },
  {
    id: "holdings",
    label: "Holdings",
    eyebrow: "Distribution & Concentration",
    accent: "#7bd88f",
    metrics: [
      { key: "assetClassDistribution", label: "Asset Class", value: "62% EQ", detail: "Equity dominant" },
      { key: "regionDistribution", label: "Region", value: "US 74%", detail: "Geographic breakdown" },
      { key: "concentrationRisk", label: "Concentration", value: "Medium", detail: "Top 10: 48% of NAV" },
    ],
  },
  {
    id: "trading",
    label: "Trading",
    eyebrow: "Activity & Costs",
    accent: "#c084fc",
    metrics: [
      { key: "turnoverRate", label: "Turnover Rate", value: "34.2%", detail: "Last 12 months" },
      { key: "transactionAmount", label: "Transaction Amount", value: "$2.4M", detail: "Total traded" },
      { key: "totalFees", label: "Total Fees", value: "$3,840", detail: "Commission + spread" },
      { key: "tradeCount", label: "Trade Count", value: "128", detail: "Executed orders" },
      { key: "buySellRecords", label: "Buy / Sell", value: "74 / 54", detail: "Directional split" },
    ],
  },
];

const LIVE_DASHBOARD_API = import.meta.env.VITE_DASHBOARD_LIVE_API
  || `/api/portfolio/dashboard?baseCurrency=CNY&userId=${DEFAULT_USER_ID}`;
const LIVE_POLLING_MS = 15000;

const BENCH_POINTS = [100, 103.2, 101.8, 107.4, 109.1, 106.3, 112.6, 115.4, 113.2, 118.7, 120.1, 118.4];
const BENCHMARK_POINTS = [100, 101.4, 100.2, 104.6, 105.8, 103.1, 107.4, 109.8, 108.3, 112.1, 114.5, 115.2];
const SPARK_POINTS = [0, 2140, 4870, 3620, 6310, 5480, 7920, 9250, 8100, 10640, 11380, 10820, 12480];
const DEFAULT_DONUT_SEGMENTS = [
  { label: "Tech", pct: 31, color: "#4f7bff" },
  { label: "Finance", pct: 21, color: "#7bd88f" },
  { label: "Healthcare", pct: 13, color: "#38bdf8" },
  { label: "Consumer", pct: 10, color: "#f59e0b" },
  { label: "Energy", pct: 9, color: "#f97316" },
  { label: "EV", pct: 8, color: "#c084fc" },
  { label: "Semis", pct: 8, color: "#fb7185" },
];

const DONUT_COLORS = [
  "#4f7bff",
  "#7bd88f",
  "#38bdf8",
  "#f59e0b",
  "#f97316",
  "#c084fc",
  "#fb7185",
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHoldingRow(row) {
  return {
    symbol: String(row?.symbol ?? "").toUpperCase(),
    companyName: row?.companyName ?? row?.company ?? row?.name ?? "",
    label: row?.label ?? row?.industry ?? row?.assetType ?? "Other",
    shares: toNumber(row?.shares ?? row?.quantity, 0),
    currentPrice: toNumber(row?.currentPrice ?? row?.price ?? row?.latestPrice, 0),
    costBasis: toNumber(row?.costBasis ?? row?.avgCost, 0),
  };
}

function normalizeTradeRow(row, index) {
  return {
    id: row?.id ?? row?.tradeId ?? `live-trade-${index}`,
    symbol: String(row?.symbol ?? "").toUpperCase(),
    side: row?.side ?? row?.tradeType ?? "N/A",
    companyName: row?.companyName ?? row?.company ?? row?.assetName ?? "",
    shares: toNumber(row?.shares ?? row?.quantity, 0),
    price: toNumber(row?.price, 0),
    total: toNumber(
      row?.total
      ?? row?.reportingCurrencyAmount
      ?? toNumber(row?.shares ?? row?.quantity, 0) * toNumber(row?.price, 0),
      0,
    ),
    date: row?.date ?? row?.tradedAt ?? "",
  };
}

function formatTradeFeedItem(trade) {
  const symbol = String(trade?.symbol || "").toUpperCase() || "N/A";
  const side = String(trade?.tradeType || trade?.side || "TRADE").toUpperCase();
  const quantity = toNumber(trade?.quantity ?? trade?.shares, 0);
  const price = toNumber(trade?.price, 0);
  return `${symbol} ${side} ${quantity.toFixed(2)} @ ${price.toFixed(2)}`;
}

function toFixed(value, digits = 2) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "N/A";
}

function buildDonutSegments(payload) {
  const industryDistribution = payload?.holdings?.industryDistribution;
  if (!Array.isArray(industryDistribution) || industryDistribution.length === 0) {
    return DEFAULT_DONUT_SEGMENTS;
  }

  const base = industryDistribution
    .filter((item) => Number.isFinite(Number(item?.weight)) && Number(item.weight) > 0)
    .slice(0, 7)
    .map((item, index) => ({
      label: item?.name || `Sector ${index + 1}`,
      pct: Math.max(0, Number((Number(item.weight) * 100).toFixed(2))),
      color: DONUT_COLORS[index % DONUT_COLORS.length],
    }));

  if (!base.length) {
    return DEFAULT_DONUT_SEGMENTS;
  }

  const used = base.reduce((sum, item) => sum + item.pct, 0);
  const remain = Number((100 - used).toFixed(2));
  if (remain > 0.5 && base.length < 8) {
    base.push({
      label: "Other",
      pct: remain,
      color: DONUT_COLORS[base.length % DONUT_COLORS.length],
    });
  }

  return base;
}

function buildLiveCategories(payload) {
  if (!payload) {
    return DEFAULT_CATEGORIES;
  }

  const performance = payload?.performance || {};
  const risk = payload?.risk || {};
  const holdings = payload?.holdings || {};
  const trading = payload?.trading || {};
  const realtime = payload?.realtime || {};
  const metaSection = payload?.meta || {};
  const reportingCurrency = metaSection.reportingCurrency || realtime.reportingCurrency || "CNY";
  const asOf = payload?.asOf || "N/A";

  const realtimeHoldings = Array.isArray(realtime.holdings) ? realtime.holdings : [];
  const cashByCurrency = Array.isArray(realtime.cashByCurrency) ? realtime.cashByCurrency : [];
  const cashCurrencyText = cashByCurrency.length
    ? cashByCurrency.map((item) => item.currency).filter(Boolean).join(" / ")
    : "N/A";

  const assetClassDistribution = Array.isArray(holdings.assetClassDistribution)
    ? holdings.assetClassDistribution
    : [];
  const regionDistribution = Array.isArray(holdings.regionDistribution)
    ? holdings.regionDistribution
    : [];
  const topAssetClass = assetClassDistribution[0] || null;
  const topRegion = regionDistribution[0] || null;
  const concentrationRisk = holdings.concentrationRisk || {};

  const tradeRecords = Array.isArray(trading.buySellRecords) ? trading.buySellRecords : [];
  const buyCount = tradeRecords.filter((item) =>
    String(item?.tradeType || item?.side || "").toUpperCase() === "BUY",
  ).length;
  const sellCount = tradeRecords.filter((item) =>
    String(item?.tradeType || item?.side || "").toUpperCase() === "SELL",
  ).length;

  return [
    {
      id: "realtime",
      label: "Realtime",
      eyebrow: "Live Snapshot",
      accent: "#38bdf8",
      pnl: {
        value: formatCurrency(realtime.todayPnl, reportingCurrency),
        detail: `Mark-to-market · As of ${asOf}`,
      },
      metrics: [
        {
          key: "holdingMarketValue",
          label: "Holding Market Value",
          value: formatCurrency(realtime.holdingMarketValue, reportingCurrency),
          detail: "Current positions",
        },
        {
          key: "cashBalance",
          label: "Cash Balance",
          value: formatCurrency(realtime.cashBalance, reportingCurrency),
          detail: "Available cash",
        },
        {
          key: "availableFunds",
          label: "Available Funds",
          value: formatCurrency(realtime.availableFunds, reportingCurrency),
          detail: "Post-settlement",
        },
        {
          key: "cashByCurrency",
          label: "Cash by Currency",
          value: cashCurrencyText,
          detail: "Multi-currency",
        },
        {
          key: "holdings",
          label: "Holdings Count",
          value: String(realtimeHoldings.length),
          detail: "Active positions",
        },
      ],
    },
    {
      id: "performance",
      label: "Performance",
      eyebrow: "Returns & Benchmarks",
      accent: "#4f7bff",
      metrics: [
        {
          key: "totalReturn",
          label: "Total Return",
          value: formatSignedPercent(performance.totalReturn),
          detail: "Since inception",
        },
        {
          key: "annualizedReturn",
          label: "Annualized Return",
          value: formatSignedPercent(performance.annualizedReturn),
          detail: "CAGR",
        },
        {
          key: "timeWeightedReturn",
          label: "Time-Weighted Return",
          value: formatSignedPercent(performance.timeWeightedReturn),
          detail: "TWR adjusted",
        },
      ],
    },
    {
      id: "risk",
      label: "Risk",
      eyebrow: "Volatility & Ratios",
      accent: "#f59e0b",
      metrics: [
        {
          key: "annualizedVolatility",
          label: "Annualized Volatility",
          value: formatPercent(risk.annualizedVolatility),
          detail: "1Y rolling",
        },
        {
          key: "maxDrawdown",
          label: "Max Drawdown",
          value: formatSignedPercent(risk.maxDrawdown),
          detail: "Peak to trough",
        },
        {
          key: "sharpeRatio",
          label: "Sharpe Ratio",
          value: toFixed(risk.sharpeRatio, 2),
          detail: "Risk-adjusted",
        },
        {
          key: "beta",
          label: "Beta",
          value: toFixed(risk.beta, 2),
          detail: "vs benchmark",
        },
        {
          key: "alpha",
          label: "Alpha",
          value: formatSignedPercent(risk.alpha),
          detail: "Annual excess",
        },
        {
          key: "riskFreeRate",
          label: "Risk-Free Rate",
          value: formatPercent(risk.riskFreeRate),
          detail: "Config source",
        },
      ],
    },
    {
      id: "holdings",
      label: "Holdings",
      eyebrow: "Distribution & Concentration",
      accent: "#7bd88f",
      metrics: [
        {
          key: "assetClassDistribution",
          label: "Asset Class",
          value: topAssetClass
            ? `${topAssetClass.name} ${formatPercent(topAssetClass.weight, 1)}`
            : "N/A",
          detail: "Largest asset class",
        },
        {
          key: "regionDistribution",
          label: "Region",
          value: topRegion
            ? `${topRegion.name} ${formatPercent(topRegion.weight, 1)}`
            : "N/A",
          detail: "Largest region exposure",
        },
        {
          key: "concentrationRisk",
          label: "Concentration",
          value: concentrationRisk.level
            || formatPercent(concentrationRisk.top3Weight, 1),
          detail: "Top holdings concentration",
        },
      ],
    },
    {
      id: "trading",
      label: "Trading",
      eyebrow: "Activity & Costs",
      accent: "#c084fc",
      metrics: [
        {
          key: "turnoverRate",
          label: "Turnover Rate",
          value: formatPercent(trading.turnoverRate),
          detail: "Recent period",
        },
        {
          key: "transactionAmount",
          label: "Transaction Amount",
          value: formatCurrency(trading.transactionAmount, reportingCurrency),
          detail: "Total traded",
        },
        {
          key: "totalFees",
          label: "Total Fees",
          value: formatCurrency(trading.totalFees, reportingCurrency),
          detail: "Commission + spread",
        },
        {
          key: "tradeCount",
          label: "Trade Count",
          value: String(toNumber(trading.tradeCount, tradeRecords.length)),
          detail: "Executed orders",
        },
        {
          key: "buySellRecords",
          label: "Buy / Sell",
          value: `${buyCount} / ${sellCount}`,
          detail: "Directional split",
        },
      ],
    },
  ];
}

// ---------------------------------------------------

// Dashboard Page.
export default function DashboardPage({ meta = dashboardPageMeta, activityFeed = dashboardActivityFeed, isLoggedIn }) {
  // Centralize dashboard state in index.jsx and pass it to presentational components.
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [liveHoldings, setLiveHoldings] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);
  const [dashboardPayload, setDashboardPayload] = useState(null);
  const [isLiveLoading, setIsLiveLoading] = useState(true);
  const [liveDataUnavailable, setLiveDataUnavailable] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(HOLDING_COLUMN_OPTIONS[0].key);

  const categories = useMemo(
    () => buildLiveCategories(dashboardPayload),
    [dashboardPayload],
  );
  const donutSegments = useMemo(
    () => buildDonutSegments(dashboardPayload),
    [dashboardPayload],
  );

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) || categories[0],
    [activeCategoryId, categories],
  );
  const activeCategoryIndex = useMemo(
    () => categories.findIndex((category) => category.id === activeCategoryId),
    [activeCategoryId, categories],
  );
  const resolvedMeta = useMemo(() => {
    if (!dashboardPayload) {
      return meta;
    }

    const realtime = dashboardPayload?.realtime || {};
    const performance = dashboardPayload?.performance || {};
    const trading = dashboardPayload?.trading || {};
    const metaSection = dashboardPayload?.meta || {};
    const reportingCurrency = metaSection.reportingCurrency || realtime.reportingCurrency || "CNY";
    const totalValue = toNumber(realtime.holdingMarketValue, 0) + toNumber(realtime.cashBalance, 0);

    return {
      ...meta,
      description: `As of ${dashboardPayload.asOf || "N/A"} · Reporting currency ${reportingCurrency}.`,
      metrics: [
        {
          label: "Portfolio Value",
          value: formatCurrency(totalValue, reportingCurrency),
          detail: "Holdings + cash",
        },
        {
          label: "Today's P&L",
          value: formatCurrency(realtime.todayPnl, reportingCurrency),
          detail: "Mark-to-market",
        },
        {
          label: "Total Return",
          value: formatSignedPercent(performance.totalReturn),
          detail: `${toNumber(trading.tradeCount, 0)} trades logged`,
        },
      ],
    };
  }, [dashboardPayload, meta]);
  const resolvedActivityFeed = useMemo(() => {
    if (!dashboardPayload) {
      return activityFeed;
    }

    const warnings = Array.isArray(dashboardPayload?.meta?.warnings)
      ? dashboardPayload.meta.warnings.slice(0, 2)
      : [];
    const tradeFeed = Array.isArray(dashboardPayload?.trading?.buySellRecords)
      ? dashboardPayload.trading.buySellRecords.slice(0, 3).map(formatTradeFeedItem)
      : [];
    const merged = [...warnings, ...tradeFeed]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    if (!merged.length) {
      return activityFeed;
    }
    return merged;
  }, [dashboardPayload, activityFeed]);
  const syncStatus = useMemo(() => {
    if (isLiveLoading) {
      return {
        heading: "Syncing backend",
        message: "Loading live dashboard metrics from API.",
      };
    }
    if (liveDataUnavailable) {
      return {
        heading: "Sync failed",
        message: "Backend data is unavailable right now.",
      };
    }
    return {
      heading: "Dashboard synced",
      message: `Latest snapshot: ${dashboardPayload?.asOf || "N/A"}.`,
    };
  }, [isLiveLoading, liveDataUnavailable, dashboardPayload?.asOf]);

  useEffect(() => {
    if (!categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveDashboardData() {
      try {
        const payload = await apiFetch(LIVE_DASHBOARD_API);
        const holdings = Array.isArray(payload?.realtime?.holdings)
          ? payload.realtime.holdings.map(normalizeHoldingRow)
          : [];
        const trades = Array.isArray(payload?.trading?.buySellRecords)
          ? payload.trading.buySellRecords.map(normalizeTradeRow)
          : [];

        if (!isMounted) return;
        setDashboardPayload(payload);
        setLiveHoldings(holdings);
        setLiveTrades(trades);
        setLiveDataUnavailable(false);
      } catch (error) {
        if (!isMounted) return;
        setDashboardPayload(null);
        setLiveHoldings([]);
        setLiveTrades([]);
        setLiveDataUnavailable(true);
      } finally {
        if (isMounted) {
          setIsLiveLoading(false);
        }
      }
    }

    fetchLiveDashboardData();
    const timer = setInterval(fetchLiveDashboardData, LIVE_POLLING_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    const symbolExists = liveHoldings.some((holding) => holding.symbol === selectedSymbol);
    if (!symbolExists) {
      setSelectedSymbol(null);
    }
  }, [liveHoldings, selectedSymbol]);

  const enrichedHoldings = useMemo(() => {
    const withMetrics = liveHoldings.map((holding) => {
      const marketValue = holding.shares * holding.currentPrice;
      const pnl = marketValue - holding.shares * holding.costBasis;
      return { ...holding, marketValue, pnl };
    });
    const totalMarketValue = withMetrics.reduce((sum, holding) => sum + holding.marketValue, 0);
    return withMetrics.map((holding) => ({
      ...holding,
      allocation: totalMarketValue > 0 ? (holding.marketValue / totalMarketValue) * 100 : 0,
    }));
  }, [liveHoldings]);

  function goToPrevCategory() {
    const nextIndex = activeCategoryIndex <= 0 ? categories.length - 1 : activeCategoryIndex - 1;
    setActiveCategoryId(categories[nextIndex].id);
  }

  function goToNextCategory() {
    const nextIndex = activeCategoryIndex >= categories.length - 1 ? 0 : activeCategoryIndex + 1;
    setActiveCategoryId(categories[nextIndex].id);
  }

  return (
    <div className="dashboard-page">
      <IntroCard
        meta={resolvedMeta}
        activityFeed={resolvedActivityFeed}
        isLoggedIn={isLoggedIn}
        status={syncStatus}
      />
      <MetricsSlider
        categories={categories}
        activeCategory={activeCategory}
        activeCategoryIndex={activeCategoryIndex}
        onPrev={goToPrevCategory}
        onNext={goToNextCategory}
        onSelectCategory={setActiveCategoryId}
        sparkPoints={SPARK_POINTS}
        benchPoints={BENCH_POINTS}
        benchmarkPoints={BENCHMARK_POINTS}
        donutSegments={donutSegments}
      />
      <div className="stock-bottom-grid">
        <section className="feature-card" style={{ padding: 18 }}>
          <HoldingsTable
            holdings={enrichedHoldings}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            selectedColumn={selectedColumn}
            onColumnChange={setSelectedColumn}
            isLoading={isLiveLoading}
            dataUnavailable={liveDataUnavailable}
            minRows={5}
          />
        </section>
        <section>
          <TradeList 
            trades={liveTrades}
            selectedSymbol={selectedSymbol} 
            onClear={() => setSelectedSymbol(null)}
            isLoading={isLiveLoading}
            dataUnavailable={liveDataUnavailable}
            minRows={5}
          />
        </section>
      </div>
    </div>
  );
}
