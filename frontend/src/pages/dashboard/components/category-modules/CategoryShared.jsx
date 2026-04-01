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
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const W = 760;
  const H = 300;
  const PAD = { top: 18, right: 18, bottom: 34, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = Math.max(primary.length, secondary.length);
  const xLabels =
    labels && labels.length === n
      ? labels
      : Array.from({ length: n }, (_, i) => `P${i + 1}`);
  const allVals = [...primary, ...secondary];
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
      portfolio: primary[nearest],
      benchmark: secondary[nearest],
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

        <path d={toArea(secondary)} fill="url(#dash-gb)" />
        <path d={toArea(primary)} fill="url(#dash-gp)" />
        <path d={toPath(secondary)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5 4" />
        <path d={toPath(primary)} fill="none" stroke="#4f7bff" strokeWidth="2.6" />

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

export function PnlSparkline({ points, labels }) {
  const [hover, setHover] = useState(null);
  const W = 360;
  const H = 130;
  const PAD = { top: 10, right: 8, bottom: 24, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = points.length;
  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const xOf = (i) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
  const yOf = (v) =>
    PAD.top + (1 - (v - minV) / Math.max(maxV - minV, 1)) * innerH;
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`)
    .join(" ");
  const grid = Array.from({ length: 6 }, (_, i) => minV + (i / 5) * (maxV - minV));
  const xLabels =
    labels && labels.length === n
      ? labels
      : Array.from({ length: n }, (_, i) => `${i + 1}`);

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
    setHover(nearest);
  };

  return (
    <div style={{ position: "relative", marginTop: 14 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {grid.map((value) => (
          <line
            key={value}
            x1={PAD.left}
            y1={yOf(value)}
            x2={W - PAD.right}
            y2={yOf(value)}
            stroke="rgba(17,24,39,0.08)"
            strokeWidth="1"
          />
        ))}
        <path d={path} fill="none" stroke="#16a34a" strokeWidth="2.4" />
        {Array.from({ length: Math.min(7, n) }, (_, i) => Math.round((i / Math.max(Math.min(7, n) - 1, 1)) * (n - 1))).map((idx) => (
          <text key={idx} x={xOf(idx)} y={H - 6} textAnchor="middle" fill="#9ca3af" fontSize="9">
            {xLabels[idx]}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={xOf(hover)} y1={PAD.top} x2={xOf(hover)} y2={H - PAD.bottom} stroke="rgba(17,24,39,0.2)" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={xOf(hover)} cy={yOf(points[hover])} r="4" fill="#ffffff" stroke="#16a34a" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function DonutChart({ segments }) {
  const r = 60;
  const inner = 38;
  const center = 80;
  let total = 0;

  return (
    <svg viewBox="0 0 160 160" style={{ width: 180, maxWidth: "100%", height: "auto" }}>
      {segments.map((segment) => {
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
