import { useState, useRef } from "react";

/* ─────────────────────────────────────────
   BENCHMARK CHART
───────────────────────────────────────── */
const BENCH_DATA = {
  labels:    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  portfolio: [100, 103.2, 101.8, 107.4, 109.1, 106.3, 112.6, 115.4, 113.2, 118.7, 120.1, 118.4],
  benchmark: [100, 101.4, 100.2, 104.6, 105.8, 103.1, 107.4, 109.8, 108.3, 112.1, 114.5, 115.2],
};

function BenchmarkChart({ animKey }) {
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
    return arr.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ") +
      ` L ${xOf(n-1).toFixed(1)} ${base} L ${xOf(0).toFixed(1)} ${base} Z`;
  };
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const v = minV + (i / 4) * (maxV - minV);
    return { y: yOf(v), label: `${(v - 100).toFixed(0)}%` };
  });
  const handleMouseMove = (e) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let nearest = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(xOf(i) - mx); if (d < minDist) { minDist = d; nearest = i; } }
    setTooltip({ i: nearest, label: BENCH_DATA.labels[nearest],
      portfolio: BENCH_DATA.portfolio[nearest], benchmark: BENCH_DATA.benchmark[nearest] });
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
        {[{ color: "#4f7bff", label: "Portfolio", dash: false }, { color: "#9ca3af", label: "S&P 500", dash: true }]
          .map(({ color, label, dash }) => (
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
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4f7bff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f7bff" stopOpacity="0"    />
          </linearGradient>
          <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#9ca3af" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#9ca3af" stopOpacity="0"    />
          </linearGradient>
        </defs>
        {gridLines.map(({ y, label }) => (
          <g key={label}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(17,24,39,0.07)" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="9" fontFamily="Manrope,sans-serif">{label}</text>
          </g>
        ))}
        {BENCH_DATA.labels.map((lbl, i) => (
          <text key={lbl} x={xOf(i)} y={H - 3} textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Manrope,sans-serif">{lbl}</text>
        ))}
        <path key={`ba-${animKey}`} d={toArea(BENCH_DATA.benchmark)} fill="url(#gb)" className="anim-area-slow" style={{ animationDelay: "200ms" }} />
        <path key={`pa-${animKey}`} d={toArea(BENCH_DATA.portfolio)} fill="url(#gp)" className="anim-area-slow" style={{ animationDelay: "400ms" }} />
        <path key={`bl-${animKey}`} d={toPath(BENCH_DATA.benchmark)} fill="none" stroke="#9ca3af" strokeWidth="1.8"
          strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round"
          className="anim-line-slow" style={{ animationDelay: "0ms" }} />
        <path key={`pl-${animKey}`} d={toPath(BENCH_DATA.portfolio)} fill="none" stroke="#4f7bff" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          className="anim-line-slow" style={{ animationDelay: "150ms" }} />
        {tooltip && (
          <g>
            <line x1={xOf(tooltip.i)} y1={PAD.top} x2={xOf(tooltip.i)} y2={H - PAD.bottom}
              stroke="rgba(79,123,255,0.2)" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx={xOf(tooltip.i)} cy={yOf(BENCH_DATA.benchmark[tooltip.i])} r="3.5"
              fill="#ffffff" stroke="#9ca3af" strokeWidth="1.8" />
            <circle cx={xOf(tooltip.i)} cy={yOf(BENCH_DATA.portfolio[tooltip.i])} r="4"
              fill="#ffffff" stroke="#4f7bff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {tooltip && (
        <div style={{
          position: "absolute", top: 24,
          left: `clamp(0px, calc(${(xOf(tooltip.i) / W) * 100}% - 68px), calc(100% - 144px))`,
          background: "#ffffff", border: "1px solid rgba(17,24,39,0.1)", borderRadius: 12,
          padding: "10px 14px", pointerEvents: "none",
          boxShadow: "0 8px 28px rgba(17,24,39,0.1)", minWidth: 138,
        }}>
          <div style={{ fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#9ca3af", marginBottom: 6 }}>{tooltip.label}</div>
          {[{ key: "portfolio", color: "#4f7bff", val: tooltip.portfolio },
            { key: "benchmark", color: "#6b7280", val: tooltip.benchmark }].map(({ key, color, val }) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: "0.79rem", marginBottom: 3 }}>
              <span style={{ color, fontWeight: 700, textTransform: "capitalize" }}>{key}</span>
              <span style={{ color: "#111827", fontWeight: 800 }}>{val >= 100 ? "+" : ""}{(val - 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   INTRADAY P&L SPARKLINE
───────────────────────────────────────── */
const INTRADAY_PNL = [
  { time: "9:30",  pnl:     0 },
  { time: "10:00", pnl:  2140 },
  { time: "10:30", pnl:  4870 },
  { time: "11:00", pnl:  3620 },
  { time: "11:30", pnl:  6310 },
  { time: "12:00", pnl:  5480 },
  { time: "12:30", pnl:  7920 },
  { time: "13:00", pnl:  9250 },
  { time: "13:30", pnl:  8100 },
  { time: "14:00", pnl: 10640 },
  { time: "14:30", pnl: 11380 },
  { time: "15:00", pnl: 10820 },
  { time: "15:30", pnl: 12480 },
];

function PnlSparkline({ animKey }) {
  const [hover, setHover] = useState(null);
  const W = 260, H = 80;
  const PAD = { top: 8, right: 4, bottom: 20, left: 4 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top  - PAD.bottom;
  const n  = INTRADAY_PNL.length;
  const vals = INTRADAY_PNL.map((d) => d.pnl);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const xOf  = (i) => PAD.left + (i / (n - 1)) * iW;
  const yOf  = (v) => PAD.top + (1 - (v - minV) / (maxV - minV || 1)) * iH;
  const linePath = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L ${xOf(n-1).toFixed(1)} ${H - PAD.bottom} L ${xOf(0).toFixed(1)} ${H - PAD.bottom} Z`;
  const color = "#16a34a";
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let nearest = 0, best = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(xOf(i) - mx); if (d < best) { best = d; nearest = i; } }
    setHover(nearest);
  };
  return (
    <div style={{ position: "relative", marginTop: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="spark-pnl-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <line x1={PAD.left} y1={yOf(0)} x2={W - PAD.right} y2={yOf(0)}
          stroke="rgba(17,24,39,0.08)" strokeWidth="1" strokeDasharray="3 2" />
        <path key={`sa-${animKey}`} d={areaPath} fill="url(#spark-pnl-grad)"
          className="anim-area-slow" style={{ animationDelay: "200ms" }} />
        <path key={`sl-${animKey}`} d={linePath} fill="none" stroke={color} strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          className="anim-line-slow" style={{ animationDelay: "0ms" }} />
        {[0, n - 1].map((i) => (
          <text key={i} x={xOf(i)} y={H - 4}
            textAnchor={i === 0 ? "start" : "end"}
            fill="#9ca3af" fontSize="8.5" fontFamily="Manrope,sans-serif">
            {INTRADAY_PNL[i].time}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={xOf(hover)} y1={PAD.top} x2={xOf(hover)} y2={H - PAD.bottom}
              stroke="rgba(17,24,39,0.14)" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={xOf(hover)} cy={yOf(vals[hover])} r="3.5"
              fill="#ffffff" stroke={color} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute", top: 0,
          left: `clamp(0px, calc(${(xOf(hover) / W) * 100}% - 46px), calc(100% - 100px))`,
          background: "#ffffff", border: "1px solid rgba(17,24,39,0.1)",
          borderRadius: 8, padding: "5px 10px", pointerEvents: "none",
          boxShadow: "0 4px 14px rgba(17,24,39,0.08)",
        }}>
          <div style={{ fontSize: "0.63rem", color: "#6b7280", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {INTRADAY_PNL[hover].time}
          </div>
          <div style={{ fontSize: "0.82rem", fontWeight: 800,
            color: INTRADAY_PNL[hover].pnl >= 0 ? "#16a34a" : "#dc2626" }}>
            {INTRADAY_PNL[hover].pnl >= 0 ? "+" : ""}${Math.abs(INTRADAY_PNL[hover].pnl).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   INDUSTRY PIE / DONUT CHART
───────────────────────────────────────── */
const INDUSTRY_DATA = [
  { label: "Tech",       pct: 31, color: "#4f7bff" },
  { label: "Finance",    pct: 21, color: "#7bd88f" },
  { label: "Healthcare", pct: 13, color: "#38bdf8" },
  { label: "Consumer",   pct: 10, color: "#f59e0b" },
  { label: "Energy",     pct:  9, color: "#f97316" },
  { label: "EV",         pct:  8, color: "#c084fc" },
  { label: "Semis",      pct:  8, color: "#fb7185" },
];

function IndustryPieChart({ animKey }) {
  const [hovered, setHovered] = useState(null);
  const cx = 100, cy = 100, R = 80, innerR = 50;
  let cum = 0;
  const segments = INDUSTRY_DATA.map((d) => {
    const start = (cum / 100) * 2 * Math.PI - Math.PI / 2;
    cum += d.pct;
    const end = (cum / 100) * 2 * Math.PI - Math.PI / 2;
    return { ...d, start, end };
  });
  const arc = (start, end, outerRad, inRad) => {
    const x1 = cx + outerRad * Math.cos(start), y1 = cy + outerRad * Math.sin(start);
    const x2 = cx + outerRad * Math.cos(end),   y2 = cy + outerRad * Math.sin(end);
    const x3 = cx + inRad    * Math.cos(end),   y3 = cy + inRad    * Math.sin(end);
    const x4 = cx + inRad    * Math.cos(start), y4 = cy + inRad    * Math.sin(start);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerRad} ${outerRad} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${inRad} ${inRad} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Donut — full width, larger */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: 240, height: "auto", display: "block" }}>
          {segments.map((seg, i) => (
            <path
              key={`${seg.label}-${animKey}`}
              d={arc(seg.start, seg.end, hovered === i ? R + 6 : R, innerR)}
              fill={seg.color}
              opacity={hovered === null || hovered === i ? 1 : 0.4}
              style={{
                animationName: "pie-appear",
                animationDuration: `${500 + i * 70}ms`,
                animationTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                animationFillMode: "both",
                animationDelay: `${i * 55}ms`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: "opacity 180ms",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <text x={cx} y={cy - 7} textAnchor="middle"
            fill="#111827" fontSize="19" fontWeight="800" fontFamily="Manrope,sans-serif">
            {hovered !== null ? `${INDUSTRY_DATA[hovered].pct}%` : "7"}
          </text>
          <text x={cx} y={cy + 11} textAnchor="middle"
            fill="#6b7280" fontSize="8.5" fontWeight="700" fontFamily="Manrope,sans-serif" letterSpacing="0.12em">
            {hovered !== null ? INDUSTRY_DATA[hovered].label.toUpperCase() : "SECTORS"}
          </text>
        </svg>
      </div>
      {/* Legend — horizontal wrap */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
        {INDUSTRY_DATA.map((d, i) => (
          <div key={d.label}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              opacity: hovered === null || hovered === i ? 1 : 0.35, transition: "opacity 180ms" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{d.label}</span>
            <span style={{ fontSize: "0.72rem", color: "#111827", fontWeight: 800 }}>{d.pct}%</span>
          </div>
        ))}
      </div>
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
    id: "realtime", label: "Realtime", eyebrow: "Live Snapshot", accent: "#38bdf8",
    pnl: { value: "+$12,480", detail: "Mark-to-market · Today" },
    metrics: [
      { key: "holdingMarketValue", label: "Holding Market Value", value: "$1.84M",    detail: "Current positions" },
      { key: "cashBalance",        label: "Cash Balance",         value: "$312,500",  detail: "Available cash" },
      { key: "availableFunds",     label: "Available Funds",      value: "$298,000",  detail: "Post-settlement" },
      { key: "cashByCurrency",     label: "Cash by Currency",     value: "USD / HKD", detail: "Multi-currency" },
      { key: "holdings",           label: "Holdings Count",       value: "42",        detail: "Active positions" },
    ],
  },
  {
    id: "performance", label: "Performance", eyebrow: "Returns & Benchmarks", accent: "#4f7bff",
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
      { key: "sharpeRatio",          label: "Sharpe Ratio",          value: "1.42",        detail: "Risk-adjusted" },
      { key: "beta",                 label: "Beta",                  value: "0.87",        detail: "vs benchmark" },
      { key: "alpha",                label: "Alpha",                 value: "3.2%",        detail: "Annual excess" },
      { key: "riskFreeRate",         label: "Risk-Free Rate",        value: "5.25%",       detail: "3M T-bill" },
    ],
  },
  {
    id: "holdings", label: "Holdings", eyebrow: "Distribution & Concentration", accent: "#7bd88f",
    metrics: [
      { key: "assetClassDistribution", label: "Asset Class",       value: "62% EQ",  detail: "Equity dominant" },
      { key: "regionDistribution",     label: "Region",            value: "US 74%",  detail: "Geographic breakdown" },
      { key: "concentrationRisk",      label: "Concentration",     value: "Medium",  detail: "Top 10: 48% of NAV" },
    ],
  },
  {
    id: "trading", label: "Trading", eyebrow: "Activity & Costs", accent: "#c084fc",
    metrics: [
      { key: "turnoverRate",      label: "Turnover Rate",      value: "34.2%",   detail: "Last 12 months" },
      { key: "transactionAmount", label: "Transaction Amount", value: "$2.4M",   detail: "Total traded" },
      { key: "totalFees",         label: "Total Fees",         value: "$3,840",  detail: "Commission + spread" },
      { key: "tradeCount",        label: "Trade Count",        value: "128",     detail: "Executed orders" },
      { key: "buySellRecords",    label: "Buy / Sell",         value: "74 / 54", detail: "Directional split" },
    ],
  },
];

/* ─────────────────────────────────────────
   MOCK HOLDINGS DATA
───────────────────────────────────────── */
const HOLDINGS = [
  { symbol: "AAPL",  companyName: "Apple Inc.",           label: "Tech",       shares: 320, currentPrice: 189.30, costBasis: 142.50, marketValue: 60576, allocation: 12.8, pnl:  14976 },
  { symbol: "MSFT",  companyName: "Microsoft Corp.",      label: "Tech",       shares: 180, currentPrice: 415.20, costBasis: 310.00, marketValue: 74736, allocation: 15.8, pnl:  18936 },
  { symbol: "NVDA",  companyName: "NVIDIA Corp.",         label: "Semis",      shares:  95, currentPrice: 875.40, costBasis: 480.00, marketValue: 83163, allocation: 17.6, pnl:  37563 },
  { symbol: "GOOGL", companyName: "Alphabet Inc.",        label: "Tech",       shares: 140, currentPrice: 172.60, costBasis: 138.20, marketValue: 24164, allocation:  5.1, pnl:   4816 },
  { symbol: "AMZN",  companyName: "Amazon.com Inc.",      label: "Consumer",   shares: 210, currentPrice: 185.50, costBasis: 155.00, marketValue: 38955, allocation:  8.2, pnl:   6405 },
  { symbol: "META",  companyName: "Meta Platforms Inc.",  label: "Tech",       shares:  88, currentPrice: 512.30, costBasis: 380.00, marketValue: 45082, allocation:  9.5, pnl:  11642 },
  { symbol: "TSLA",  companyName: "Tesla Inc.",           label: "EV",         shares: 150, currentPrice: 248.70, costBasis: 295.00, marketValue: 37305, allocation:  7.9, pnl:  -6945 },
  { symbol: "JPM",   companyName: "JPMorgan Chase & Co.", label: "Finance",    shares: 200, currentPrice: 198.40, costBasis: 165.00, marketValue: 39680, allocation:  8.4, pnl:   6680 },
  { symbol: "V",     companyName: "Visa Inc.",            label: "Finance",    shares: 130, currentPrice: 272.80, costBasis: 228.00, marketValue: 35464, allocation:  7.5, pnl:   5824 },
  { symbol: "JNJ",   companyName: "Johnson & Johnson",   label: "Healthcare", shares: 175, currentPrice: 158.90, costBasis: 168.00, marketValue: 27808, allocation:  5.9, pnl:  -1593 },
  { symbol: "XOM",   companyName: "Exxon Mobil Corp.",   label: "Energy",     shares: 220, currentPrice: 114.20, costBasis:  98.50, marketValue: 25124, allocation:  5.3, pnl:   3454 },
  { symbol: "BRK.B", companyName: "Berkshire Hathaway B",label: "Finance",    shares:  95, currentPrice: 362.10, costBasis: 310.00, marketValue: 34400, allocation:  7.3, pnl:   4950 },
  { symbol: "LLY",   companyName: "Eli Lilly and Co.",   label: "Healthcare", shares:  42, currentPrice: 780.50, costBasis: 620.00, marketValue: 32781, allocation:  6.9, pnl:   6741 },
  { symbol: "HD",    companyName: "Home Depot Inc.",      label: "Consumer",   shares:  68, currentPrice: 342.60, costBasis: 298.00, marketValue: 23297, allocation:  4.9, pnl:   3031 },
];

/* ─────────────────────────────────────────
   MOCK TRADE RECORDS
───────────────────────────────────────── */
const ALL_TRADES = [
  { id:  1, symbol: "NVDA",  companyName: "NVIDIA Corp.",         side: "BUY",  shares: 20, price: 865.20, date: "2024-03-28", total: 17304 },
  { id:  2, symbol: "AAPL",  companyName: "Apple Inc.",           side: "BUY",  shares: 50, price: 187.40, date: "2024-03-27", total:  9370 },
  { id:  3, symbol: "MSFT",  companyName: "Microsoft Corp.",      side: "SELL", shares: 30, price: 418.00, date: "2024-03-26", total: 12540 },
  { id:  4, symbol: "META",  companyName: "Meta Platforms Inc.",  side: "BUY",  shares: 15, price: 508.70, date: "2024-03-25", total:  7631 },
  { id:  5, symbol: "TSLA",  companyName: "Tesla Inc.",           side: "SELL", shares: 40, price: 255.30, date: "2024-03-22", total: 10212 },
  { id:  6, symbol: "JPM",   companyName: "JPMorgan Chase",       side: "BUY",  shares: 60, price: 195.80, date: "2024-03-21", total: 11748 },
  { id:  7, symbol: "AMZN",  companyName: "Amazon.com Inc.",      side: "BUY",  shares: 45, price: 182.20, date: "2024-03-20", total:  8199 },
  { id:  8, symbol: "GOOGL", companyName: "Alphabet Inc.",        side: "SELL", shares: 25, price: 175.40, date: "2024-03-19", total:  4385 },
  { id:  9, symbol: "V",     companyName: "Visa Inc.",            side: "BUY",  shares: 35, price: 270.10, date: "2024-03-18", total:  9454 },
  { id: 10, symbol: "LLY",   companyName: "Eli Lilly and Co.",    side: "BUY",  shares:  8, price: 775.00, date: "2024-03-15", total:  6200 },
  { id: 11, symbol: "AAPL",  companyName: "Apple Inc.",           side: "SELL", shares: 80, price: 184.50, date: "2024-03-14", total: 14760 },
  { id: 12, symbol: "NVDA",  companyName: "NVIDIA Corp.",         side: "BUY",  shares: 15, price: 845.00, date: "2024-03-13", total: 12675 },
  { id: 13, symbol: "XOM",   companyName: "Exxon Mobil Corp.",    side: "BUY",  shares: 70, price: 112.40, date: "2024-03-12", total:  7868 },
  { id: 14, symbol: "JNJ",   companyName: "Johnson & Johnson",    side: "SELL", shares: 50, price: 160.20, date: "2024-03-11", total:  8010 },
  { id: 15, symbol: "MSFT",  companyName: "Microsoft Corp.",      side: "BUY",  shares: 25, price: 408.30, date: "2024-03-08", total: 10208 },
  { id: 16, symbol: "BRK.B", companyName: "Berkshire Hathaway B", side: "BUY",  shares: 30, price: 358.00, date: "2024-03-07", total: 10740 },
  { id: 17, symbol: "HD",    companyName: "Home Depot Inc.",      side: "BUY",  shares: 20, price: 338.50, date: "2024-03-06", total:  6770 },
  { id: 18, symbol: "TSLA",  companyName: "Tesla Inc.",           side: "BUY",  shares: 60, price: 198.40, date: "2024-03-05", total: 11904 },
  { id: 19, symbol: "META",  companyName: "Meta Platforms Inc.",  side: "SELL", shares: 20, price: 495.60, date: "2024-03-04", total:  9912 },
  { id: 20, symbol: "JPM",   companyName: "JPMorgan Chase",       side: "SELL", shares: 40, price: 192.30, date: "2024-03-01", total:  7692 },
];
const DEFAULT_TRADES = ALL_TRADES.slice(0, 10);

const fmt = (n) =>
  n >= 0 ? `+$${n.toLocaleString("en-US")}` : `-$${Math.abs(n).toLocaleString("en-US")}`;

/* ─────────────────────────────────────────
   DASHBOARD COMPONENT
───────────────────────────────────────── */
export default function DashboardPage() {
  const [active, setActive]         = useState(0);
  const [direction, setDirection]   = useState(null);
  const [animating, setAnimating]   = useState(false);
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
  const panelTitle = selectedSymbol ? `${selectedSymbol} — Trade History` : "Recent Trades (Top 10)";

  return (
    <>
      <style>{`
        /* ══════════════════════════════════
           SLIDER SHELL
        ══════════════════════════════════ */
        .metrics-slider {
          border: 1px solid rgba(17,24,39,0.1);
          background: #ffffff;
          box-shadow: 0 24px 50px rgba(17,24,39,0.08);
          border-radius: 30px;
          overflow: hidden;
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }
        /* ── side arrow buttons ── */
        .slider-side-btn {
          flex-shrink: 0;
          width: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 200ms;
        }
        .slider-side-btn:first-child {
          border-radius: 30px 0 0 30px;
          border-right: 1px solid rgba(17,24,39,0.07);
        }
        .slider-side-btn:last-child {
          border-radius: 0 30px 30px 0;
          border-left: 1px solid rgba(17,24,39,0.07);
        }
        .slider-side-btn:hover { background: rgba(17,24,39,0.03); }
        .slider-side-btn .chevron {
          width: 30px; height: 30px; border-radius: 50%;
          border: 1.5px solid rgba(17,24,39,0.14);
          display: flex; align-items: center; justify-content: center;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(17,24,39,0.07);
          transition: border-color 200ms, box-shadow 200ms, transform 200ms;
        }
        .slider-side-btn:hover .chevron {
          border-color: rgba(17,24,39,0.28);
          box-shadow: 0 4px 14px rgba(17,24,39,0.12);
          transform: scale(1.1);
        }
        .slider-side-btn .chevron svg {
          width: 12px; height: 12px;
          stroke: #6b7280; fill: none;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
          transition: stroke 200ms;
        }
        .slider-side-btn:hover .chevron svg { stroke: #111827; }
        /* ── inner content ── */
        .slider-main {
          flex: 1; min-width: 0;
          padding: 40px 32px 32px;
          display: flex; flex-direction: column;
        }
        .slider-top-bar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; margin-bottom: 28px; flex-wrap: wrap;
        }
        .slider-tab-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .slider-tab {
          padding: 8px 20px; border-radius: 999px;
          border: 1px solid rgba(17,24,39,0.14);
          background: transparent; color: #6b7280;
          font-size: 0.78rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer;
          transition: border-color 180ms, background 180ms, color 180ms;
        }
        .slider-tab.active { color: #111827; background: #f3f4f6; }
        .slider-dots { display: flex; align-items: center; gap: 8px; }
        .slider-dot {
          width: 8px; height: 8px; border-radius: 999px; border: none;
          cursor: pointer; padding: 0;
          transition: width 240ms, background 240ms, opacity 240ms;
          opacity: 0.25; background: #9ca3af;
        }
        .slider-dot.active { width: 26px; opacity: 1; }
        .slider-count { font-size: 0.82rem; color: #6b7280; }
        .slider-heading-row {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 24px; margin-bottom: 24px; flex-wrap: wrap;
        }
        .slider-title-block { display: grid; gap: 6px; }
        .slider-eyebrow {
          margin: 0; font-size: 0.74rem; letter-spacing: 0.18em;
          text-transform: uppercase; font-weight: 800; transition: color 280ms;
        }
        .slider-title {
          margin: 0; font-family: "Cormorant Garamond", serif;
          font-size: clamp(2.8rem,5vw,4.8rem); letter-spacing: -0.04em;
          line-height: 0.92; color: #111827;
        }
        .slider-count-row { display: flex; align-items: center; gap: 12px; }
        .slide-viewport { overflow: hidden; min-height: 260px; }
        .slide-content { transition: opacity 280ms, transform 280ms; }
        .slide-content.exiting-left  { opacity: 0; transform: translateX(-36px); }
        .slide-content.exiting-right { opacity: 0; transform: translateX( 36px); }
        .slide-progress {
          margin-top: 24px; height: 2px;
          background: rgba(17,24,39,0.07); border-radius: 999px; overflow: hidden;
        }
        .slide-progress-bar { height: 100%; border-radius: 999px; transition: width 320ms, background 320ms; }

        /* ── chart entrance animations ── */
        @keyframes draw-line {
          from { stroke-dashoffset: 1600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fade-area {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pie-appear {
          from { opacity: 0; transform: scale(0.82); }
          to   { opacity: 1; transform: scale(1); }
        }
        .anim-line-slow {
          animation: draw-line 1800ms cubic-bezier(0.4,0,0.2,1) forwards !important;
          stroke-dasharray: 1600;
        }
        .anim-area-slow {
          animation: fade-area 1200ms cubic-bezier(0.4,0,0.2,1) forwards !important;
          opacity: 0;
        }

        /* ── metric cards ── */
        .slide-card-grid {
          display: grid; gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(200px,1fr));
        }
        .slide-metric {
          padding: 24px 26px; border-radius: 22px;
          background: #f9fafb; border: 1px solid rgba(17,24,39,0.08);
          display: grid; gap: 8px;
          transition: border-color 200ms, transform 200ms, box-shadow 200ms;
        }
        .slide-metric:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(17,24,39,0.08); }
        .slide-metric-label { margin: 0; font-size: 0.71rem; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 800; color: #6b7280; }
        .slide-metric-value { display: block; margin: 4px 0 2px; font-size: 1.9rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; transition: color 280ms; }
        .slide-metric-detail { margin: 0; font-size: 0.82rem; color: #6b7280; line-height: 1.55; }

        /* ── realtime layout ── */
        .rt-layout { display: grid; grid-template-columns: 280px 1fr; gap: 18px; align-items: stretch; }
        .rt-pnl-card {
          padding: 28px 26px 22px; border-radius: 22px;
          background: #f9fafb; border: 1px solid rgba(22,163,74,0.16);
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .rt-pnl-label { margin: 0 0 4px; font-size: 0.71rem; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 800; color: #6b7280; }
        .rt-pnl-value { font-size: 2.6rem; font-weight: 800; letter-spacing: -0.04em; line-height: 1; color: #16a34a; }
        .rt-pnl-detail { margin: 4px 0 0; font-size: 0.8rem; color: #6b7280; }
        .rt-metrics-grid { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; align-content: start; }

        /* ── performance layout ── */
        .perf-layout { display: grid; grid-template-columns: 200px 1fr; gap: 18px; align-items: stretch; }
        .perf-cards { display: flex; flex-direction: column; gap: 14px; }
        .perf-chart-panel {
          padding: 22px 24px 18px; border-radius: 22px;
          background: #f9fafb; border: 1px solid rgba(17,24,39,0.08);
          display: flex; flex-direction: column;
        }
        .perf-chart-heading { margin: 0 0 2px; font-size: 0.71rem; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 800; color: #6b7280; }
        .perf-chart-sub { margin: 0 0 14px; font-size: 0.85rem; font-weight: 700; color: #4f7bff; }

        /* ── holdings layout ── */
        .holdings-dist-layout { display: grid; grid-template-columns: 180px 1fr; gap: 18px; align-items: stretch; }
        .holdings-dist-cards { display: flex; flex-direction: column; gap: 14px; }
        .holdings-pie-panel {
          padding: 22px 24px 18px; border-radius: 22px;
          background: #f9fafb; border: 1px solid rgba(17,24,39,0.08);
          display: flex; flex-direction: column;
        }

        /* ══════════════════════════════════
           BOTTOM PANEL
        ══════════════════════════════════ */
        .bottom-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }

        /* ── Holdings table ── */
        .holdings-panel {
          border: 1px solid rgba(17,24,39,0.1); background: #ffffff;
          box-shadow: 0 16px 36px rgba(17,24,39,0.06);
          border-radius: 28px; overflow: hidden;
          display: flex; flex-direction: column; max-height: 520px;
        }
        .holdings-header {
          padding: 22px 26px 16px; border-bottom: 1px solid rgba(17,24,39,0.07); flex-shrink: 0;
        }
        .holdings-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .holdings-title { margin: 0; font-family: "Cormorant Garamond", serif; font-size: 1.6rem; letter-spacing: -0.03em; color: #111827; }
        .holdings-count-badge {
          padding: 4px 12px; border-radius: 999px;
          background: rgba(79,123,255,0.07); border: 1px solid rgba(79,123,255,0.18);
          font-size: 0.72rem; font-weight: 700; color: #4f7bff; letter-spacing: 0.08em;
        }
        .holdings-scroll { overflow-y: auto; overflow-x: auto; flex: 1; }
        .holdings-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .holdings-scroll::-webkit-scrollbar-track { background: transparent; }
        .holdings-scroll::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.14); border-radius: 999px; }
        .holdings-table { width: 100%; border-collapse: collapse; min-width: 720px; font-size: 0.82rem; }
        .holdings-table thead tr {
          border-bottom: 1px solid rgba(17,24,39,0.07);
          position: sticky; top: 0; background: #ffffff; z-index: 2;
        }
        .holdings-table th {
          padding: 10px 14px; text-align: right;
          font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
          color: #6b7280; white-space: nowrap;
        }
        .holdings-table th:first-child, .holdings-table th:nth-child(2), .holdings-table th:nth-child(3) { text-align: left; }
        .holdings-table tbody tr { border-bottom: 1px solid rgba(17,24,39,0.05); cursor: pointer; transition: background 150ms; }
        .holdings-table tbody tr:last-child { border-bottom: none; }
        .holdings-table tbody tr:hover { background: #f9fafb; }
        .holdings-table tbody tr.selected { background: rgba(79,123,255,0.05); }
        .holdings-table td { padding: 12px 14px; text-align: right; color: #374151; white-space: nowrap; }
        .holdings-table td:first-child, .holdings-table td:nth-child(2), .holdings-table td:nth-child(3) { text-align: left; }
        .td-symbol { font-weight: 800; color: #111827; font-size: 0.88rem; }
        .td-company { color: #6b7280; font-size: 0.78rem; max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
        .td-label { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; background: rgba(79,123,255,0.07); color: #4f7bff; border: 1px solid rgba(79,123,255,0.18); }
        .td-positive { color: #16a34a; font-weight: 700; }
        .td-negative { color: #dc2626; font-weight: 700; }

        /* ── Trades panel ── */
        .trades-panel {
          border: 1px solid rgba(17,24,39,0.1); background: #ffffff;
          box-shadow: 0 16px 36px rgba(17,24,39,0.06);
          border-radius: 28px; overflow: hidden;
          display: flex; flex-direction: column; max-height: 520px;
        }
        .trades-header {
          padding: 22px 26px 16px; border-bottom: 1px solid rgba(17,24,39,0.07);
          flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .trades-title { margin: 0; font-family: "Cormorant Garamond", serif; font-size: 1.3rem; letter-spacing: -0.03em; color: #111827; line-height: 1.2; }
        .trades-clear-btn {
          padding: 4px 12px; border-radius: 999px; background: transparent;
          border: 1px solid rgba(17,24,39,0.16); font-size: 0.7rem; font-weight: 700;
          color: #6b7280; cursor: pointer; letter-spacing: 0.06em; transition: border-color 160ms, color 160ms;
        }
        .trades-clear-btn:hover { border-color: rgba(79,123,255,0.4); color: #4f7bff; }
        .trades-scroll { overflow-y: auto; flex: 1; }
        .trades-scroll::-webkit-scrollbar { width: 4px; }
        .trades-scroll::-webkit-scrollbar-track { background: transparent; }
        .trades-scroll::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.14); border-radius: 999px; }
        .trade-row {
          display: grid; grid-template-columns: auto 1fr auto;
          align-items: center; gap: 14px; padding: 14px 24px;
          border-bottom: 1px solid rgba(17,24,39,0.05); transition: background 150ms;
        }
        .trade-row:last-child { border-bottom: none; }
        .trade-row:hover { background: #f9fafb; }
        .trade-side-badge { width: 48px; text-align: center; padding: 4px 0; border-radius: 8px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; flex-shrink: 0; }
        .trade-side-badge.buy  { background: rgba(22,163,74,0.08);  color: #16a34a; border: 1px solid rgba(22,163,74,0.2);  }
        .trade-side-badge.sell { background: rgba(220,38,38,0.08);  color: #dc2626; border: 1px solid rgba(220,38,38,0.2);  }
        .trade-info { min-width: 0; }
        .trade-symbol  { font-weight: 800; font-size: 0.9rem; color: #111827; }
        .trade-company { font-size: 0.75rem; color: #6b7280; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .trade-meta    { font-size: 0.72rem; color: #9ca3af; margin-top: 3px; }
        .trade-right   { text-align: right; flex-shrink: 0; }
        .trade-total   { font-weight: 800; font-size: 0.92rem; color: #111827; }
        .trade-date    { font-size: 0.72rem; color: #9ca3af; margin-top: 2px; }
        .trades-empty  { padding: 48px 24px; text-align: center; color: #9ca3af; font-size: 0.88rem; }

        @media (max-width: 1080px) {
          .bottom-panel, .rt-layout, .perf-layout, .holdings-dist-layout { grid-template-columns: 1fr; }
          .slider-side-btn { width: 48px; }
        }
        @media (max-width: 720px) {
          .slider-main { padding: 28px 20px 24px; }
          .slide-card-grid { grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); }
        }
      `}</style>

      {/* ══════════════════════════════════
          TOP — Sliding metrics panel
      ══════════════════════════════════ */}
      <section className="metrics-slider">

        {/* ← left arrow */}
        <button className="slider-side-btn" onClick={prev} aria-label="Previous">
          <span className="chevron">
            <svg viewBox="0 0 12 12"><polyline points="7.5,2 3.5,6 7.5,10" /></svg>
          </span>
        </button>

        {/* inner content */}
        <div className="slider-main">
          <div className="slider-top-bar">
            <div className="slider-tab-row">
              {CATEGORIES.map((c, idx) => (
                <button key={c.id}
                  className={`slider-tab${idx === active ? " active" : ""}`}
                  style={idx === active ? { borderColor: cat.accent + "55", color: cat.accent } : {}}
                  onClick={() => navigate(idx)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="slider-heading-row">
            <div className="slider-title-block">
              <p className="slider-eyebrow" style={{ color: cat.accent }}>{cat.eyebrow}</p>
              <h2 className="slider-title">{cat.label}</h2>
            </div>
            <div className="slider-count-row">
              <div className="slider-dots">
                {CATEGORIES.map((c, idx) => (
                  <button key={c.id}
                    className={`slider-dot${idx === active ? " active" : ""}`}
                    style={idx === active ? { background: cat.accent } : {}}
                    onClick={() => navigate(idx)} aria-label={c.label} />
                ))}
              </div>
              <span className="slider-count">
                {String(active + 1).padStart(2, "0")} / {String(CATEGORIES.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="slide-viewport">
            <div className={`slide-content${
              animating && direction === "left"  ? " exiting-left"  :
              animating && direction === "right" ? " exiting-right" : ""
            }`}>

              {cat.id === "realtime" ? (
                /* ── Realtime: P&L big number + sparkline left, metric grid right ── */
                <div className="rt-layout">
                  <div className="rt-pnl-card">
                    <div>
                      <p className="rt-pnl-label">Today&apos;s P&amp;L</p>
                      <span className="rt-pnl-value">{cat.pnl.value}</span>
                      <p className="rt-pnl-detail">{cat.pnl.detail}</p>
                    </div>
                    <PnlSparkline animKey={active} />
                  </div>
                  <div className="rt-metrics-grid">
                    {cat.metrics.map((m) => (
                      <article key={m.key} className="slide-metric" style={{ borderColor: cat.accent + "28" }}>
                        <p className="slide-metric-label">{m.label}</p>
                        <strong className="slide-metric-value" style={{ color: cat.accent, fontSize: "1.5rem" }}>{m.value}</strong>
                        <p className="slide-metric-detail">{m.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>

              ) : cat.id === "performance" ? (
                /* ── Performance: metric cards left, line chart right ── */
                <div className="perf-layout">
                  <div className="perf-cards">
                    {cat.metrics.map((m) => (
                      <article key={m.key} className="slide-metric" style={{ borderColor: cat.accent + "28", flex: 1 }}>
                        <p className="slide-metric-label">{m.label}</p>
                        <strong className="slide-metric-value" style={{ color: cat.accent, fontSize: "1.65rem" }}>{m.value}</strong>
                        <p className="slide-metric-detail">{m.detail}</p>
                      </article>
                    ))}
                  </div>
                  <div className="perf-chart-panel">
                    <p className="perf-chart-heading">Benchmark Comparisons</p>
                    <p className="perf-chart-sub">Portfolio vs S&amp;P 500 — YTD cumulative return</p>
                    <BenchmarkChart animKey={active} />
                  </div>
                </div>

              ) : cat.id === "holdings" ? (
                /* ── Holdings: metric cards left, industry donut right ── */
                <div className="holdings-dist-layout">
                  <div className="holdings-dist-cards">
                    {cat.metrics.map((m) => (
                      <article key={m.key} className="slide-metric" style={{ borderColor: cat.accent + "28", flex: 1 }}>
                        <p className="slide-metric-label">{m.label}</p>
                        <strong className="slide-metric-value" style={{ color: cat.accent, fontSize: "1.45rem" }}>{m.value}</strong>
                        <p className="slide-metric-detail">{m.detail}</p>
                      </article>
                    ))}
                  </div>
                  <div className="holdings-pie-panel">
                    <p className="perf-chart-heading">Industry Distribution</p>
                    <p className="perf-chart-sub" style={{ color: "#7bd88f", marginBottom: 16 }}>Sector breakdown by portfolio allocation</p>
                    <IndustryPieChart animKey={active} />
                  </div>
                </div>

              ) : (
                /* ── Generic card grid (Risk, Trading) ── */
                <div className="slide-card-grid">
                  {cat.metrics.map((m) => (
                    <article key={m.key} className="slide-metric" style={{ borderColor: cat.accent + "28" }}>
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
            <div className="slide-progress-bar"
              style={{ width: `${((active + 1) / CATEGORIES.length) * 100}%`, background: cat.accent }} />
          </div>
        </div>{/* end slider-main */}

        {/* → right arrow */}
        <button className="slider-side-btn" onClick={next} aria-label="Next">
          <span className="chevron">
            <svg viewBox="0 0 12 12"><polyline points="4.5,2 8.5,6 4.5,10" /></svg>
          </span>
        </button>

      </section>

      {/* ══════════════════════════════════
          BOTTOM — Holdings table + Trades
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
                  <th>Symbol</th><th>Company</th><th>Label</th>
                  <th>Shares</th><th>Current Price</th><th>Cost Basis</th>
                  <th>Market Value</th><th>Allocation</th><th>P / L</th>
                </tr>
              </thead>
              <tbody>
                {HOLDINGS.map((h) => (
                  <tr key={h.symbol}
                    className={selectedSymbol === h.symbol ? "selected" : ""}
                    onClick={() => setSelectedSymbol(selectedSymbol === h.symbol ? null : h.symbol)}>
                    <td className="td-symbol">{h.symbol}</td>
                    <td className="td-company">{h.companyName}</td>
                    <td><span className="td-label">{h.label}</span></td>
                    <td>{h.shares.toLocaleString()}</td>
                    <td>${h.currentPrice.toFixed(2)}</td>
                    <td>${h.costBasis.toFixed(2)}</td>
                    <td>${h.marketValue.toLocaleString()}</td>
                    <td>{h.allocation.toFixed(1)}%</td>
                    <td className={h.pnl >= 0 ? "td-positive" : "td-negative"}>{fmt(h.pnl)}</td>
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
              <button className="trades-clear-btn" onClick={() => setSelectedSymbol(null)}>✕ All</button>
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
