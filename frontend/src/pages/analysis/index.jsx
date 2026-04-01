import React, { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  classForDelta,
  formatDate,
  formatPercent,
  formatSignedPercent,
} from "../../lib/api";

export const analysisPageMeta = {
  eyebrow: "Strategy Analysis",
  title: "Build and test a portfolio quickly.",
  description: "Select a profile, build a basket, then run analysis.",
  metrics: [],
};

const PROFILE_PRESETS = {
  conservative: {
    label: "Conservative",
    description: "Lower risk, benchmark tilt.",
    seeds: ["SPX", "MSFT", "AAPL"],
    weights: [0.5, 0.3, 0.2],
  },
  balanced: {
    label: "Balanced",
    description: "Diversified growth.",
    seeds: ["AAPL", "MSFT", "NVDA"],
    weights: [0.34, 0.33, 0.33],
  },
  aggressive: {
    label: "Aggressive",
    description: "Higher risk, growth tilt.",
    seeds: ["NVDA", "TSLA", "AAPL"],
    weights: [0.45, 0.35, 0.2],
  },
};

const BACKTEST_WINDOWS = [30, 90, 180, 365];
const SIMULATION_STEPS = [90, 126, 252, 365];
const SIMULATION_PATHS = [200, 500, 1000];
const NUM_RANDOM_PORTFOLIOS = 10000;

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createLinearTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [];
  }
  if (Math.abs(max - min) < 1e-12) {
    return [min];
  }
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function buildIndexTicks(length, count = 5) {
  if (length <= 0) {
    return [];
  }
  if (length === 1) {
    return [0];
  }
  const step = (length - 1) / (count - 1);
  const ticks = Array.from({ length: count }, (_, index) => Math.round(index * step));
  return [...new Set(ticks)];
}

