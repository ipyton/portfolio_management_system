import React, { useEffect, useMemo, useState } from "react";
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

const CATEGORIES = [
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

const LIVE_DASHBOARD_API = import.meta.env.VITE_DASHBOARD_LIVE_API || "/api/dashboard/live";
const LIVE_POLLING_MS = 15000;

const BENCH_POINTS = [100, 103.2, 101.8, 107.4, 109.1, 106.3, 112.6, 115.4, 113.2, 118.7, 120.1, 118.4];
const BENCHMARK_POINTS = [100, 101.4, 100.2, 104.6, 105.8, 103.1, 107.4, 109.8, 108.3, 112.1, 114.5, 115.2];
const SPARK_POINTS = [0, 2140, 4870, 3620, 6310, 5480, 7920, 9250, 8100, 10640, 11380, 10820, 12480];
const DONUT_SEGMENTS = [
  { label: "Tech", pct: 31, color: "#4f7bff" },
  { label: "Finance", pct: 21, color: "#7bd88f" },
  { label: "Healthcare", pct: 13, color: "#38bdf8" },
  { label: "Consumer", pct: 10, color: "#f59e0b" },
  { label: "Energy", pct: 9, color: "#f97316" },
  { label: "EV", pct: 8, color: "#c084fc" },
  { label: "Semis", pct: 8, color: "#fb7185" },
];

function normalizeHoldingRow(row) {
  return {
    symbol: String(row?.symbol ?? "").toUpperCase(),
    companyName: row?.companyName ?? row?.company ?? "",
    label: row?.label ?? "Other",
    shares: Number(row?.shares ?? 0),
    currentPrice: Number(row?.currentPrice ?? row?.price ?? 0),
    costBasis: Number(row?.costBasis ?? row?.avgCost ?? 0),
  };
}

function normalizeTradeRow(row, index) {
  return {
    id: row?.id ?? `live-trade-${index}`,
    symbol: String(row?.symbol ?? "").toUpperCase(),
    side: row?.side ?? "N/A",
    companyName: row?.companyName ?? row?.company ?? "",
    shares: Number(row?.shares ?? 0),
    price: Number(row?.price ?? 0),
    total: Number(row?.total ?? Number(row?.shares ?? 0) * Number(row?.price ?? 0)),
    date: row?.date ?? "",
  };
}

// ---------------------------------------------------

// Dashboard Page.
export default function DashboardPage({ meta = dashboardPageMeta, activityFeed = dashboardActivityFeed, isLoggedIn }) {
  // Centralize dashboard state in index.jsx and pass it to presentational components.
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORIES[0].id);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [liveHoldings, setLiveHoldings] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);
  const [isLiveLoading, setIsLiveLoading] = useState(true);
  const [liveDataUnavailable, setLiveDataUnavailable] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(HOLDING_COLUMN_OPTIONS[0].key);

  const activeCategory = useMemo(
    () => CATEGORIES.find((category) => category.id === activeCategoryId) || CATEGORIES[0],
    [activeCategoryId],
  );
  const activeCategoryIndex = useMemo(
    () => CATEGORIES.findIndex((category) => category.id === activeCategoryId),
    [activeCategoryId],
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveDashboardData() {
      try {
        const response = await fetch(LIVE_DASHBOARD_API);
        if (!response.ok) {
          throw new Error(`Live API failed with status ${response.status}`);
        }
        const payload = await response.json();
        const holdings = Array.isArray(payload?.holdings)
          ? payload.holdings.map(normalizeHoldingRow)
          : [];
        const trades = Array.isArray(payload?.trades)
          ? payload.trades.map(normalizeTradeRow)
          : [];

        if (!isMounted) return;
        setLiveHoldings(holdings);
        setLiveTrades(trades);
        setLiveDataUnavailable(false);
      } catch (error) {
        if (!isMounted) return;
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
    const nextIndex = activeCategoryIndex <= 0 ? CATEGORIES.length - 1 : activeCategoryIndex - 1;
    setActiveCategoryId(CATEGORIES[nextIndex].id);
  }

  function goToNextCategory() {
    const nextIndex = activeCategoryIndex >= CATEGORIES.length - 1 ? 0 : activeCategoryIndex + 1;
    setActiveCategoryId(CATEGORIES[nextIndex].id);
  }

  return (
    <>
      <IntroCard meta={meta} activityFeed={activityFeed} isLoggedIn={isLoggedIn} />
      <MetricsSlider
        categories={CATEGORIES}
        activeCategory={activeCategory}
        activeCategoryIndex={activeCategoryIndex}
        onPrev={goToPrevCategory}
        onNext={goToNextCategory}
        onSelectCategory={setActiveCategoryId}
        sparkPoints={SPARK_POINTS}
        benchPoints={BENCH_POINTS}
        benchmarkPoints={BENCHMARK_POINTS}
        donutSegments={DONUT_SEGMENTS}
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
    </>
  );
}
