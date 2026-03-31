import { useState, useRef } from "react";

/* ─────────────────────────────────────────
   BENCHMARK CHART DATA
───────────────────────────────────────── */
const BENCH_DATA = {
  labels:    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  portfolio: [100, 103.2, 101.8, 107.4, 109.1, 106.3, 112.6, 115.4, 113.2, 118.7, 120.1, 118.4],
  benchmark: [100, 101.4, 100.2, 104.6, 105.8, 103.1, 107.4, 109.8, 108.3, 112.1, 114.5, 115.2],
};

function BenchmarkChart() {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const W = 520, H = 190;
  const PAD = { top: 14, right: 16, bottom: 26, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;
  const n = BENCH_DATA.labels.length;

  const allVals = [...BENCH_DATA.portfolio, ...BENCH_DATA.benchmark];
  const minV = Math.min(...allVals) - 1;
  const maxV = Math.max(...allVals) + 1;

  const xOf = (i) => PAD.left + (i / (n - 1)) * innerW;
  const yOf = (v) => PAD.top  + (1 - (v - minV) / (maxV - minV)) * innerH;

  const toPath = (arr) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ");

  const toArea = (arr) => {
    const base = yOf(minV);
    return (
      arr.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ") +
      ` L ${xOf(n - 1).toFixed(1)} ${base} L ${xOf(0).toFixed(1)} ${base} Z`
    );
  };

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = minV + (i / yTicks) * (maxV - minV);
    return { y: yOf(v), label: `${(v - 100).toFixed(0)}%` };
  });

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let nearest = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xOf(i) - mx);
      if (d < minDist) { minDist = d; nearest = i; }
    }
    setTooltip({ i: nearest, label: BENCH_DATA.labels[nearest],
      portfolio: BENCH_DATA.portfolio[nearest], benchmark: BENCH_DATA.benchmark[nearest] });
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
        {[
          { color: "#79a8ff", label: "Portfolio",  dash: false },
          { color: "#97a1b8", label: "S&P 500",    dash: true  },
        ].map(({ color, label, dash }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.73rem", fontWeight: 700, color, letterSpacing: "0.08em" }}>
            <svg width="20" height="3" style={{ overflow: "visible" }}>
              <line x1="0" y1="1.5" x2="20" y2="1.5" stroke={color} strokeWidth="2"
                strokeDasharray={dash ? "4 3" : undefined} strokeLinecap="round" />
            </svg>
            {label}
          </span>
        ))}
      </div>

      {/* SVG */}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#79a8ff" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#79a8ff" stopOpacity="0"    />
          </linearGradient>
          <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#97a1b8" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#97a1b8" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Grid + Y labels */}
        {gridLines.map(({ y, label }) => (
          <g key={label}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(109,120,151,0.13)" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end"
              fill="#97a1b8" fontSize="9" fontFamily="Manrope,sans-serif">{label}</text>
          </g>
        ))}

        {/* X labels */}
        {BENCH_DATA.labels.map((lbl, i) => (
          <text key={lbl} x={xOf(i)} y={H - 3} textAnchor="middle"
            fill="#97a1b8" fontSize="9" fontFamily="Manrope,sans-serif">{lbl}</text>
        ))}

        {/* Areas */}
        <path d={toArea(BENCH_DATA.benchmark)} fill="url(#gb)" />
        <path d={toArea(BENCH_DATA.portfolio)} fill="url(#gp)" />

        {/* Lines */}
        <path d={toPath(BENCH_DATA.benchmark)} fill="none"
          stroke="#97a1b8" strokeWidth="1.8" strokeDasharray="5 3"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(BENCH_DATA.portfolio)} fill="none"
          stroke="#79a8ff" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover indicator */}
        {tooltip && (
          <g>
            <line x1={xOf(tooltip.i)} y1={PAD.top} x2={xOf(tooltip.i)} y2={H - PAD.bottom}
              stroke="rgba(121,168,255,0.22)" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx={xOf(tooltip.i)} cy={yOf(BENCH_DATA.benchmark[tooltip.i])} r="3.5"
              fill="#0d1016" stroke="#97a1b8" strokeWidth="1.8" />
            <circle cx={xOf(tooltip.i)} cy={yOf(BENCH_DATA.portfolio[tooltip.i])} r="4"
              fill="#0d1016" stroke="#79a8ff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && (
        <div style={{
          position: "absolute", top: 24,
          left: `clamp(0px, calc(${(xOf(tooltip.i) / W) * 100}% - 68px), calc(100% - 144px))`,
          background: "rgba(13,16,22,0.96)",
          border: "1px solid rgba(121,168,255,0.22)", borderRadius: 12,
          padding: "10px 14px", pointerEvents: "none",
          backdropFilter: "blur(14px)", boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
          minWidth: 138,
        }}>
          <div style={{ fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#97a1b8", marginBottom: 6 }}>{tooltip.label}</div>
          {[
            { key: "portfolio", color: "#79a8ff", val: tooltip.portfolio },
            { key: "benchmark", color: "#97a1b8", val: tooltip.benchmark },
          ].map(({ key, color, val }) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between",
              gap: 14, fontSize: "0.79rem", marginBottom: 3 }}>
              <span style={{ color, fontWeight: 700, textTransform: "capitalize" }}>{key}</span>
              <span style={{ color: "#f2f5fb", fontWeight: 800 }}>
                {val >= 100 ? "+" : ""}{(val - 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const dashboardPageMeta = {
  eyebrow: "Operations Dashboard",
  title: "Run the desk from one calm operational view.",
  description: "",
  metrics: [],
};

export const dashboardActivityFeed = [];

/* ─────────────────────────────────────────
   METRIC CATEGORIES  (top slider)
───────────────────────────────────────── */
const CATEGORIES = [
  {
    id: "performance", label: "Performance", eyebrow: "Returns & Benchmarks", accent: "#79a8ff",
    metrics: [
      { key: "totalReturn",        label: "Total Return",         value: "+18.4%", detail: "Since inception" },
      { key: "annualizedReturn",   label: "Annualized Return",    value: "+12.8%", detail: "CAGR" },
      { key: "timeWeightedReturn", label: "Time-Weighted Return", value: "+11.3%", detail: "TWR adjusted" },
    ],
  },
  {
    id: "risk", label: "Risk", eyebrow: "Volatility & Ratios", accent: "#f59e0b",
    metrics: [
      { key: "annualizedVolatility", label: "Annualized Volatility", value: "14.7%",      detail: "1Y rolling" },
      { key: "maxDrawdown",          label: "Max Drawdown",          value: "-8.3%",       detail: "Peak to trough" },
      { key: "sharpeRatio",          label: "Sharpe Ratio",          value: "1.42",        detail: "Risk-adjusted return" },
      { key: "riskFreeRate",         label: "Risk-Free Rate",        value: "5.25%",       detail: "3-month T-bill" },
      { key: "beta",                 label: "Beta",                  value: "0.87",        detail: "vs benchmark" },
      { key: "alpha",                label: "Alpha",                 value: "3.2%",        detail: "Annual excess return" },
      { key: "benchmarkSymbol",      label: "Benchmark Symbol",      value: "SPY",         detail: "Reference index" },
      { key: "benchmarkName",        label: "Benchmark Name",        value: "S&P 500 ETF", detail: "SPDR" },
    ],
  },
  {
    id: "holdings", label: "Holdings", eyebrow: "Distribution & Concentration", accent: "#7bd88f",
    metrics: [
      { key: "assetClassDistribution", label: "Asset Class Distribution", value: "62% EQ",  detail: "Equity dominant" },
      { key: "industryDistribution",   label: "Industry Distribution",   value: "Tech 31%", detail: "Largest sector" },
      { key: "regionDistribution",     label: "Region Distribution",     value: "US 74%",   detail: "Geographic breakdown" },
      { key: "concentrationRisk",      label: "Concentration Risk",      value: "Medium",   detail: "Top 10: 48% of NAV" },
    ],
  },
  {
    id: "trading", label: "Trading", eyebrow: "Activity & Costs", accent: "#c084fc",
    metrics: [
      { key: "turnoverRate",      label: "Turnover Rate",      value: "34.2%",   detail: "Last 12 months" },
      { key: "transactionAmount", label: "Transaction Amount", value: "$2.4M",   detail: "Total traded" },
      { key: "totalFees",         label: "Total Fees",         value: "$3,840",  detail: "Commission + spread" },
      { key: "tradeCount",        label: "Trade Count",        value: "128",     detail: "Executed orders" },
      { key: "buySellRecords",    label: "Buy / Sell Records", value: "74 / 54", detail: "Directional split" },
    ],
  },
  {
    id: "realtime", label: "Realtime", eyebrow: "Live Snapshot", accent: "#38bdf8",
    metrics: [
      { key: "todayPnl",           label: "Today's P&L",         value: "+$12,480",  detail: "Mark-to-market" },
      { key: "holdingMarketValue", label: "Holding Market Value", value: "$1.84M",    detail: "Current positions" },
      { key: "cashBalance",        label: "Cash Balance",         value: "$312,500",  detail: "Available cash" },
      { key: "availableFunds",     label: "Available Funds",      value: "$298,000",  detail: "Post-settlement" },
      { key: "cashByCurrency",     label: "Cash by Currency",     value: "USD / HKD", detail: "Multi-currency" },
      { key: "holdings",           label: "Holdings Count",       value: "42",        detail: "Active positions" },
    ],
  },
];

/* ─────────────────────────────────────────
   MOCK HOLDINGS DATA
───────────────────────────────────────── */
const HOLDINGS = [
  { symbol: "AAPL",  companyName: "Apple Inc.",              label: "Tech",        shares: 320,  currentPrice: 189.30, costBasis: 142.50, marketValue: 60576,  allocation: 12.8, pnl: 14976  },
  { symbol: "MSFT",  companyName: "Microsoft Corp.",         label: "Tech",        shares: 180,  currentPrice: 415.20, costBasis: 310.00, marketValue: 74736,  allocation: 15.8, pnl: 18936  },
  { symbol: "NVDA",  companyName: "NVIDIA Corp.",            label: "Semis",       shares: 95,   currentPrice: 875.40, costBasis: 480.00, marketValue: 83163,  allocation: 17.6, pnl: 37563  },
  { symbol: "GOOGL", companyName: "Alphabet Inc.",           label: "Tech",        shares: 140,  currentPrice: 172.60, costBasis: 138.20, marketValue: 24164,  allocation: 5.1,  pnl: 4816   },
  { symbol: "AMZN",  companyName: "Amazon.com Inc.",         label: "Consumer",    shares: 210,  currentPrice: 185.50, costBasis: 155.00, marketValue: 38955,  allocation: 8.2,  pnl: 6405   },
  { symbol: "META",  companyName: "Meta Platforms Inc.",     label: "Tech",        shares: 88,   currentPrice: 512.30, costBasis: 380.00, marketValue: 45082,  allocation: 9.5,  pnl: 11642  },
  { symbol: "TSLA",  companyName: "Tesla Inc.",              label: "EV",          shares: 150,  currentPrice: 248.70, costBasis: 295.00, marketValue: 37305,  allocation: 7.9,  pnl: -6945  },
  { symbol: "JPM",   companyName: "JPMorgan Chase & Co.",    label: "Finance",     shares: 200,  currentPrice: 198.40, costBasis: 165.00, marketValue: 39680,  allocation: 8.4,  pnl: 6680   },
  { symbol: "V",     companyName: "Visa Inc.",               label: "Finance",     shares: 130,  currentPrice: 272.80, costBasis: 228.00, marketValue: 35464,  allocation: 7.5,  pnl: 5824   },
  { symbol: "JNJ",   companyName: "Johnson & Johnson",       label: "Healthcare",  shares: 175,  currentPrice: 158.90, costBasis: 168.00, marketValue: 27808,  allocation: 5.9,  pnl: -1593  },
  { symbol: "XOM",   companyName: "Exxon Mobil Corp.",       label: "Energy",      shares: 220,  currentPrice: 114.20, costBasis: 98.50,  marketValue: 25124,  allocation: 5.3,  pnl: 3454   },
  { symbol: "BRK.B", companyName: "Berkshire Hathaway B",    label: "Finance",     shares: 95,   currentPrice: 362.10, costBasis: 310.00, marketValue: 34400,  allocation: 7.3,  pnl: 4950   },
  { symbol: "LLY",   companyName: "Eli Lilly and Co.",       label: "Healthcare",  shares: 42,   currentPrice: 780.50, costBasis: 620.00, marketValue: 32781,  allocation: 6.9,  pnl: 6741   },
  { symbol: "HD",    companyName: "Home Depot Inc.",         label: "Consumer",    shares: 68,   currentPrice: 342.60, costBasis: 298.00, marketValue: 23297,  allocation: 4.9,  pnl: 3031   },
];

/* ─────────────────────────────────────────
   MOCK TRADE RECORDS
───────────────────────────────────────── */
const ALL_TRADES = [
  { id: 1,  symbol: "NVDA",  companyName: "NVIDIA Corp.",         side: "BUY",  shares: 20,  price: 865.20, date: "2024-03-28", total: 17304  },
  { id: 2,  symbol: "AAPL",  companyName: "Apple Inc.",           side: "BUY",  shares: 50,  price: 187.40, date: "2024-03-27", total: 9370   },
  { id: 3,  symbol: "MSFT",  companyName: "Microsoft Corp.",      side: "SELL", shares: 30,  price: 418.00, date: "2024-03-26", total: 12540  },
  { id: 4,  symbol: "META",  companyName: "Meta Platforms Inc.",  side: "BUY",  shares: 15,  price: 508.70, date: "2024-03-25", total: 7631   },
  { id: 5,  symbol: "TSLA",  companyName: "Tesla Inc.",           side: "SELL", shares: 40,  price: 255.30, date: "2024-03-22", total: 10212  },
  { id: 6,  symbol: "JPM",   companyName: "JPMorgan Chase",       side: "BUY",  shares: 60,  price: 195.80, date: "2024-03-21", total: 11748  },
  { id: 7,  symbol: "AMZN",  companyName: "Amazon.com Inc.",      side: "BUY",  shares: 45,  price: 182.20, date: "2024-03-20", total: 8199   },
  { id: 8,  symbol: "GOOGL", companyName: "Alphabet Inc.",        side: "SELL", shares: 25,  price: 175.40, date: "2024-03-19", total: 4385   },
  { id: 9,  symbol: "V",     companyName: "Visa Inc.",            side: "BUY",  shares: 35,  price: 270.10, date: "2024-03-18", total: 9454   },
  { id: 10, symbol: "LLY",   companyName: "Eli Lilly and Co.",    side: "BUY",  shares: 8,   price: 775.00, date: "2024-03-15", total: 6200   },
  { id: 11, symbol: "AAPL",  companyName: "Apple Inc.",           side: "SELL", shares: 80,  price: 184.50, date: "2024-03-14", total: 14760  },
  { id: 12, symbol: "NVDA",  companyName: "NVIDIA Corp.",         side: "BUY",  shares: 15,  price: 845.00, date: "2024-03-13", total: 12675  },
  { id: 13, symbol: "XOM",   companyName: "Exxon Mobil Corp.",    side: "BUY",  shares: 70,  price: 112.40, date: "2024-03-12", total: 7868   },
  { id: 14, symbol: "JNJ",   companyName: "Johnson & Johnson",    side: "SELL", shares: 50,  price: 160.20, date: "2024-03-11", total: 8010   },
  { id: 15, symbol: "MSFT",  companyName: "Microsoft Corp.",      side: "BUY",  shares: 25,  price: 408.30, date: "2024-03-08", total: 10208  },
  { id: 16, symbol: "BRK.B", companyName: "Berkshire Hathaway B", side: "BUY",  shares: 30,  price: 358.00, date: "2024-03-07", total: 10740  },
  { id: 17, symbol: "HD",    companyName: "Home Depot Inc.",      side: "BUY",  shares: 20,  price: 338.50, date: "2024-03-06", total: 6770   },
  { id: 18, symbol: "TSLA",  companyName: "Tesla Inc.",           side: "BUY",  shares: 60,  price: 198.40, date: "2024-03-05", total: 11904  },
  { id: 19, symbol: "META",  companyName: "Meta Platforms Inc.",  side: "SELL", shares: 20,  price: 495.60, date: "2024-03-04", total: 9912   },
  { id: 20, symbol: "JPM",   companyName: "JPMorgan Chase",       side: "SELL", shares: 40,  price: 192.30, date: "2024-03-01", total: 7692   },
];

const DEFAULT_TRADES = ALL_TRADES.slice(0, 10);

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (n) =>
  n >= 0
    ? `+$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
    : `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

/* ─────────────────────────────────────────
   COMPONENT
───────────────────────────────────────── */
export default function DashboardPage() {
  /* slider state */
  const [active, setActive]       = useState(0);
  const [direction, setDirection] = useState(null);
  const [animating, setAnimating] = useState(false);

  /* holdings / trades state */
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const navigate = (nextIdx) => {
    if (animating || nextIdx === active) return;
    setDirection(nextIdx > active ? "left" : "right");
    setAnimating(true);
    setTimeout(() => { setActive(nextIdx); setAnimating(false); setDirection(null); }, 280);
  };

  const prev = () => navigate((active - 1 + CATEGORIES.length) % CATEGORIES.length);
  const next = () => navigate((active + 1) % CATEGORIES.length);
  const cat  = CATEGORIES[active];

  const visibleTrades = selectedSymbol
    ? ALL_TRADES.filter((t) => t.symbol === selectedSymbol)
    : DEFAULT_TRADES;

  const panelTitle = selectedSymbol
    ? `${selectedSymbol} — Trade History`
    : "Recent Trades (Top 10)";

  return (
    <>
      <style>{`
        /* ══════════════════════════════════
           TOP SLIDER
        ══════════════════════════════════ */
        .metrics-slider {
          border: 1px solid rgba(109,120,151,0.18);
          background:
            linear-gradient(180deg,rgba(14,17,24,0.97),rgba(10,12,18,0.95)),
            radial-gradient(circle at top right,rgba(79,123,255,0.07),transparent 35%);
          backdrop-filter: blur(20px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.42);
          border-radius: 30px;
          padding: 44px 48px 36px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .slider-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .slider-tab-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .slider-tab {
          padding: 8px 20px;
          border-radius: 999px;
          border: 1px solid rgba(109,120,151,0.18);
          background: transparent;
          color: #97a1b8;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color 180ms, background 180ms, color 180ms;
        }
        .slider-tab.active { color: #f2f5fb; background: rgba(34,40,57,0.94); }
        .slider-nav { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
        .slider-btn {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 999px;
          border: 1px solid rgba(109,120,151,0.24);
          background: rgba(17,21,29,0.92); color: #d4dbec;
          cursor: pointer; font-size: 1.05rem;
          transition: border-color 180ms, background 180ms, transform 180ms;
        }
        .slider-btn:hover { border-color: rgba(121,168,255,0.4); background: rgba(34,40,57,0.94); transform: translateY(-1px); }
        .slider-dots { display: flex; align-items: center; gap: 8px; }
        .slider-dot {
          width: 8px; height: 8px; border-radius: 999px; border: none;
          cursor: pointer; padding: 0;
          transition: width 240ms, background 240ms, opacity 240ms;
          opacity: 0.38; background: #97a1b8;
        }
        .slider-dot.active { width: 26px; opacity: 1; }
        .slider-heading-row {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 24px; margin-bottom: 28px; flex-wrap: wrap;
        }
        .slider-title-block { display: grid; gap: 6px; }
        .slider-eyebrow {
          margin: 0; font-size: 0.74rem; letter-spacing: 0.18em;
          text-transform: uppercase; font-weight: 800;
          transition: color 280ms;
        }
        .slider-title {
          margin: 0; font-family: "Cormorant Garamond", serif;
          font-size: clamp(3rem,5vw,5rem); letter-spacing: -0.04em;
          line-height: 0.92; color: #f7f9ff;
        }
        .slider-count { font-size: 0.82rem; color: #97a1b8; align-self: flex-end; padding-bottom: 4px; }
        .slide-viewport { overflow: hidden; min-height: 260px; }
        .slide-content {
          transition: opacity 280ms, transform 280ms;
        }
        .slide-content.exiting-left  { opacity: 0; transform: translateX(-36px); }
        .slide-content.exiting-right { opacity: 0; transform: translateX(36px);  }
        /* generic card grid for non-performance slides */
        .slide-card-grid {
          display: grid; gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(220px,1fr));
        }
        /* performance layout: metric cards left, chart right */
        .perf-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 18px;
          align-items: stretch;
        }
        .perf-cards { display: flex; flex-direction: column; gap: 14px; }
        .perf-chart-panel {
          padding: 22px 24px 18px; border-radius: 24px;
          background: linear-gradient(180deg,rgba(17,21,29,0.96),rgba(10,13,19,0.92));
          border: 1px solid rgba(121,168,255,0.14);
          display: flex; flex-direction: column; gap: 0;
        }
        .perf-chart-heading { margin: 0 0 2px; font-size: 0.72rem; letter-spacing: 0.14em;
          text-transform: uppercase; font-weight: 800; color: #97a1b8; }
        .perf-chart-sub { margin: 0 0 16px; font-size: 0.85rem; font-weight: 700; color: #79a8ff; }
        .slide-metric {
          padding: 26px 28px; border-radius: 24px;
          background: linear-gradient(180deg,rgba(17,21,29,0.96),rgba(10,13,19,0.92));
          border: 1px solid rgba(108,125,158,0.14);
          display: grid; gap: 8px;
          transition: border-color 200ms, transform 200ms, box-shadow 200ms;
        }
        .slide-metric:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,0.28); }
        .slide-metric-label {
          margin: 0; font-size: 0.72rem; letter-spacing: 0.14em;
          text-transform: uppercase; font-weight: 800; color: #97a1b8;
        }
        .slide-metric-value {
          display: block; margin: 4px 0 2px;
          font-size: 2rem; font-weight: 800; letter-spacing: -0.03em;
          line-height: 1; transition: color 280ms;
        }
        .slide-metric-detail { margin: 0; font-size: 0.82rem; color: #97a1b8; line-height: 1.55; }
        .slide-progress {
          margin-top: 28px; height: 2px;
          background: rgba(109,120,151,0.12); border-radius: 999px; overflow: hidden;
        }
        .slide-progress-bar { height: 100%; border-radius: 999px; transition: width 320ms, background 320ms; }

        /* ══════════════════════════════════
           BOTTOM PANEL
        ══════════════════════════════════ */
        .bottom-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
        }

        /* ── Holdings table panel ── */
        .holdings-panel {
          border: 1px solid rgba(109,120,151,0.18);
          background: rgba(12,15,22,0.88);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.38);
          border-radius: 28px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 520px;
        }
        .holdings-header {
          padding: 22px 26px 16px;
          border-bottom: 1px solid rgba(109,120,151,0.12);
          flex-shrink: 0;
        }
        .holdings-header-top {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .holdings-title {
          margin: 0;
          font-family: "Cormorant Garamond", serif;
          font-size: 1.6rem; letter-spacing: -0.03em; color: #f7f9ff;
        }
        .holdings-count-badge {
          padding: 4px 12px; border-radius: 999px;
          background: rgba(121,168,255,0.1);
          border: 1px solid rgba(121,168,255,0.2);
          font-size: 0.72rem; font-weight: 700;
          color: #79a8ff; letter-spacing: 0.08em;
        }
        .holdings-scroll {
          overflow-y: auto;
          overflow-x: auto;
          flex: 1;
        }
        .holdings-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .holdings-scroll::-webkit-scrollbar-track { background: transparent; }
        .holdings-scroll::-webkit-scrollbar-thumb { background: rgba(109,120,151,0.28); border-radius: 999px; }
        .holdings-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
          font-size: 0.82rem;
        }
        .holdings-table thead tr {
          border-bottom: 1px solid rgba(109,120,151,0.14);
          position: sticky; top: 0;
          background: rgba(12,15,22,0.97);
          z-index: 2;
        }
        .holdings-table th {
          padding: 10px 14px;
          text-align: right;
          font-size: 0.68rem; font-weight: 800;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #97a1b8; white-space: nowrap;
        }
        .holdings-table th:first-child,
        .holdings-table th:nth-child(2),
        .holdings-table th:nth-child(3) { text-align: left; }
        .holdings-table tbody tr {
          border-bottom: 1px solid rgba(109,120,151,0.07);
          cursor: pointer;
          transition: background 150ms;
        }
        .holdings-table tbody tr:last-child { border-bottom: none; }
        .holdings-table tbody tr:hover { background: rgba(121,168,255,0.05); }
        .holdings-table tbody tr.selected { background: rgba(121,168,255,0.09); }
        .holdings-table td {
          padding: 12px 14px;
          text-align: right;
          color: #d4dbec;
          white-space: nowrap;
        }
        .holdings-table td:first-child,
        .holdings-table td:nth-child(2),
        .holdings-table td:nth-child(3) { text-align: left; }
        .td-symbol { font-weight: 800; color: #f2f5fb; font-size: 0.88rem; }
        .td-company { color: #97a1b8; font-size: 0.78rem; max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
        .td-label {
          display: inline-block;
          padding: 2px 8px; border-radius: 999px;
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em;
          background: rgba(121,168,255,0.1); color: #79a8ff;
          border: 1px solid rgba(121,168,255,0.18);
        }
        .td-positive { color: #7bd88f; font-weight: 700; }
        .td-negative { color: #f87171; font-weight: 700; }

        /* ── Trades panel ── */
        .trades-panel {
          border: 1px solid rgba(109,120,151,0.18);
          background: rgba(12,15,22,0.88);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.38);
          border-radius: 28px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 520px;
        }
        .trades-header {
          padding: 22px 26px 16px;
          border-bottom: 1px solid rgba(109,120,151,0.12);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .trades-title {
          margin: 0;
          font-family: "Cormorant Garamond", serif;
          font-size: 1.3rem; letter-spacing: -0.03em; color: #f7f9ff;
          line-height: 1.2;
        }
        .trades-clear-btn {
          padding: 4px 12px; border-radius: 999px;
          background: transparent;
          border: 1px solid rgba(109,120,151,0.24);
          font-size: 0.7rem; font-weight: 700;
          color: #97a1b8; cursor: pointer; letter-spacing: 0.06em;
          transition: border-color 160ms, color 160ms;
        }
        .trades-clear-btn:hover { border-color: rgba(121,168,255,0.4); color: #79a8ff; }
        .trades-scroll {
          overflow-y: auto; flex: 1;
        }
        .trades-scroll::-webkit-scrollbar { width: 4px; }
        .trades-scroll::-webkit-scrollbar-track { background: transparent; }
        .trades-scroll::-webkit-scrollbar-thumb { background: rgba(109,120,151,0.28); border-radius: 999px; }
        .trade-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 14px;
          padding: 14px 24px;
          border-bottom: 1px solid rgba(109,120,151,0.07);
          transition: background 150ms;
        }
        .trade-row:last-child { border-bottom: none; }
        .trade-row:hover { background: rgba(121,168,255,0.04); }
        .trade-side-badge {
          width: 48px; text-align: center;
          padding: 4px 0; border-radius: 8px;
          font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em;
          flex-shrink: 0;
        }
        .trade-side-badge.buy  { background: rgba(123,216,143,0.12); color: #7bd88f; border: 1px solid rgba(123,216,143,0.22); }
        .trade-side-badge.sell { background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.22); }
        .trade-info { min-width: 0; }
        .trade-symbol { font-weight: 800; font-size: 0.9rem; color: #f2f5fb; }
        .trade-company { font-size: 0.75rem; color: #97a1b8; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .trade-meta { font-size: 0.72rem; color: #97a1b8; margin-top: 3px; }
        .trade-right { text-align: right; flex-shrink: 0; }
        .trade-total { font-weight: 800; font-size: 0.92rem; color: #f2f5fb; }
        .trade-date { font-size: 0.72rem; color: #97a1b8; margin-top: 2px; }
        .trades-empty {
          padding: 48px 24px;
          text-align: center;
          color: #97a1b8;
          font-size: 0.88rem;
        }

        @media (max-width: 1080px) {
          .bottom-panel  { grid-template-columns: 1fr; }
          .perf-layout   { grid-template-columns: 1fr; }
          .metrics-slider { padding: 28px 24px 24px; }
        }
        @media (max-width: 720px) {
          .metrics-slider { padding: 24px 16px 20px; }
          .slide-card-grid { grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); }
        }
      `}</style>

      {/* ══════════════════════════════════
          TOP — Sliding metrics panel
      ══════════════════════════════════ */}
      <section className="metrics-slider">
        <div className="slider-top-bar">
          <div className="slider-tab-row">
            {CATEGORIES.map((c, idx) => (
              <button
                key={c.id}
                className={`slider-tab${idx === active ? " active" : ""}`}
                style={idx === active ? { borderColor: cat.accent + "66", color: cat.accent } : {}}
                onClick={() => navigate(idx)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="slider-nav">
            <button className="slider-btn" onClick={prev} aria-label="Previous">&#8592;</button>
            <div className="slider-dots">
              {CATEGORIES.map((c, idx) => (
                <button
                  key={c.id}
                  className={`slider-dot${idx === active ? " active" : ""}`}
                  style={idx === active ? { background: cat.accent } : {}}
                  onClick={() => navigate(idx)}
                  aria-label={c.label}
                />
              ))}
            </div>
            <button className="slider-btn" onClick={next} aria-label="Next">&#8594;</button>
          </div>
        </div>

        <div className="slider-heading-row">
          <div className="slider-title-block">
            <p className="slider-eyebrow" style={{ color: cat.accent }}>{cat.eyebrow}</p>
            <h2 className="slider-title">{cat.label}</h2>
          </div>
          <span className="slider-count">
            {String(active + 1).padStart(2, "0")} / {String(CATEGORIES.length).padStart(2, "0")}
          </span>
        </div>

        <div className="slide-viewport">
          <div
            className={`slide-content${
              animating && direction === "left"  ? " exiting-left"  :
              animating && direction === "right" ? " exiting-right" : ""
            }`}
          >
            {cat.id === "performance" ? (
              <div className="perf-layout">
                {/* Left: 3 metric cards stacked */}
                <div className="perf-cards">
                  {cat.metrics.map((m) => (
                    <article key={m.key} className="slide-metric"
                      style={{ borderColor: cat.accent + "28", flex: 1 }}>
                      <p className="slide-metric-label">{m.label}</p>
                      <strong className="slide-metric-value"
                        style={{ color: cat.accent, fontSize: "1.65rem" }}>{m.value}</strong>
                      <p className="slide-metric-detail">{m.detail}</p>
                    </article>
                  ))}
                </div>
                {/* Right: benchmark line chart */}
                <div className="perf-chart-panel">
                  <p className="perf-chart-heading">Benchmark Comparisons</p>
                  <p className="perf-chart-sub">Portfolio vs S&amp;P 500 — YTD cumulative return</p>
                  <BenchmarkChart />
                </div>
              </div>
            ) : (
              <div className="slide-card-grid">
                {cat.metrics.map((m) => (
                  <article key={m.key} className="slide-metric"
                    style={{ borderColor: cat.accent + "28" }}>
                    <p className="slide-metric-label">{m.label}</p>
                    <strong className="slide-metric-value" style={{ color: cat.accent }}>{m.value}</strong>
                    <p className="slide-metric-detail">{m.detail}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="slide-progress">
          <div
            className="slide-progress-bar"
            style={{ width: `${((active + 1) / CATEGORIES.length) * 100}%`, background: cat.accent }}
          />
        </div>
      </section>

      {/* ══════════════════════════════════
          BOTTOM — Holdings + Trades
      ══════════════════════════════════ */}
      <div className="bottom-panel">

        {/* ── Left: Holdings table ── */}
        <div className="holdings-panel">
          <div className="holdings-header">
            <div className="holdings-header-top">
              <h3 className="holdings-title">Current Holdings</h3>
              <span className="holdings-count-badge">{HOLDINGS.length} positions</span>
            </div>
          </div>
          <div className="holdings-scroll">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Company</th>
                  <th>Label</th>
                  <th>Shares</th>
                  <th>Current Price</th>
                  <th>Cost Basis</th>
                  <th>Market Value</th>
                  <th>Allocation</th>
                  <th>P / L</th>
                </tr>
              </thead>
              <tbody>
                {HOLDINGS.map((h) => (
                  <tr
                    key={h.symbol}
                    className={selectedSymbol === h.symbol ? "selected" : ""}
                    onClick={() =>
                      setSelectedSymbol(selectedSymbol === h.symbol ? null : h.symbol)
                    }
                  >
                    <td className="td-symbol">{h.symbol}</td>
                    <td className="td-company">{h.companyName}</td>
                    <td><span className="td-label">{h.label}</span></td>
                    <td>{h.shares.toLocaleString()}</td>
                    <td>${h.currentPrice.toFixed(2)}</td>
                    <td>${h.costBasis.toFixed(2)}</td>
                    <td>${h.marketValue.toLocaleString()}</td>
                    <td>{h.allocation.toFixed(1)}%</td>
                    <td className={h.pnl >= 0 ? "td-positive" : "td-negative"}>
                      {fmt(h.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right: Trade records ── */}
        <div className="trades-panel">
          <div className="trades-header">
            <h3 className="trades-title">{panelTitle}</h3>
            {selectedSymbol && (
              <button className="trades-clear-btn" onClick={() => setSelectedSymbol(null)}>
                ✕ All
              </button>
            )}
          </div>
          <div className="trades-scroll">
            {visibleTrades.length === 0 ? (
              <div className="trades-empty">No trade records found for {selectedSymbol}.</div>
            ) : (
              visibleTrades.map((t) => (
                <div key={t.id} className="trade-row">
                  <span className={`trade-side-badge ${t.side.toLowerCase()}`}>{t.side}</span>
                  <div className="trade-info">
                    <div className="trade-symbol">{t.symbol}</div>
                    <div className="trade-company">{t.companyName}</div>
                    <div className="trade-meta">{t.shares} shares @ ${t.price.toFixed(2)}</div>
                  </div>
                  <div className="trade-right">
                    <div className="trade-total">${t.total.toLocaleString()}</div>
                    <div className="trade-date">{t.date}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </>
  );
}
