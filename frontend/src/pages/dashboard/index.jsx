import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_USER_ID,
  apiFetch,
  formatCurrency,
  formatPercent,
  formatSignedPercent,
} from "../../lib/api";
import HoldingsTable from "./components/HoldingsTable";
import IntroCard from "./components/IntroCard";
import MetricsSlider from "./components/MetricsSlider";
import TradeList from "./components/TradeList";
import WorldIndicesPanel from "./components/WorldIndicesPanel";
import "./dashboard.css";

export const dashboardPageMeta = {
  eyebrow: "Dashboard",
  title: "Dashboard",
  description:
    "This page is to display the general real-time information of the current portfolio.",
  metrics: [
    { label: "Portfolio Value", value: "N/A", detail: "Holdings + cash" },
    { label: "Today's P&L", value: "N/A", detail: "Mark-to-market" },
    { label: "Total Return", value: "N/A", detail: "Since inception" },
  ],
};

export const dashboardActivityFeed = [
  "Refreshing market headlines...",
  "Waiting for upstream news source...",
  "News feed will appear here when ready.",
];

const DEFAULT_CATEGORIES = [
  {
    id: "realtime",
    label: "Realtime",
    eyebrow: "Live Snapshot",
    accent: "#1f4ed8",
    pnl: { value: "+$12,480", detail: "Mark-to-market · Today" },
    metrics: [
      { key: "holdingMarketValue", label: "Holding Market Value", value: "$1.84M", detail: "Current positions" },
      { key: "cashBalance", label: "Cash Balance", value: "$312,500", detail: "Available cash" },
      { key: "currentProfit", label: "Current Profit", value: "N/A", detail: "Unrealized P&L" },
      { key: "holdings", label: "Holdings Count", value: "42", detail: "Active positions" },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    eyebrow: "Returns & Benchmarks",
    accent: "#1f4ed8",
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
    accent: "#1f4ed8",
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
    accent: "#1f4ed8",
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
    accent: "#1f4ed8",
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
  || `/api/portfolio/dashboard?baseCurrency=USD&userId=${DEFAULT_USER_ID}`;
const LIVE_POLLING_MS = 15000;

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
const MIN_OBSERVATIONS_FOR_ANNUALIZED_AND_ALPHA = 30;
const REGION_DISPLAY_NAMES = {
  US: "United States",
  CN: "China",
  HK: "Hong Kong",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  IN: "India",
  AU: "Australia",
  KR: "South Korea",
  CA: "Canada",
  SG: "Singapore",
  TW: "Taiwan",
  BR: "Brazil",
};
const REGION_ALIASES = {
  USA: "US",
  UNITEDSTATES: "US",
  UNITEDSTATESOFAMERICA: "US",
  CHINA: "CN",
  MAINLANDCHINA: "CN",
  PEOPLESREPUBLICOFCHINA: "CN",
  HONGKONG: "HK",
  UNITEDKINGDOM: "UK",
  GREATBRITAIN: "UK",
  GB: "UK",
  ASIASHANGHAI: "CN",
  AMERICANEWYORK: "US",
  EUROPELONDON: "UK",
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRegionCode(raw) {
  if (typeof raw !== "string") {
    return "";
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const upper = trimmed.toUpperCase();
  if (["UNKNOWN", "N/A", "NA", "NONE", "NULL"].includes(upper)) {
    return "UNKNOWN";
  }
  const collapsed = upper.replace(/[^A-Z0-9]/g, "");
  if (!collapsed) {
    return "UNKNOWN";
  }
  if (REGION_ALIASES[collapsed]) {
    return REGION_ALIASES[collapsed];
  }
  if (collapsed.length === 2) {
    return collapsed;
  }
  return upper;
}

function isUnknownRegion(raw) {
  const code = normalizeRegionCode(raw);
  return !code || code === "UNKNOWN";
}

function formatRegionDisplay(raw) {
  const code = normalizeRegionCode(raw);
  if (!code || code === "UNKNOWN") {
    return "Unknown";
  }
  return REGION_DISPLAY_NAMES[code] || code;
}

function normalizeHoldingRow(row) {
  const shares = toNumber(row?.shares ?? row?.quantity, 0);
  const marketValueUsd = Number(row?.marketValue);
  const pnlUsd = Number(row?.unrealizedPnl);
  const hasMarketValueUsd = Number.isFinite(marketValueUsd);
  const hasPnlUsd = Number.isFinite(pnlUsd);
  const currency = String(row?.currency || "").toUpperCase();
  const nativePrice = toNumber(row?.currentPrice ?? row?.price ?? row?.latestPrice, Number.NaN);
  const nativeCost = toNumber(row?.costBasis ?? row?.avgCost, Number.NaN);
  const derivedPriceUsd = shares > 0 && hasMarketValueUsd ? marketValueUsd / shares : Number.NaN;
  const derivedCostUsd = shares > 0 && hasMarketValueUsd && hasPnlUsd
    ? (marketValueUsd - pnlUsd) / shares
    : Number.NaN;

  return {
    symbol: String(row?.symbol ?? "").toUpperCase(),
    companyName: row?.companyName ?? row?.company ?? row?.name ?? "",
    label: row?.label ?? row?.industry ?? row?.assetType ?? "Other",
    shares,
    currentPrice: Number.isFinite(derivedPriceUsd)
      ? derivedPriceUsd
      : (currency === "USD" ? nativePrice : Number.NaN),
    costBasis: Number.isFinite(derivedCostUsd)
      ? derivedCostUsd
      : (currency === "USD" ? nativeCost : Number.NaN),
    marketValue: hasMarketValueUsd ? marketValueUsd : Number.NaN,
    pnl: hasPnlUsd ? pnlUsd : Number.NaN,
  };
}

function normalizeTradeRow(row, index) {
  const quantity = toNumber(row?.shares ?? row?.quantity, 0);
  const reportingAmount = Number(row?.reportingCurrencyAmount);
  const currency = String(row?.currency || "").toUpperCase();
  const nativePrice = toNumber(row?.price, Number.NaN);
  const derivedPriceUsd = Number.isFinite(reportingAmount) && quantity > 0
    ? Math.abs(reportingAmount) / quantity
    : Number.NaN;
  const fallbackTotal = toNumber(
    row?.total
    ?? row?.amount
    ?? quantity * (Number.isFinite(nativePrice) ? nativePrice : 0),
    Number.NaN,
  );

  return {
    id: row?.id ?? row?.tradeId ?? `live-trade-${index}`,
    symbol: String(row?.symbol ?? "").toUpperCase(),
    side: row?.side ?? row?.tradeType ?? "N/A",
    companyName: row?.companyName ?? row?.company ?? row?.assetName ?? "",
    shares: quantity,
    price: Number.isFinite(derivedPriceUsd)
      ? derivedPriceUsd
      : (currency === "USD" ? nativePrice : Number.NaN),
    total: Number.isFinite(reportingAmount)
      ? reportingAmount
      : (currency === "USD" ? fallbackTotal : Number.NaN),
    date: row?.date ?? row?.tradedAt ?? "",
  };
}

function formatTradeFeedItem(trade) {
  const symbol = String(trade?.symbol || "").toUpperCase() || "N/A";
  const side = String(trade?.tradeType || trade?.side || "TRADE").toUpperCase();
  const quantity = toNumber(trade?.quantity ?? trade?.shares, 0);
  const price = toNumber(trade?.price, 0);
  return `${symbol} ${side} ${quantity.toFixed(2)} · ${price.toFixed(2)}`;
}

function formatNewsTimestamp(item) {
  const raw = item?.publishedAt
    ?? item?.published_at
    ?? item?.timestamp
    ?? item?.datetime
    ?? item?.time
    ?? item?.createdAt;
  if (raw == null || raw === "") {
    return "";
  }

  let date = null;
  if (typeof raw === "number") {
    const millis = raw > 1e12 ? raw : raw * 1000;
    date = new Date(millis);
  } else {
    date = new Date(String(raw));
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatNewsFeedItem(item) {
  const headline = String(item?.headline || "").trim();
  if (!headline) {
    return null;
  }
  const source = String(item?.source || "").trim();
  const timestamp = formatNewsTimestamp(item);
  if (timestamp && source) {
    return `[${timestamp}] [${source}] ${headline}`;
  }
  if (timestamp) {
    return `[${timestamp}] ${headline}`;
  }
  return source ? `[${source}] ${headline}` : headline;
}

function toFixed(value, digits = 2) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "N/A";
}

function formatBenchmarkAxisDate(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(String(value));
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function buildBenchmarkChartModel(payload) {
  const chart = payload?.performance?.benchmarkChart || {};
  const rawPoints = Array.isArray(chart?.points) ? chart.points : [];
  const points = rawPoints.filter((point) =>
    Number.isFinite(Number(point?.portfolio))
    && Number.isFinite(Number(point?.benchmark))
    && String(point?.date || "").trim(),
  );

  if (points.length < 2) {
    return {
      benchPoints: [],
      benchmarkPoints: [],
      benchmarkLabels: [],
      benchmarkMeta: {
        hasData: false,
        symbol: chart?.symbol || null,
        name: chart?.name || null,
      },
    };
  }

  return {
    benchPoints: points.map((point) => Number(point.portfolio)),
    benchmarkPoints: points.map((point) => Number(point.benchmark)),
    benchmarkLabels: points.map((point) => formatBenchmarkAxisDate(point.date)),
    benchmarkMeta: {
      hasData: true,
      symbol: chart?.symbol || null,
      name: chart?.name || null,
    },
  };
}

function sampleStd(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return 0;
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function deriveFallbackMetricsFromBenchmark(payload, riskFreeRateRaw) {
  const chart = payload?.performance?.benchmarkChart || {};
  const rawPoints = Array.isArray(chart?.points) ? chart.points : [];
  const points = rawPoints
    .map((point) => ({
      portfolio: Number(point?.portfolio),
      benchmark: Number(point?.benchmark),
    }))
    .filter((point) => Number.isFinite(point.portfolio) && Number.isFinite(point.benchmark));

  if (points.length < 2) {
    return {
      returnCount: 0,
      totalReturn: 0,
      timeWeightedReturn: 0,
      annualizedReturn: 0,
      annualizedVolatility: 0,
      beta: 1,
      alpha: 0,
      sharpeRatio: 0,
    };
  }

  const firstPortfolio = points[0].portfolio;
  const lastPortfolio = points[points.length - 1].portfolio;
  if (!(firstPortfolio > 0) || !(lastPortfolio > 0)) {
    return {
      returnCount: 0,
      totalReturn: 0,
      timeWeightedReturn: 0,
      annualizedReturn: 0,
      annualizedVolatility: 0,
      beta: 1,
      alpha: 0,
      sharpeRatio: 0,
    };
  }

  const portfolioReturns = [];
  const benchmarkReturns = [];
  for (let i = 1; i < points.length; i += 1) {
    const prevPortfolio = points[i - 1].portfolio;
    const prevBenchmark = points[i - 1].benchmark;
    const currPortfolio = points[i].portfolio;
    const currBenchmark = points[i].benchmark;
    if (!(prevPortfolio > 0) || !(prevBenchmark > 0)) {
      continue;
    }
    const pr = currPortfolio / prevPortfolio - 1;
    const br = currBenchmark / prevBenchmark - 1;
    if (Number.isFinite(pr) && Number.isFinite(br)) {
      portfolioReturns.push(pr);
      benchmarkReturns.push(br);
    }
  }

  const returnCount = portfolioReturns.length;
  const totalReturn = lastPortfolio / firstPortfolio - 1;
  if (returnCount < 1) {
    return {
      returnCount: 0,
      totalReturn: Number.isFinite(totalReturn) ? totalReturn : 0,
      timeWeightedReturn: Number.isFinite(totalReturn) ? totalReturn : 0,
      annualizedReturn: Number.isFinite(totalReturn) ? totalReturn : 0,
      annualizedVolatility: 0,
      beta: 1,
      alpha: 0,
      sharpeRatio: 0,
    };
  }

  const timeWeightedReturn = totalReturn;
  const annualizedReturn = timeWeightedReturn > -1
    ? (Math.pow(1 + timeWeightedReturn, 252 / returnCount) - 1)
    : null;
  const stdDaily = sampleStd(portfolioReturns);
  const annualizedVolatility = stdDaily > 0
    ? stdDaily * Math.sqrt(252)
    : Math.abs(portfolioReturns[0] || 0) * Math.sqrt(252);

  const avgPortfolio = portfolioReturns.reduce((sum, value) => sum + value, 0) / returnCount;
  const avgBenchmark = benchmarkReturns.reduce((sum, value) => sum + value, 0) / returnCount;
  const covariance = returnCount > 1
    ? portfolioReturns.reduce(
      (sum, value, index) => sum + ((value - avgPortfolio) * (benchmarkReturns[index] - avgBenchmark)),
      0,
    ) / (returnCount - 1)
    : 0;
  const benchmarkVariance = returnCount > 1
    ? benchmarkReturns.reduce((sum, value) => sum + ((value - avgBenchmark) ** 2), 0) / (returnCount - 1)
    : 0;
  let beta = null;
  if (benchmarkVariance > 1e-12) {
    beta = covariance / benchmarkVariance;
  } else if (Math.abs(benchmarkReturns[0] || 0) > 1e-12) {
    beta = portfolioReturns[0] / benchmarkReturns[0];
  }

  let rfAnnual = Number(riskFreeRateRaw);
  if (!Number.isFinite(rfAnnual)) {
    rfAnnual = 0;
  }
  if (rfAnnual > 1) {
    rfAnnual /= 100;
  }
  const rfDaily = Math.pow(1 + rfAnnual, 1 / 252) - 1;
  const alpha = Number.isFinite(beta)
    ? ((avgPortfolio - (rfDaily + beta * (avgBenchmark - rfDaily))) * 252)
    : null;
  const stdForSharpe = sampleStd(portfolioReturns);
  const sharpeRatio = stdForSharpe > 1e-12
    ? (((avgPortfolio - rfDaily) / stdForSharpe) * Math.sqrt(252))
    : 0;

  return {
    returnCount,
    totalReturn: Number.isFinite(totalReturn) ? totalReturn : 0,
    timeWeightedReturn: Number.isFinite(timeWeightedReturn) ? timeWeightedReturn : null,
    annualizedReturn: Number.isFinite(annualizedReturn) ? annualizedReturn : null,
    annualizedVolatility: Number.isFinite(annualizedVolatility) ? annualizedVolatility : null,
    beta: Number.isFinite(beta) ? beta : null,
    alpha: Number.isFinite(alpha) ? alpha : null,
    sharpeRatio: Number.isFinite(sharpeRatio) ? sharpeRatio : 0,
  };
}

function computeRealtimeCurrentProfit(realtime) {
  const realtimeHoldings = Array.isArray(realtime?.holdings) ? realtime.holdings : [];
  return realtimeHoldings.reduce((sum, holding) => {
    const pnl = Number(holding?.unrealizedPnl);
    return Number.isFinite(pnl) ? sum + pnl : sum;
  }, 0);
}

function resolveTodayPnlValue(realtime) {
  const currentProfit = computeRealtimeCurrentProfit(realtime);
  const todayPnlRaw = Number(realtime?.todayPnl);
  return Number.isFinite(todayPnlRaw) ? todayPnlRaw : currentProfit;
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
  const reportingCurrency = metaSection.reportingCurrency || realtime.reportingCurrency || "USD";
  const asOf = payload?.asOf || "N/A";

  const realtimeHoldings = Array.isArray(realtime.holdings) ? realtime.holdings : [];
  const realtimeCurrentProfit = computeRealtimeCurrentProfit(realtime);
  const todayPnlValue = Number.isFinite(Number(realtime.todayPnl))
    ? Number(realtime.todayPnl)
    : resolveTodayPnlValue(realtime);
  const currentProfitTone = realtimeCurrentProfit > 0
    ? "#16a34a"
    : (realtimeCurrentProfit < 0 ? "#dc2626" : null);
  const derivedMetrics = deriveFallbackMetricsFromBenchmark(payload, risk?.riskFreeRate);
  const fallbackTotalReturn = Number.isFinite(performance.totalReturn)
    ? Number(performance.totalReturn)
    : (derivedMetrics?.totalReturn ?? 0);
  const effectiveTwr = Number.isFinite(performance.timeWeightedReturn)
    ? Number(performance.timeWeightedReturn)
    : (derivedMetrics?.timeWeightedReturn ?? fallbackTotalReturn);
  const effectiveAnnualizedReturn = Number.isFinite(performance.annualizedReturn)
    ? Number(performance.annualizedReturn)
    : ((derivedMetrics?.returnCount ?? 0) < MIN_OBSERVATIONS_FOR_ANNUALIZED_AND_ALPHA
      ? fallbackTotalReturn
      : (derivedMetrics?.annualizedReturn ?? fallbackTotalReturn));
  const fallbackDays = Math.max(1, derivedMetrics?.returnCount ?? 0);

  const assetClassDistribution = Array.isArray(holdings.assetClassDistribution)
    ? holdings.assetClassDistribution
    : [];
  const regionDistribution = Array.isArray(holdings.regionDistribution)
    ? holdings.regionDistribution
    : [];
  const topAssetClass = assetClassDistribution[0] || null;
  const topRegion = regionDistribution.find((item) => !isUnknownRegion(item?.name))
    || regionDistribution[0]
    || null;
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
      accent: "#1f4ed8",
      pnl: {
        value: formatCurrency(todayPnlValue, reportingCurrency),
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
          key: "currentProfit",
          label: "Current Profit",
          value: formatCurrency(realtimeCurrentProfit, reportingCurrency),
          detail: "Unrealized P&L",
          valueColor: currentProfitTone,
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
      accent: "#1f4ed8",
      metrics: [
        {
          key: "totalReturn",
          label: "Total Return",
          value: formatSignedPercent(fallbackTotalReturn),
          detail: "Since inception",
        },
        {
          key: "annualizedReturn",
          label: "Annualized Return",
          value: formatSignedPercent(effectiveAnnualizedReturn),
          detail: Number.isFinite(performance.annualizedReturn)
            ? "CAGR"
            : ((derivedMetrics?.returnCount ?? 0) < MIN_OBSERVATIONS_FOR_ANNUALIZED_AND_ALPHA
              ? `Using Total Return (${fallbackDays}D window)`
              : `Annualized from ${fallbackDays} trading days`),
        },
        {
          key: "timeWeightedReturn",
          label: "Time-Weighted Return",
          value: formatSignedPercent(effectiveTwr),
          detail: Number.isFinite(performance.timeWeightedReturn)
            ? "TWR adjusted"
            : `TWR (${fallbackDays}D window)`,
        },
      ],
    },
    {
      id: "risk",
      label: "Risk",
      eyebrow: "Volatility & Ratios",
      accent: "#1f4ed8",
      metrics: [
        {
          key: "annualizedVolatility",
          label: "Annualized Volatility",
          value: formatPercent(risk.annualizedVolatility ?? derivedMetrics?.annualizedVolatility ?? 0),
          detail: risk.annualizedVolatility == null
            ? `Computed / default (${fallbackDays}D)`
            : "1Y rolling",
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
          value: toFixed(risk.sharpeRatio ?? derivedMetrics?.sharpeRatio ?? 0, 2),
          detail: risk.sharpeRatio == null ? `Computed / default (${fallbackDays}D)` : "Risk-adjusted",
        },
        {
          key: "beta",
          label: "Beta",
          value: toFixed(risk.beta ?? derivedMetrics?.beta ?? 1, 2),
          detail: risk.beta == null ? `Computed / default (${fallbackDays}D)` : "vs benchmark",
        },
        {
          key: "alpha",
          label: "Alpha",
          value: formatSignedPercent(risk.alpha ?? derivedMetrics?.alpha ?? 0),
          detail: risk.alpha == null ? `Computed / default (${fallbackDays}D)` : "Annual excess",
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
      accent: "#1f4ed8",
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
            ? `${formatRegionDisplay(topRegion.name)} ${formatPercent(topRegion.weight, 1)}`
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
      accent: "#1f4ed8",
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
export default function DashboardPage({ meta = dashboardPageMeta, activityFeed = dashboardActivityFeed }) {
  // Centralize dashboard state in index.jsx and pass it to presentational components.
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [liveHoldings, setLiveHoldings] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);
  const [dashboardPayload, setDashboardPayload] = useState(null);
  const [isLiveLoading, setIsLiveLoading] = useState(true);
  const [liveDataUnavailable, setLiveDataUnavailable] = useState(false);

  const categories = useMemo(
    () => buildLiveCategories(dashboardPayload),
    [dashboardPayload],
  );
  const donutSegments = useMemo(
    () => buildDonutSegments(dashboardPayload),
    [dashboardPayload],
  );
  const reportingCurrency = useMemo(() => {
    const realtime = dashboardPayload?.realtime || {};
    const metaSection = dashboardPayload?.meta || {};
    return metaSection.reportingCurrency || realtime.reportingCurrency || "USD";
  }, [dashboardPayload]);
  const benchmarkChartModel = useMemo(
    () => buildBenchmarkChartModel(dashboardPayload),
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
      return {
        ...meta,
        metrics: [
          {
            label: "Portfolio Value",
            value: "N/A",
            detail: "Holdings + cash",
          },
          {
            label: "Today's P&L",
            value: "N/A",
            detail: "Mark-to-market",
          },
          {
            label: "Total Return",
            value: "N/A",
            detail: "Since inception",
          },
        ],
      };
    }

    const realtime = dashboardPayload?.realtime || {};
    const performance = dashboardPayload?.performance || {};
    const metaSection = dashboardPayload?.meta || {};
    const reportingCurrency = metaSection.reportingCurrency || realtime.reportingCurrency || "USD";
    const totalValue = toNumber(realtime.holdingMarketValue, 0) + toNumber(realtime.cashBalance, 0);
    const todayPnlValue = resolveTodayPnlValue(realtime);

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
          value: formatCurrency(todayPnlValue, reportingCurrency),
          detail: "Mark-to-market",
        },
        {
          label: "Total Return",
          value: formatSignedPercent(performance.totalReturn),
          detail: "Since inception",
        },
      ],
    };
  }, [dashboardPayload, meta]);
  const resolvedActivityFeed = useMemo(() => {
    if (!dashboardPayload) {
      return activityFeed;
    }

    const newsFeed = Array.isArray(dashboardPayload?.news)
      ? dashboardPayload.news
        .map(formatNewsFeedItem)
        .filter(Boolean)
        .slice(0, 3)
      : [];
    if (newsFeed.length) {
      return newsFeed;
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
        loading: true,
      };
    }
    if (liveDataUnavailable) {
      return {
        heading: "Sync failed",
        message: "Backend data is unavailable right now.",
        loading: false,
      };
    }
    return null;
  }, [isLiveLoading, liveDataUnavailable]);

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
      const marketValue = Number.isFinite(Number(holding.marketValue))
        ? Number(holding.marketValue)
        : holding.shares * holding.currentPrice;
      const pnl = Number.isFinite(Number(holding.pnl))
        ? Number(holding.pnl)
        : marketValue - holding.shares * holding.costBasis;
      return { ...holding, marketValue, pnl };
    });
    const totalMarketValue = withMetrics.reduce((sum, holding) => (
      Number.isFinite(Number(holding.marketValue)) && Number(holding.marketValue) > 0
        ? sum + Number(holding.marketValue)
        : sum
    ), 0);
    return withMetrics.map((holding) => ({
      ...holding,
      allocation:
        totalMarketValue > 0 && Number.isFinite(Number(holding.marketValue))
          ? (Number(holding.marketValue) / totalMarketValue) * 100
          : null,
    }));
  }, [liveHoldings]);
  const capitalAllocation = useMemo(() => {
    const realtime = dashboardPayload?.realtime || {};
    const holdingsValueFromRows = enrichedHoldings.reduce((sum, holding) => (
      Number.isFinite(Number(holding.marketValue)) && Number(holding.marketValue) > 0
        ? sum + Number(holding.marketValue)
        : sum
    ), 0);
    const holdingsValue = holdingsValueFromRows > 0
      ? holdingsValueFromRows
      : toNumber(realtime.holdingMarketValue, 0);
    const cashValue = toNumber(realtime.cashBalance, 0);
    const portfolioValue = holdingsValue + cashValue;

    const segments = portfolioValue > 0
      ? [
        {
          label: "Invested Holdings",
          amount: holdingsValue,
          pct: Number(((holdingsValue / portfolioValue) * 100).toFixed(2)),
          color: "#4f7bff",
        },
        {
          label: "Cash / Uninvested",
          amount: cashValue,
          pct: Number(((cashValue / portfolioValue) * 100).toFixed(2)),
          color: "#7bd88f",
        },
      ]
      : [];

    return {
      holdingsValue,
      portfolioValue,
      segments,
    };
  }, [dashboardPayload, enrichedHoldings]);
  const symbolAllocationSegments = useMemo(() => {
    const ranked = enrichedHoldings
      .filter((holding) => Number.isFinite(Number(holding.marketValue)) && Number(holding.marketValue) > 0)
      .sort((a, b) => Number(b.marketValue) - Number(a.marketValue));

    if (!ranked.length) {
      return [];
    }

    const total = ranked.reduce((sum, holding) => sum + Number(holding.marketValue), 0);
    if (total <= 0) {
      return [];
    }

    const top = ranked.slice(0, 7).map((holding, index) => {
      const amount = Number(holding.marketValue);
      return {
        label: holding.symbol || `Asset ${index + 1}`,
        amount,
        pct: Number(((amount / total) * 100).toFixed(2)),
        color: DONUT_COLORS[index % DONUT_COLORS.length],
      };
    });

    if (ranked.length > 7) {
      const otherAmount = ranked
        .slice(7)
        .reduce((sum, holding) => sum + Number(holding.marketValue || 0), 0);
      if (otherAmount > 0) {
        top.push({
          label: "Other",
          amount: otherAmount,
          pct: Number(((otherAmount / total) * 100).toFixed(2)),
          color: DONUT_COLORS[top.length % DONUT_COLORS.length],
        });
      }
    }

    return top;
  }, [enrichedHoldings]);
  const industryAllocationSegments = useMemo(() => {
    const holdingsValue = capitalAllocation.holdingsValue;
    return (Array.isArray(donutSegments) ? donutSegments : []).map((segment, index) => {
      const pct = Number(segment?.pct || 0);
      return {
        label: segment?.label || `Sector ${index + 1}`,
        pct,
        amount: holdingsValue > 0 ? Number(((pct / 100) * holdingsValue).toFixed(2)) : null,
        color: segment?.color || DONUT_COLORS[index % DONUT_COLORS.length],
      };
    });
  }, [capitalAllocation.holdingsValue, donutSegments]);

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
      <div className="dashboard-top-grid">
        <IntroCard
          meta={resolvedMeta}
          activityFeed={resolvedActivityFeed}
          status={syncStatus}
          scrollActivity
        />
        <WorldIndicesPanel />
      </div>
      <MetricsSlider
        categories={categories}
        activeCategory={activeCategory}
        activeCategoryIndex={activeCategoryIndex}
        onPrev={goToPrevCategory}
        onNext={goToNextCategory}
        onSelectCategory={setActiveCategoryId}
        sparkPoints={SPARK_POINTS}
        benchPoints={benchmarkChartModel.benchPoints}
        benchmarkPoints={benchmarkChartModel.benchmarkPoints}
        benchmarkLabels={benchmarkChartModel.benchmarkLabels}
        benchmarkMeta={benchmarkChartModel.benchmarkMeta}
        industryDonutSegments={industryAllocationSegments}
        symbolAllocationSegments={symbolAllocationSegments}
        capitalSplitSegments={capitalAllocation.segments}
        reportingCurrency={reportingCurrency}
      />
      <div className="stock-bottom-grid">
        <section className="feature-card" style={{ padding: 18 }}>
          <HoldingsTable
            holdings={enrichedHoldings}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
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