function shortDateLabel(value) {
  if (!value) {
    return "N/A";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function SvgTooltip({ x, y, lines, chartWidth, chartHeight }) {
  if (!lines?.length) {
    return null;
  }
  const padding = 7;
  const lineHeight = 14;
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const tooltipWidth = clamp(longest * 6 + padding * 2, 120, 220);
  const tooltipHeight = padding * 2 + lineHeight * lines.length;
  const left = clamp(x + 10, 6, chartWidth - tooltipWidth - 6);
  const top = clamp(y - tooltipHeight - 10, 6, chartHeight - tooltipHeight - 6);

  return (
    <g className="chart-tooltip" transform={`translate(${left},${top})`}>
      <rect width={tooltipWidth} height={tooltipHeight} rx="8" />
      {lines.map((line, index) => (
        <text key={`${line}-${index}`} x={padding} y={padding + 11 + index * lineHeight}>
          {line}
        </text>
      ))}
    </g>
  );
}

function getSvgPointer(event, width, height) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = bounds.width > 0 ? ((event.clientX - bounds.left) / bounds.width) * width : 0;
  const y = bounds.height > 0 ? ((event.clientY - bounds.top) / bounds.height) * height : 0;
  return { x, y };
}

function BacktestChart({ points }) {
  const [hoverState, setHoverState] = useState(null);

  if (!points?.length) {
    return (
      <div className="history-empty">
        <strong>No backtest data</strong>
        <p>Run backtest.</p>
      </div>
    );
  }

  const series = points.filter((item) => Number.isFinite(Number(item.nav)));
  const values = series.map((item) => Number(item.nav));
  if (!values.length) {
    return (
      <div className="history-empty">
        <strong>Invalid backtest data</strong>
        <p>Try again.</p>
      </div>
    );
  }

  const width = 560;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 32, left: 52 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const base = Number(series[0]?.nav) || 1;

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yPadding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.04, 0.05) : (rawMax - rawMin) * 0.08;
  const yMin = rawMin - yPadding;
  const yMax = rawMax + yPadding;
  const yRange = yMax - yMin || 1;

  const mapX = (index) =>
    margin.left + (series.length > 1 ? (index / (series.length - 1)) * chartWidth : chartWidth / 2);
  const mapY = (value) => margin.top + ((yMax - value) / yRange) * chartHeight;

  const path = series
    .map((item, index) => {
      const x = mapX(index);
      const y = mapY(Number(item.nav));
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const totalReturn = Number(series[series.length - 1].nav) / base - 1;
  const yTicks = createLinearTicks(yMin, yMax, 5);
  const xTickIndexes = buildIndexTicks(series.length, 5);
  const hoveredPoint = hoverState ? series[hoverState.index] : null;
  const hoverX = hoveredPoint ? mapX(hoverState.index) : null;
  const hoverY = hoveredPoint ? mapY(Number(hoveredPoint.nav)) : null;
  const hoverReturn = hoveredPoint ? Number(hoveredPoint.nav) / base - 1 : null;
  const hoverLineX = hoverState ? clamp(hoverState.pointerX, margin.left, width - margin.right) : null;
  const tooltipX = hoverState ? clamp(hoverState.pointerX, margin.left, width - margin.right) : null;
  const tooltipY = hoverState ? clamp(hoverState.pointerY, margin.top, height - margin.bottom) : null;

  function handleMouseMove(event) {
    const pointer = getSvgPointer(event, width, height);
    const svgX = clamp(pointer.x, margin.left, width - margin.right);
    const ratio = clamp((svgX - margin.left) / chartWidth, 0, 1);
    const index = Math.round(ratio * (series.length - 1));
    setHoverState({
      index,
      pointerX: svgX,
      pointerY: clamp(pointer.y, margin.top, height - margin.bottom),
    });
  }

  return (
    <div className="history-chart">
      <div className="history-meta">
        <span>Portfolio NAV</span>
        <strong className={classForDelta(totalReturn)}>
          {formatSignedPercent(totalReturn)}
        </strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Backtest NAV chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverState(null)}
      >
        {yTicks.map((tick) => {
          const y = mapY(tick);
          return (
            <g key={`backtest-y-${tick.toFixed(6)}`}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} className="chart-grid-line" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" className="chart-axis-text">
                {formatPercent(tick / base - 1, 1)}
              </text>
            </g>
          );
        })}
        {xTickIndexes.map((index) => {
          const x = mapX(index);
          return (
            <g key={`backtest-x-${index}`}>
              <line x1={x} y1={margin.top} x2={x} y2={height - margin.bottom} className="chart-grid-line" />
              <text x={x} y={height - margin.bottom + 14} textAnchor="middle" className="chart-axis-text">
                {shortDateLabel(series[index]?.date)}
              </text>
            </g>
          );
        })}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          className="chart-axis"
        />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} className="chart-axis" />
        <path d={path} className="history-line" />
        {hoveredPoint ? (
          <>
            <line
              x1={hoverLineX}
              y1={margin.top}
              x2={hoverLineX}
              y2={height - margin.bottom}
              className="chart-hover-line"
            />
            <circle cx={hoverX} cy={hoverY} r="4" className="chart-hover-dot" />
            <SvgTooltip
              x={tooltipX}
              y={tooltipY}
              chartWidth={width}
              chartHeight={height}
              lines={[
                `${shortDateLabel(hoveredPoint.date)}`,
                `NAV ${(Number(hoveredPoint.nav) || 0).toFixed(4)}`,
                `Return ${formatSignedPercent(hoverReturn || 0)}`,
              ]}
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function SimulationChart({ meanPath, samplePaths }) {
  const [hoverState, setHoverState] = useState(null);

  if (!meanPath?.length) {
    return (
      <div className="history-empty">
        <strong>No simulation data</strong>
        <p>Run simulation.</p>
      </div>
    );
  }

  const normalizedMeanPath = meanPath.filter((item) => Number.isFinite(Number(item.value)));
  const allSeries = [...(samplePaths || []).map((item) => item.points || []), normalizedMeanPath];
  const values = allSeries
    .flatMap((series) => series.map((point) => Number(point.value)))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return (
      <div className="history-empty">
        <strong>Invalid simulation data</strong>
        <p>Try again.</p>
      </div>
    );
  }

  const width = 560;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 32, left: 52 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const base = Number(normalizedMeanPath[0]?.value) || 1;
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yPadding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.04, 0.05) : (rawMax - rawMin) * 0.08;
  const yMin = rawMin - yPadding;
  const yMax = rawMax + yPadding;
  const yRange = yMax - yMin || 1;

  const mapX = (index) =>
    margin.left + (normalizedMeanPath.length > 1 ? (index / (normalizedMeanPath.length - 1)) * chartWidth : chartWidth / 2);
  const mapY = (value) => margin.top + ((yMax - value) / yRange) * chartHeight;

  const linePath = (series) =>
    series
      .map((point, index) => {
        const x = mapX(index);
        const y = mapY(Number(point.value));
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  const yTicks = createLinearTicks(yMin, yMax, 5);
  const xTickIndexes = buildIndexTicks(normalizedMeanPath.length, 5);
  const hoveredPoint = hoverState ? normalizedMeanPath[hoverState.index] : null;
  const hoverX = hoveredPoint ? mapX(hoverState.index) : null;
  const hoverY = hoveredPoint ? mapY(Number(hoveredPoint.value)) : null;
  const hoverReturn = hoveredPoint ? Number(hoveredPoint.value) / base - 1 : null;
  const hoverLineX = hoverState ? clamp(hoverState.pointerX, margin.left, width - margin.right) : null;
  const tooltipX = hoverState ? clamp(hoverState.pointerX, margin.left, width - margin.right) : null;
  const tooltipY = hoverState ? clamp(hoverState.pointerY, margin.top, height - margin.bottom) : null;

  function handleMouseMove(event) {
    const pointer = getSvgPointer(event, width, height);
    const svgX = clamp(pointer.x, margin.left, width - margin.right);
    const ratio = clamp((svgX - margin.left) / chartWidth, 0, 1);
    const index = Math.round(ratio * (normalizedMeanPath.length - 1));
    setHoverState({
      index,
      pointerX: svgX,
      pointerY: clamp(pointer.y, margin.top, height - margin.bottom),
    });
  }

  return (
    <div className="history-chart simulation-chart">
      <div className="history-meta">
        <span>Monte Carlo Projection</span>
        <strong>
          Mean terminal:{" "}
          {formatSignedPercent(
            Number(normalizedMeanPath[normalizedMeanPath.length - 1]?.value) / Number(normalizedMeanPath[0]?.value) - 1,
          )}
        </strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Monte Carlo portfolio path chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverState(null)}
      >
        {yTicks.map((tick) => {
          const y = mapY(tick);
          return (
            <g key={`sim-y-${tick.toFixed(6)}`}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} className="chart-grid-line" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" className="chart-axis-text">
                {formatPercent(tick / base - 1, 1)}
              </text>
            </g>
          );
        })}
        {xTickIndexes.map((index) => {
          const x = mapX(index);
          return (
            <g key={`sim-x-${index}`}>
              <line x1={x} y1={margin.top} x2={x} y2={height - margin.bottom} className="chart-grid-line" />
              <text x={x} y={height - margin.bottom + 14} textAnchor="middle" className="chart-axis-text">
                {(Number(normalizedMeanPath[index]?.time || 0) * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          className="chart-axis"
        />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} className="chart-axis" />
        {(samplePaths || []).slice(0, 6).map((path) => (
          <path key={path.pathIndex} d={linePath(path.points || [])} className="simulation-line" />
        ))}
        <path d={linePath(normalizedMeanPath)} className="history-line simulation-mean-line" />
        {hoveredPoint ? (
          <>
            <line
              x1={hoverLineX}
              y1={margin.top}
              x2={hoverLineX}
              y2={height - margin.bottom}
              className="chart-hover-line"
            />
            <circle cx={hoverX} cy={hoverY} r="4" className="chart-hover-dot" />
            <SvgTooltip
              x={tooltipX}
              y={tooltipY}
              chartWidth={width}
              chartHeight={height}
              lines={[
                `Step ${hoveredPoint.step}`,
                `Value ${(Number(hoveredPoint.value) || 0).toFixed(4)}`,
                `Return ${formatSignedPercent(hoverReturn || 0)}`,
              ]}
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function EfficientFrontierChart({ points, optimal }) {
  const [hoverState, setHoverState] = useState(null);

  if (!points?.length) {
    return (
      <div className="history-empty">
        <strong>No efficient frontier</strong>
        <p>Run optimization.</p>
      </div>
    );
  }

  const width = 560;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 34, left: 52 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const vols = points.map((point) => point.volatility).filter((value) => Number.isFinite(value));
  const rets = points.map((point) => point.expectedReturn).filter((value) => Number.isFinite(value));
  if (!vols.length || !rets.length) {
    return (
      <div className="history-empty">
        <strong>Invalid frontier data</strong>
        <p>Try again.</p>
      </div>
    );
  }

  const minVol = Math.min(...vols);
  const maxVol = Math.max(...vols);
  const minRet = Math.min(...rets);
  const maxRet = Math.max(...rets);
  const volRange = maxVol - minVol || 1;
  const retRange = maxRet - minRet || 1;

  const mapX = (vol) => margin.left + ((vol - minVol) / volRange) * chartWidth;
  const mapY = (ret) => margin.top + ((maxRet - ret) / retRange) * chartHeight;

  const chartPoints = points.slice(0, 3500);
  const xTicks = createLinearTicks(minVol, maxVol, 5);
  const yTicks = createLinearTicks(minRet, maxRet, 5);
  const hoverPoint = hoverState?.point || null;
  const hoverX = hoverPoint ? mapX(hoverPoint.volatility) : null;
  const hoverY = hoverPoint ? mapY(hoverPoint.expectedReturn) : null;
  const hoverLineX = hoverState ? clamp(hoverState.pointerX, margin.left, width - margin.right) : null;
  const hoverLineY = hoverState ? clamp(hoverState.pointerY, margin.top, height - margin.bottom) : null;
  const tooltipX = hoverState ? hoverLineX : null;
  const tooltipY = hoverState ? hoverLineY : null;

  function handleMouseMove(event) {
    const pointer = getSvgPointer(event, width, height);
    const svgX = pointer.x;
    const svgY = pointer.y;
    const clampedX = clamp(svgX, margin.left, width - margin.right);
    const clampedY = clamp(svgY, margin.top, height - margin.bottom);
    const volGuess = minVol + ((clampedX - margin.left) / chartWidth) * volRange;
    const retGuess = maxRet - ((clampedY - margin.top) / chartHeight) * retRange;
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    chartPoints.forEach((point) => {
      const dx = (point.volatility - volGuess) / volRange;
      const dy = (point.expectedReturn - retGuess) / retRange;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearest = point;
      }
    });
    setHoverState({
      point: nearest,
      pointerX: clampedX,
      pointerY: clampedY,
    });
  }

  return (
    <div className="frontier-chart">
      <div className="history-meta">
        <span>Efficient Frontier</span>
        <strong>Max Sharpe: {optimal ? optimal.sharpeRatio.toFixed(3) : "N/A"}</strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Sharpe frontier scatter chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverState(null)}
      >
        {yTicks.map((tick) => {
          const y = mapY(tick);
          return (
            <g key={`frontier-y-${tick.toFixed(6)}`}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} className="chart-grid-line" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" className="chart-axis-text">
                {formatPercent(tick, 1)}
              </text>
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const x = mapX(tick);
          return (
            <g key={`frontier-x-${tick.toFixed(6)}`}>
              <line x1={x} y1={margin.top} x2={x} y2={height - margin.bottom} className="chart-grid-line" />
              <text x={x} y={height - margin.bottom + 14} textAnchor="middle" className="chart-axis-text">
                {formatPercent(tick, 1)}
              </text>
            </g>
          );
        })}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          className="chart-axis"
        />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} className="chart-axis" />
        {chartPoints.map((point, index) => (
          <circle
            key={`${index}-${point.volatility}`}
            cx={mapX(point.volatility)}
            cy={mapY(point.expectedReturn)}
            r="2"
            className="frontier-dot"
          />
        ))}
        {optimal ? (
          <circle
            cx={mapX(optimal.volatility)}
            cy={mapY(optimal.expectedReturn)}
            r="6"
            className="frontier-optimal-dot"
          />
        ) : null}
        {hoverPoint ? (
          <>
            <line
              x1={hoverLineX}
              y1={margin.top}
              x2={hoverLineX}
              y2={height - margin.bottom}
              className="chart-hover-line"
            />
            <line
              x1={margin.left}
              y1={hoverLineY}
              x2={width - margin.right}
              y2={hoverLineY}
              className="chart-hover-line"
            />
            <circle cx={hoverX} cy={hoverY} r="4" className="chart-hover-dot" />
            <SvgTooltip
              x={tooltipX}
              y={tooltipY}
              chartWidth={width}
              chartHeight={height}
              lines={[
                `Return ${formatPercent(hoverPoint.expectedReturn, 2)}`,
                `Vol ${formatPercent(hoverPoint.volatility, 2)}`,
                `Sharpe ${Number(hoverPoint.sharpeRatio).toFixed(3)}`,
              ]}
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}

function OptimalWeightsChart({ weights }) {
  const [hoverState, setHoverState] = useState(null);

  if (!weights?.length) {
    return null;
  }

  const width = 560;
  const height = 240;
  const margin = { top: 12, right: 10, bottom: 34, left: 52 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const barGap = 10;
  const barWidth = Math.max(12, (chartWidth - barGap * (weights.length - 1)) / weights.length);
  const maxWeight = Math.max(...weights.map((item) => Number(item.weight) || 0), 0.01);
  const yTicks = createLinearTicks(0, maxWeight * 1.1, 5);
  const hovered = hoverState ? weights[hoverState.index] : null;

  function nearestWeightIndex(pointerX) {
    if (!weights.length) {
      return null;
    }
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    weights.forEach((_, index) => {
      const center = margin.left + index * (barWidth + barGap) + barWidth / 2;
      const dist = Math.abs(center - pointerX);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearest = index;
      }
    });
    return nearest;
  }

  function handleMouseMove(event) {
    const pointer = getSvgPointer(event, width, height);
    const clampedX = clamp(pointer.x, margin.left, width - margin.right);
    const clampedY = clamp(pointer.y, margin.top, height - margin.bottom);
    const index = nearestWeightIndex(clampedX);
    if (index === null) {
      setHoverState(null);
      return;
    }
    setHoverState({
      index,
      pointerX: clampedX,
      pointerY: clampedY,
    });
  }

  return (
    <div className="weights-chart">
      <div className="history-meta">
        <span>Optimal Weights</span>
        <strong>Allocation by Asset</strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Optimal portfolio weights bar chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverState(null)}
      >
        {yTicks.map((tick) => {
          const y = margin.top + ((maxWeight * 1.1 - tick) / (maxWeight * 1.1 || 1)) * chartHeight;
          return (
            <g key={`weights-y-${tick.toFixed(6)}`}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} className="chart-grid-line" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" className="chart-axis-text">
                {formatPercent(tick, 1)}
              </text>
            </g>
          );
        })}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          className="chart-axis"
        />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} className="chart-axis" />
        {weights.map((item, index) => {
          const weight = Number(item.weight) || 0;
          const x = margin.left + index * (barWidth + barGap);
          const h = Math.max(0, (weight / (maxWeight * 1.1 || 1)) * chartHeight);
          const y = height - margin.bottom - h;
          const labelY = height - margin.bottom + 14;
          return (
            <g key={item.symbol}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                className="weights-bar"
                rx="4"
              />
              <text x={x + barWidth / 2} y={labelY} textAnchor="middle" className="weights-ticker">
                {item.symbol}
              </text>
              <text x={x + barWidth / 2} y={Math.max(y - 4, 12)} textAnchor="middle" className="weights-value">
                {(weight * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
        {hovered ? (
          <SvgTooltip
            x={hoverState.pointerX}
            y={hoverState.pointerY}
            chartWidth={width}
            chartHeight={height}
            lines={[
              `${hovered.symbol}`,
              `Weight ${(Number(hovered.weight) * 100).toFixed(2)}%`,
            ]}
          />
        ) : null}
      </svg>
    </div>
  );
}

function computeMaxDrawdown(points) {
  if (!points.length) {
    return null;
  }

  let peak = Number(points[0].nav);
  let maxDrawdown = 0;
  points.forEach((point) => {
    const nav = Number(point.nav);
    if (nav > peak) {
      peak = nav;
    }
    const drawdown = peak === 0 ? 0 : nav / peak - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });
  return maxDrawdown;
}

function buildPortfolioCurve(histories, basket) {
  const bySymbol = new Map(
    histories
      .filter((item) => item.items?.length)
      .map((item) => [item.symbol, item.items]),
  );

  const symbolSet = basket
    .map((item) => item.symbol)
    .filter((symbol) => bySymbol.has(symbol));

  if (!symbolSet.length) {
    return [];
  }

  const dateIntersection = symbolSet
    .map((symbol) => new Set(bySymbol.get(symbol).map((point) => point.tradeDate)))
    .reduce((acc, set) => new Set([...acc].filter((date) => set.has(date))));

  const dates = [...dateIntersection].sort();
  if (!dates.length) {
    return [];
  }

  const weighted = symbolSet.map((symbol) => {
    const series = bySymbol.get(symbol);
    const first = Number(series[0]?.close);
    const weight = basket.find((item) => item.symbol === symbol)?.weight || 0;
    const byDate = new Map(series.map((point) => [point.tradeDate, Number(point.close)]));
    return { symbol, first, weight, byDate };
  });

  return dates.map((date) => {
    const nav = weighted.reduce((sum, item) => {
      const close = item.byDate.get(date);
      if (!Number.isFinite(close) || !Number.isFinite(item.first) || item.first === 0) {
        return sum;
      }
      return sum + item.weight * (close / item.first);
    }, 0);
    return { date, nav };
  });
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStd(values) {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function buildCorrelationMatrix(returnSeriesList) {
  const n = returnSeriesList.length;
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  const stds = returnSeriesList.map((series) => sampleStd(series));
  const means = returnSeriesList.map((series) => mean(series));

  for (let i = 0; i < n; i += 1) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      let cov = 0;
      for (let k = 0; k < returnSeriesList[i].length; k += 1) {
        cov +=
          (returnSeriesList[i][k] - means[i]) *
          (returnSeriesList[j][k] - means[j]);
      }
      cov = returnSeriesList[i].length > 1 ? cov / (returnSeriesList[i].length - 1) : 0;
      const denom = stds[i] * stds[j];
      const corr = denom > 0 ? Math.max(-0.999, Math.min(0.999, cov / denom)) : 0;
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return matrix;
}

function formatLossPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return `-${(Number(value) * 100).toFixed(2)}%`;
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function matrixVector(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function covarianceMatrix(seriesList) {
  const n = seriesList.length;
  const length = seriesList[0]?.length || 0;
  const means = seriesList.map((series) => mean(series));
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      let cov = 0;
      for (let k = 0; k < length; k += 1) {
        cov += (seriesList[i][k] - means[i]) * (seriesList[j][k] - means[j]);
      }
      cov = length > 1 ? cov / (length - 1) : 0;
      matrix[i][j] = cov;
      matrix[j][i] = cov;
    }
  }

  return matrix;
}

export default function AnalysisPage({ meta }) {
  const [profile, setProfile] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [basket, setBasket] = useState([]);
  const [windowDays, setWindowDays] = useState(90);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const [backtestResult, setBacktestResult] = useState(null);
  const [simulationSteps, setSimulationSteps] = useState(252);
  const [simulationPaths, setSimulationPaths] = useState(500);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  const [sharpeLoading, setSharpeLoading] = useState(false);
  const [sharpeError, setSharpeError] = useState("");
  const [sharpeResult, setSharpeResult] = useState(null);

  const profilePreset = profile ? PROFILE_PRESETS[profile] : null;
  const basketSymbolSet = useMemo(
    () => new Set(basket.map((item) => (item.symbol || "").toUpperCase())),
    [basket],
  );

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
        const response = await apiFetch(
          `/api/assets/suggestions?query=${encodeURIComponent(keyword)}&limit=6`,
        );
        if (!cancelled) {
          setSuggestions(response.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const normalizedBasket = useMemo(() => {
    if (!basket.length) {
      return [];
    }
    const totalWeight = basket.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      const equalWeight = 1 / basket.length;
      return basket.map((item) => ({ ...item, weight: equalWeight }));
    }
    return basket.map((item) => ({ ...item, weight: Number(item.weight || 0) / totalWeight }));
  }, [basket]);

  async function generateRecommendations(preset = profilePreset) {
    if (!preset) {
      return;
    }
    setRecommendationLoading(true);
    setBacktestError("");
    try {
      const responseList = await Promise.all(
        preset.seeds.map((seed) =>
          apiFetch(`/api/assets/suggestions?query=${encodeURIComponent(seed)}&limit=4`),
        ),
      );

      const merged = [];
      const seen = new Set();
      responseList.forEach((response) => {
        (response.items || []).forEach((item) => {
          const key = (item.symbol || "").toUpperCase();
          if (!key || seen.has(key)) {
            return;
          }
          seen.add(key);
          merged.push(item);
        });
      });

      const picked = merged.slice(0, 5).map((item, index) => ({
        ...item,
        targetWeight: preset.weights[index] ?? Math.max(0.1, 1 / Math.max(1, merged.length)),
      }));

      setRecommendations(picked);
      setBasket((current) => {
        if (current.length || !picked.length) {
          return current;
        }
        return picked.slice(0, 3).map((item) => ({
          symbol: item.symbol,
          name: item.name,
          weight: item.targetWeight,
        }));
      });
    } catch (error) {
      setRecommendations([]);
      setBacktestError(error.message);
    } finally {
      setRecommendationLoading(false);
    }
  }

  useEffect(() => {
    if (!profilePreset) {
      setRecommendations([]);
      return;
    }
    generateRecommendations(profilePreset);
  }, [profilePreset]);

  useEffect(() => {
    setBacktestResult(null);
    setSimulationResult(null);
    setSharpeResult(null);
  }, [basket]);

  useEffect(() => {
    setBacktestResult(null);
    setSharpeResult(null);
  }, [windowDays]);

  useEffect(() => {
    setSimulationResult(null);
  }, [simulationSteps, simulationPaths]);

  function addToBasket(item) {
    const symbol = (item.symbol || "").toUpperCase();
    if (!symbol) {
      return;
    }
    setBasket((current) => {
      if (current.some((asset) => asset.symbol === symbol)) {
        return current;
      }
      return [...current, { symbol, name: item.name, weight: 1 / Math.max(1, current.length + 1) }];
    });
  }

  function removeFromBasket(symbol) {
    setBasket((current) => current.filter((item) => item.symbol !== symbol));
  }

  function clearBasket() {
    setBasket([]);
  }

  function rebalanceEqualWeights() {
    setBasket((current) => {
      if (!current.length) {
        return current;
      }
      const equal = 1 / current.length;
      return current.map((item) => ({ ...item, weight: equal }));
    });
  }

  async function loadAlignedSeries(historyDays) {
    const historyList = await Promise.all(
      normalizedBasket.map(async (item) => {
        const response = await apiFetch(
          `/api/assets/price-history?query=${encodeURIComponent(item.symbol)}&days=${historyDays}`,
        );
        const items = (response.items || [])
          .map((point) => ({
            tradeDate: point.tradeDate,
            close: Number(point.close),
          }))
          .filter((point) => point.tradeDate && Number.isFinite(point.close) && point.close > 0)
          .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
        return { symbol: item.symbol, name: item.name, items };
      }),
    );

    const available = historyList.filter((item) => item.items.length >= 30);
    if (!available.length) {
      throw new Error("Not enough history to run analysis.");
    }

    const dateIntersection = available
      .map((item) => new Set(item.items.map((point) => point.tradeDate)))
      .reduce((acc, set) => new Set([...acc].filter((date) => set.has(date))));

    const commonDates = [...dateIntersection].sort();
    if (commonDates.length < 30) {
      throw new Error("Common history window is too short across selected assets.");
    }

    const usableDates = commonDates.slice(-Math.min(commonDates.length, historyDays));
    const seriesBySymbol = available
      .map((asset) => {
        const byDate = new Map(asset.items.map((point) => [point.tradeDate, point.close]));
        const closes = usableDates
          .map((date) => byDate.get(date))
          .filter((value) => Number.isFinite(value) && value > 0);
        return {
          symbol: asset.symbol,
          name: asset.name,
          closes,
        };
      })
      .filter((item) => item.closes.length >= 30);

    if (!seriesBySymbol.length) {
      throw new Error("No valid close series available for analysis.");
    }

    const alignedLength = Math.min(...seriesBySymbol.map((item) => item.closes.length));
    const alignedSeries = seriesBySymbol.map((item) => ({
      ...item,
      closes: item.closes.slice(-alignedLength),
    }));

    return alignedSeries;
  }

  async function runBacktest() {
    if (!normalizedBasket.length) {
      return;
    }
    setBacktestLoading(true);
    setBacktestError("");
    try {
      const historyList = await Promise.all(
        normalizedBasket.map(async (item) => {
          const response = await apiFetch(
            `/api/assets/price-history?query=${encodeURIComponent(item.symbol)}&days=${windowDays}`,
          );
          return { symbol: item.symbol, items: response.items || [] };
        }),
      );

      const curve = buildPortfolioCurve(historyList, normalizedBasket);
      if (!curve.length) {
        throw new Error("No overlapping history returned for the selected basket.");
      }

      const totalReturn = Number(curve[curve.length - 1].nav) / Number(curve[0].nav) - 1;
      const annualizedReturn =
        curve.length > 1 ? (1 + totalReturn) ** (365 / (curve.length - 1)) - 1 : totalReturn;
      const maxDrawdown = computeMaxDrawdown(curve);

      const assetReturns = historyList
        .map((item) => {
          const first = Number(item.items[0]?.close);
          const last = Number(item.items[item.items.length - 1]?.close);
          if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
            return null;
          }
          return {
            symbol: item.symbol,
            totalReturn: last / first - 1,
          };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.totalReturn) - Number(a.totalReturn));

      setBacktestResult({
        curve,
        totalReturn,
        annualizedReturn,
        maxDrawdown,
        assetReturns,
      });
    } catch (error) {
      setBacktestResult(null);
      setBacktestError(error.message);
    } finally {
      setBacktestLoading(false);
    }
  }

  async function runWienerSimulation() {
    if (!normalizedBasket.length) {
      return;
    }

    setSimulationLoading(true);
    setSimulationError("");
    try {
      const historyDays = Math.max(252, simulationSteps + 30);
      const alignedSeries = await loadAlignedSeries(historyDays);

      const returnSeriesList = alignedSeries.map((item) => {
        const returns = [];
        for (let i = 1; i < item.closes.length; i += 1) {
          const prev = item.closes[i - 1];
          const curr = item.closes[i];
          returns.push(curr / prev - 1);
        }
        return returns;
      });

      const annualReturns = returnSeriesList.map((series) => mean(series) * 252);
      const annualVolatilities = returnSeriesList.map((series) =>
        Math.max(sampleStd(series) * Math.sqrt(252), 0.0001),
      );
      const initialPrices = alignedSeries.map((item) => item.closes[item.closes.length - 1]);
      const symbols = alignedSeries.map((item) => item.symbol);
      const weightBySymbol = new Map(normalizedBasket.map((item) => [item.symbol, item.weight]));
      const weights = symbols.map((symbol) => Number(weightBySymbol.get(symbol) || 0));
      const correlationMatrix = buildCorrelationMatrix(returnSeriesList);

      const response = await apiFetch("/api/portfolio/analysis/wiener-simulation", {
        method: "POST",
        body: {
          assetCount: symbols.length,
          symbols,
          initialPrices,
          annualReturns,
          annualVolatilities,
          weights,
          correlationMatrix,
          steps: simulationSteps,
          paths: simulationPaths,
        },
      });

      setSimulationResult(response);
    } catch (error) {
      setSimulationResult(null);
      setSimulationError(error.message);
    } finally {
      setSimulationLoading(false);
    }
  }

  async function runSharpeOptimization() {
    if (!normalizedBasket.length) {
      return;
    }

    setSharpeLoading(true);
    setSharpeError("");
    try {
      const alignedSeries = await loadAlignedSeries(Math.max(252, windowDays + 30));
      const symbols = alignedSeries.map((item) => item.symbol);

      const logReturnSeries = alignedSeries.map((item) => {
        const returns = [];
        for (let i = 1; i < item.closes.length; i += 1) {
          const prev = item.closes[i - 1];
          const curr = item.closes[i];
          returns.push(Math.log(curr / prev));
        }
        return returns;
      });

      const annualReturns = logReturnSeries.map((series) => mean(series) * 252);
      const covDaily = covarianceMatrix(logReturnSeries);
      const covAnnual = covDaily.map((row) => row.map((value) => value * 252));

      const points = [];
      let best = null;
      for (let i = 0; i < NUM_RANDOM_PORTFOLIOS; i += 1) {
        const raw = symbols.map(() => Math.random());
        const sumRaw = raw.reduce((sum, value) => sum + value, 0);
        const weights = raw.map((value) => value / sumRaw);

        const expectedReturn = dot(annualReturns, weights);
        const variance = Math.max(0, dot(weights, matrixVector(covAnnual, weights)));
        const volatility = Math.sqrt(variance);
        if (!Number.isFinite(volatility) || volatility <= 0) {
          continue;
        }
        const sharpeRatio = expectedReturn / volatility;
        const point = { expectedReturn, volatility, sharpeRatio, weights };
        points.push(point);

        if (!best || sharpeRatio > best.sharpeRatio) {
          best = point;
        }
      }

      if (!best || !points.length) {
        throw new Error("Failed to generate valid random portfolios for Sharpe optimization.");
      }

      const optimalWeights = symbols.map((symbol, index) => ({
        symbol,
        weight: best.weights[index],
      }));

      setSharpeResult({
        points,
        optimal: {
          expectedReturn: best.expectedReturn,
          volatility: best.volatility,
          sharpeRatio: best.sharpeRatio,
          weights: optimalWeights,
        },
      });
    } catch (error) {
      setSharpeResult(null);
      setSharpeError(error.message);
    } finally {
      setSharpeLoading(false);
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
            <span>Analysis State</span>
            <strong>{profile ? "Ready" : "No profile"}</strong>
            <p>
              {profile
                ? `${PROFILE_PRESETS[profile].label} profile selected.`
                : "You can search and build basket directly."}
            </p>
          </div>
        </div>

      </section>

      <section className="watchlist-shell watchlist-component analysis-shell">
        <div className="watchlist-header">
          <div>
            <p className="eyebrow">Setup</p>
            <h2 className="watchlist-title">Build Basket</h2>
          </div>
          <div className="analysis-actions">
            <button
              type="button"
              className="search-button"
              disabled={!profile || recommendationLoading}
              onClick={generateRecommendations}
            >
              {recommendationLoading ? "Refreshing..." : "Refresh Suggestions"}
            </button>
          </div>
        </div>

        <div className="analysis-profile-grid">
          {Object.entries(PROFILE_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              className={`analysis-profile-card${profile === id ? " active" : ""}`}
              onClick={() => setProfile(id)}
            >
              <strong>{preset.label}</strong>
              <p>{preset.description}</p>
            </button>
          ))}
        </div>

        <div className="watchlist-grid">
          <section className="watchlist-panel">
            <div className="card-head">
              <span>Recommendations</span>
              <strong>{recommendations.length}</strong>
            </div>
            {!profile ? (
              <EmptyState
                title="Suggestions unavailable"
                description="Select a profile to auto-generate."
              />
            ) : !recommendations.length ? (
              <EmptyState
                title="No recommendations yet"
                description="Click Refresh Suggestions."
              />
            ) : (
              <div className="watchlist-table">
                {recommendations.map((item) => {
                  const symbol = (item.symbol || "").toUpperCase();
                  const added = basketSymbolSet.has(symbol);
                  return (
                    <button
                      key={`${item.symbol}-${item.assetId ?? "remote"}`}
                      type="button"
                      className={`watchlist-row${added ? " selected" : ""}`}
                      onClick={() => addToBasket(item)}
                      disabled={added}
                    >
                      <div>
                        <strong className="ticker">{item.symbol}</strong>
                        <p>{item.name}</p>
                      </div>
                      <div>
                        <strong>{added ? "Added" : `${Math.round((item.targetWeight || 0) * 100)}%`}</strong>
                        <p>{added ? "In basket" : "Weight"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="search-results">
              <div className="card-head">
                <span>Search & Add</span>
                <strong>{searching ? "..." : suggestions.length}</strong>
              </div>
              <label className="watchlist-search">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search symbol to add"
                />
              </label>
              {!query.trim() ? (
                <EmptyState
                  title="Type to search"
                  description="Search symbol or name."
                />
              ) : searching ? (
                <EmptyState
                  title="Searching"
                  description="Loading suggestions..."
                />
              ) : !suggestions.length ? (
                <EmptyState
                  title="No results"
                  description="Try another keyword."
                />
              ) : (
                suggestions.map((item) => {
                  const symbol = (item.symbol || "").toUpperCase();
                  const added = basketSymbolSet.has(symbol);
                  return (
                    <button
                      key={`${item.symbol}-suggest`}
                      type="button"
                      className={`search-result${added ? " added" : ""}`}
                      onClick={() => addToBasket(item)}
                      disabled={added}
                    >
                      <div className="search-result-main">
                        <strong>{item.symbol}</strong>
                        <span>{item.name}</span>
                      </div>
                      <span className="search-result-action">{added ? "Added" : "Add"}</span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="watchlist-panel detail-panel">
            <div className="card-head">
              <span>Backtest Basket</span>
              <strong>{normalizedBasket.length} assets</strong>
            </div>
            <div className="analysis-actions">
              <button
                type="button"
                className="search-button"
                onClick={rebalanceEqualWeights}
                disabled={!normalizedBasket.length}
              >
                Equal Weight
              </button>
              <button
                type="button"
                className="search-button"
                onClick={clearBasket}
                disabled={!normalizedBasket.length}
              >
                Clear
              </button>
            </div>

            {!normalizedBasket.length ? (
              <EmptyState
                title="Basket is empty"
                description="Add assets from the left."
              />
            ) : (
              <div className="analysis-basket-list">
                {normalizedBasket.map((item) => (
                  <div key={item.symbol} className="analysis-basket-item">
                    <div>
                      <strong>{item.symbol}</strong>
                      <p>{item.name || "Unnamed asset"}</p>
                    </div>
                    <div className="analysis-basket-meta">
                      <span>{Math.round(item.weight * 100)}%</span>
                      <button
                        type="button"
                        className="analysis-remove"
                        onClick={() => removeFromBasket(item.symbol)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="analysis-controls">
              <label>
                Window
                <select
                  value={windowDays}
                  onChange={(event) => setWindowDays(Number(event.target.value))}
                  disabled={!normalizedBasket.length}
                >
                  {BACKTEST_WINDOWS.map((days) => (
                    <option key={days} value={days}>
                      {days} days
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="search-button"
                onClick={runBacktest}
                disabled={!normalizedBasket.length || backtestLoading}
              >
                {backtestLoading ? "Running..." : "Run Backtest"}
              </button>
            </div>

            {backtestError ? <p className="inline-error">{backtestError}</p> : null}

            {backtestResult ? (
              <>
                <div className="stats-grid live-stats">
                  <div>
                    <span>Total Return</span>
                    <strong className={classForDelta(backtestResult.totalReturn)}>
                      {formatSignedPercent(backtestResult.totalReturn)}
                    </strong>
                  </div>
                  <div>
                    <span>Annualized Return</span>
                    <strong className={classForDelta(backtestResult.annualizedReturn)}>
                      {formatSignedPercent(backtestResult.annualizedReturn)}
                    </strong>
                  </div>
                  <div>
                    <span>Max Drawdown</span>
                    <strong className={classForDelta(backtestResult.maxDrawdown)}>
                      {formatSignedPercent(backtestResult.maxDrawdown)}
                    </strong>
                  </div>
                  <div>
                    <span>Last Date</span>
                    <strong>{formatDate(backtestResult.curve[backtestResult.curve.length - 1]?.date)}</strong>
                  </div>
                </div>

                <BacktestChart points={backtestResult.curve} />

                <div className="activity-list">
                  {(backtestResult.assetReturns || []).slice(0, 5).map((item) => (
                    <div key={item.symbol} className="activity-item">
                      <span className="activity-dot" />
                      <p>
                        {item.symbol}: {formatSignedPercent(item.totalReturn)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="Backtest not run"
                description="Click Run Backtest."
              />
            )}

            <div className="analysis-simulation">
              <div className="card-head">
                <span>Wiener Simulation</span>
                <strong>{simulationResult ? `${simulationResult.paths} paths` : "Not run"}</strong>
              </div>

              <div className="analysis-controls">
                <label>
                  Steps
                  <select
                    value={simulationSteps}
                    onChange={(event) => setSimulationSteps(Number(event.target.value))}
                    disabled={!normalizedBasket.length || simulationLoading}
                  >
                    {SIMULATION_STEPS.map((steps) => (
                      <option key={steps} value={steps}>
                        {steps} steps
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Paths
                  <select
                    value={simulationPaths}
                    onChange={(event) => setSimulationPaths(Number(event.target.value))}
                    disabled={!normalizedBasket.length || simulationLoading}
                  >
                    {SIMULATION_PATHS.map((paths) => (
                      <option key={paths} value={paths}>
                        {paths} paths
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="search-button"
                  onClick={runWienerSimulation}
                  disabled={!normalizedBasket.length || simulationLoading}
                >
                  {simulationLoading ? "Simulating..." : "Run Simulation"}
                </button>
              </div>

              {simulationError ? <p className="inline-error">{simulationError}</p> : null}

              {simulationResult ? (
                <>
                  <div className="stats-grid live-stats">
                    <div>
                      <span>Expected Return</span>
                      <strong className={classForDelta(simulationResult.stats?.expectedReturn)}>
                        {formatSignedPercent(simulationResult.stats?.expectedReturn)}
                      </strong>
                    </div>
                    <div>
                      <span>Annualized Volatility</span>
                      <strong>{formatPercent(simulationResult.stats?.annualizedVolatility)}</strong>
                    </div>
                    <div>
                      <span>VaR 95</span>
                      <strong className="negative">{formatLossPercent(simulationResult.stats?.var95)}</strong>
                    </div>
                    <div>
                      <span>CVaR 95</span>
                      <strong className="negative">{formatLossPercent(simulationResult.stats?.cvar95)}</strong>
                    </div>
                  </div>

                  <SimulationChart
                    meanPath={simulationResult.meanPath || []}
                    samplePaths={simulationResult.samplePaths || []}
                  />

                  {simulationResult.warnings?.length ? (
                    <div className="activity-list">
                      {simulationResult.warnings.map((warning) => (
                        <div key={warning} className="activity-item">
                          <span className="activity-dot" />
                          <p>{warning}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="Simulation not run"
                  description="Click Run Simulation."
                />
              )}
            </div>

            <div className="analysis-simulation">
              <div className="card-head">
                <span>Sharpe Optimization</span>
                <strong>{sharpeResult ? `${NUM_RANDOM_PORTFOLIOS} portfolios` : "Not run"}</strong>
              </div>

              <div className="analysis-actions">
                <button
                  type="button"
                  className="search-button"
                  onClick={runSharpeOptimization}
                  disabled={!normalizedBasket.length || sharpeLoading}
                >
                  {sharpeLoading ? "Optimizing..." : "Run Optimization"}
                </button>
              </div>

              {sharpeError ? <p className="inline-error">{sharpeError}</p> : null}

              {sharpeResult ? (
                <>
                  <div className="stats-grid live-stats">
                    <div>
                      <span>Expected Return</span>
                      <strong className={classForDelta(sharpeResult.optimal.expectedReturn)}>
                        {formatSignedPercent(sharpeResult.optimal.expectedReturn)}
                      </strong>
                    </div>
                    <div>
                      <span>Volatility</span>
                      <strong>{formatPercent(sharpeResult.optimal.volatility)}</strong>
                    </div>
                    <div>
                      <span>Sharpe Ratio</span>
                      <strong>{Number(sharpeResult.optimal.sharpeRatio).toFixed(3)}</strong>
                    </div>
                    <div>
                      <span>Portfolios</span>
                      <strong>{sharpeResult.points.length}</strong>
                    </div>
                  </div>

                  <EfficientFrontierChart
                    points={sharpeResult.points}
                    optimal={sharpeResult.optimal}
                  />

                  <OptimalWeightsChart weights={sharpeResult.optimal.weights} />

                  <div className="analysis-optimal-weights">
                    {sharpeResult.optimal.weights.map((item) => (
                      <div key={item.symbol} className="analysis-optimal-item">
                        <strong>{item.symbol}</strong>
                        <span>{(item.weight * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Optimization not run"
                  description="Click Run Optimization."
                />
              )}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
