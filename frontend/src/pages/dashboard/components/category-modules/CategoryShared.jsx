import React, { useRef, useState } from "react";

export function MetricCards({ metrics, accent }) {
  return (
    <div className="slide-card-grid">
      {metrics.map((metric) => (
        <article
          key={metric.key}
          className="slide-metric"
          style={{ borderColor: `${accent}28` }}
        >
          <p className="slide-metric-label">{metric.label}</p>
          <strong className="slide-metric-value" style={{ color: accent }}>
            {metric.value}
          </strong>
          <p className="slide-metric-detail">{metric.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function BenchmarkChart({ primary, secondary, labels }) {
  const safePrimary = Array.isArray(primary) ? primary : [];
  const safeSecondary = Array.isArray(secondary) ? secondary : [];
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const W = 760;
  const H = 300;
  const PAD = { top: 18, right: 18, bottom: 34, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = Math.max(safePrimary.length, safeSecondary.length);
  const hasChartData = n >= 2 && safePrimary.length === n && safeSecondary.length === n;
  if (!hasChartData) {
    return <p className="benchmark-chart-empty">No benchmark time series available.</p>;
  }
  const xLabels =
    labels && labels.length === n
      ? labels
      : Array.from({ length: n }, (_, i) => `P${i + 1}`);
  const allVals = [...safePrimary, ...safeSecondary];
  const minV = Math.min(...allVals) - 1;
  const maxV = Math.max(...allVals) + 1;
  const xOf = (i) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
  const yOf = (v) =>
    PAD.top + (1 - (v - minV) / Math.max(maxV - minV, 1)) * innerH;
  const toPath = (arr) =>
    arr
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`)
      .join(" ");
  const toArea = (arr) => {
    const base = yOf(minV);
    return `${toPath(arr)} L ${xOf(arr.length - 1).toFixed(1)} ${base} L ${xOf(0).toFixed(1)} ${base} Z`;
  };
  const yGrid = Array.from({ length: 9 }, (_, i) => {
    const v = minV + (i / 8) * (maxV - minV);
    return { y: yOf(v), label: `${(v - 100).toFixed(1)}%` };
  });
  const xGridIndexes = Array.from({ length: Math.min(12, n) }, (_, i) =>
    Math.round((i / Math.max(Math.min(12, n) - 1, 1)) * (n - 1)),
  );

  const handleMove = (event) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * (W / rect.width);
    let nearest = 0;
    let dist = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(xOf(i) - mx);
      if (d < dist) {
        dist = d;
        nearest = i;
      }
    }
    setTooltip({
      i: nearest,
      label: xLabels[nearest],
      portfolio: safePrimary[nearest],
      benchmark: safeSecondary[nearest],
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="dash-gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f7bff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f7bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dash-gb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#9ca3af" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yGrid.map(({ y, label }) => (
          <g key={label}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(17,24,39,0.08)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y + 3} textAnchor="end" fill="#9ca3af" fontSize="10">
              {label}
            </text>
          </g>
        ))}

        {xGridIndexes.map((idx) => (
          <text key={idx} x={xOf(idx)} y={H - 6} textAnchor="middle" fill="#9ca3af" fontSize="10">
            {xLabels[idx]}
          </text>
        ))}

        <path d={toArea(safeSecondary)} fill="url(#dash-gb)" />
        <path d={toArea(safePrimary)} fill="url(#dash-gp)" />
        <path d={toPath(safeSecondary)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5 4" />
        <path d={toPath(safePrimary)} fill="none" stroke="#4f7bff" strokeWidth="2.6" />

        {tooltip && (
          <g>
            <line
              x1={xOf(tooltip.i)}
              y1={PAD.top}
              x2={xOf(tooltip.i)}
              y2={H - PAD.bottom}
              stroke="rgba(79,123,255,0.24)"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            <circle cx={xOf(tooltip.i)} cy={yOf(tooltip.benchmark)} r="4" fill="#ffffff" stroke="#9ca3af" strokeWidth="2" />
            <circle cx={xOf(tooltip.i)} cy={yOf(tooltip.portfolio)} r="4" fill="#ffffff" stroke="#4f7bff" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function PnlSparkline({ points, labels, accent = "#1f4ed8" }) {
  const [hover, setHover] = useState(null);
  const safePoints = Array.isArray(points)
    ? points
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
    : [];
  const W = 294;
  const H = 119;
  const PAD = { top: 8, right: 8, bottom: 24, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = safePoints.length;
  if (n < 2) {
    return <p className="benchmark-chart-empty">No intraday P&amp;L series available.</p>;
  }
  const minV = Math.min(...safePoints);
  const maxV = Math.max(...safePoints);
  const paddedMin = minV - Math.max(1, (maxV - minV) * 0.06);
  const paddedMax = maxV + Math.max(1, (maxV - minV) * 0.06);
  const xOf = (i) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
  const yOf = (v) =>
    PAD.top + (1 - (v - paddedMin) / Math.max(paddedMax - paddedMin, 1)) * innerH;
  const path = safePoints
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`)
    .join(" ");
  const grid = Array.from({ length: 6 }, (_, i) => paddedMin + (i / 5) * (paddedMax - paddedMin));
  const xLabels =
    labels && labels.length === n
      ? labels
      : Array.from({ length: n }, (_, i) => `T${i + 1}`);
  const xTickIndexes = Array.from({ length: Math.min(7, n) }, (_, i) =>
    Math.round((i / Math.max(Math.min(7, n) - 1, 1)) * (n - 1)),
  );
  const formatAxisY = (value) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    }).format(value);
  const formatTooltipY = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
      signDisplay: "exceptZero",
    }).format(value);

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * (W / rect.width);
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(xOf(i) - mx);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover({
      index: nearest,
      xLabel: xLabels[nearest],
      yValue: safePoints[nearest],
    });
  };

  return (
    <div style={{ position: "relative", marginTop: 6, height: "100%", minHeight: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "100%", display: "block", overflow: "hidden" }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {grid.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              y1={yOf(value)}
              x2={W - PAD.right}
              y2={yOf(value)}
              stroke="rgba(17,24,39,0.08)"
              strokeWidth="1"
            />
            <text x={PAD.left - 8} y={yOf(value) + 3} textAnchor="end" fill="#9ca3af" fontSize="10">
              {formatAxisY(value)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="rgba(17,24,39,0.2)" strokeWidth="1.2" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="rgba(17,24,39,0.2)" strokeWidth="1.2" />
        <path d={path} fill="none" stroke={accent} strokeWidth="2.4" />
        {safePoints.map((value, index) => (
          <circle
            key={`${index}-${value}`}
            cx={xOf(index)}
            cy={yOf(value)}
            r={hover?.index === index ? 4 : 2.4}
            fill="#ffffff"
            stroke={accent}
            strokeWidth={hover?.index === index ? 2 : 1.4}
          />
        ))}
        {xTickIndexes.map((idx) => (
          <text key={idx} x={xOf(idx)} y={H - 8} textAnchor="middle" fill="#9ca3af" fontSize="10">
            {xLabels[idx]}
          </text>
        ))}
        {hover && (
          <g>
            <line
              x1={xOf(hover.index)}
              y1={PAD.top}
              x2={xOf(hover.index)}
              y2={H - PAD.bottom}
              stroke="rgba(17,24,39,0.2)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={xOf(hover.index)} cy={yOf(hover.yValue)} r="4.5" fill="#ffffff" stroke={accent} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(17,24,39,0.12)",
            background: "rgba(255,255,255,0.96)",
            fontSize: 11,
            lineHeight: 1.35,
            color: "#111827",
          }}
        >
          <div><strong>X:</strong> {hover.xLabel}</div>
          <div><strong>Y:</strong> {formatTooltipY(hover.yValue)}</div>
        </div>
      )}
    </div>
  );
}

export function DonutChart({ segments }) {
  const safeSegments = Array.isArray(segments) ? segments : [];
  if (!safeSegments.length) {
    return null;
  }

  const normalizedTotal = safeSegments.reduce((sum, segment) => sum + Number(segment?.pct || 0), 0);
  const singleFullSegment = safeSegments.length === 1 && normalizedTotal >= 99.999;
  const r = 60;
  const inner = 38;
  const center = 80;
  let total = 0;

  if (singleFullSegment) {
    const color = safeSegments[0]?.color || "#4f7bff";
    return (
      <svg viewBox="0 0 160 160" style={{ width: 180, maxWidth: "100%", height: "auto" }}>
        <circle cx={center} cy={center} r={r} fill={color} />
        <circle cx={center} cy={center} r={inner} fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 160" style={{ width: 180, maxWidth: "100%", height: "auto" }}>
      {safeSegments.map((segment) => {
        const start = (total / 100) * Math.PI * 2 - Math.PI / 2;
        total += segment.pct;
        const end = (total / 100) * Math.PI * 2 - Math.PI / 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = center + r * Math.cos(start);
        const y1 = center + r * Math.sin(start);
        const x2 = center + r * Math.cos(end);
        const y2 = center + r * Math.sin(end);
        const x3 = center + inner * Math.cos(end);
        const y3 = center + inner * Math.sin(end);
        const x4 = center + inner * Math.cos(start);
        const y4 = center + inner * Math.sin(start);
        const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
        return <path key={segment.label} d={d} fill={segment.color} />;
      })}
    </svg>
  );
}

export function InteractiveDonutChart({ segments, currency = "USD" }) {
  const safeSegments = (Array.isArray(segments) ? segments : [])
    .filter((segment) => Number.isFinite(Number(segment?.pct)) && Number(segment.pct) > 0);
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!safeSegments.length) {
    return <p className="benchmark-chart-empty">No allocation data available.</p>;
  }

  const normalizedTotal = safeSegments.reduce((sum, segment) => sum + Number(segment.pct), 0);
  const normalized = safeSegments.map((segment) => ({
    ...segment,
    pct: normalizedTotal > 0 ? (Number(segment.pct) / normalizedTotal) * 100 : 0,
  }));
  const activeSegment = normalized[hoverIndex] || normalized[0];
  const r = 56;
  const inner = 34;
  const center = 76;
  let total = 0;
  const formatAmount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "N/A";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  };

  return (
    <div className="holdings-pie-viz">
      <svg viewBox="0 0 152 152" className="holdings-pie-svg" onMouseLeave={() => setHoverIndex(null)}>
        {normalized.map((segment, index) => {
          const start = (total / 100) * Math.PI * 2 - Math.PI / 2;
          total += segment.pct;
          const end = (total / 100) * Math.PI * 2 - Math.PI / 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = center + r * Math.cos(start);
          const y1 = center + r * Math.sin(start);
          const x2 = center + r * Math.cos(end);
          const y2 = center + r * Math.sin(end);
          const x3 = center + inner * Math.cos(end);
          const y3 = center + inner * Math.sin(end);
          const x4 = center + inner * Math.cos(start);
          const y4 = center + inner * Math.sin(start);
          const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
          return (
            <path
              key={`${segment.label || "segment"}-${index}`}
              d={path}
              fill={segment.color || "#4f7bff"}
              opacity={hoverIndex == null || hoverIndex === index ? 1 : 0.5}
              onMouseEnter={() => setHoverIndex(index)}
            />
          );
        })}
      </svg>
      <div className="holdings-pie-hover">
        <p className="holdings-pie-hover-label">{activeSegment.label || "Unknown"}</p>
        <p className="holdings-pie-hover-value">{formatAmount(activeSegment.amount)}</p>
        <p className="holdings-pie-hover-pct">{`${Number(activeSegment.pct).toFixed(2)}%`}</p>
      </div>
    </div>
  );
}
