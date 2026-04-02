import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../../lib/api";

const formatCompactNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatPeRatio = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "N/A";
  }
  return numeric.toFixed(2);
};

export default function WatchlistDetail({
  selected,
  onToggleFavourite,
  onTrade,
  onRemove,
  isRemoving,
  interactionDisabled,
  toUsdAmount,
}) {
  const isDarkMode =
    typeof document !== "undefined"
    && document.documentElement.getAttribute("data-theme") !== "light";
  const chartData = useMemo(() => {
    const source = selected?.priceHistory ?? [];
    const sourceCurrency = selected?.currency;
    return source
      .map((point) => {
        const usdPrice = toUsdAmount ? toUsdAmount(point?.price, sourceCurrency) : null;
        return { ...point, price: usdPrice };
      })
      .filter((point) => Number.isFinite(Number(point.price)));
  }, [selected, toUsdAmount]);
  const chartPalette = useMemo(
    () => (
      isDarkMode
        ? {
            line: "#79a8ff",
            axis: "rgba(140, 158, 194, 0.66)",
            tick: "#a6b2cd",
            grid: "rgba(121, 168, 255, 0.2)",
            tooltipBg: "rgba(10, 13, 20, 0.96)",
            tooltipBorder: "rgba(121, 168, 255, 0.34)",
            tooltipText: "#eaf0ff",
            pointStroke: "rgba(10, 13, 20, 0.96)",
          }
        : {
            line: "#1f4ed8",
            axis: "rgba(107, 114, 128, 0.62)",
            tick: "#4b5563",
            grid: "rgba(148, 163, 184, 0.26)",
            tooltipBg: "rgba(255, 255, 255, 0.97)",
            tooltipBorder: "rgba(148, 163, 184, 0.4)",
            tooltipText: "#111827",
            pointStroke: "#ffffff",
          }
    ),
    [isDarkMode],
  );

  if (!selected) {
    return (
      <section className="watchlist-panel detail-panel">
        <div className="chart-placeholder" aria-hidden="true" />
        <div className="stats-grid">
          <div className="stat">Select a stock to view details.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="watchlist-panel detail-panel">
      <div className="chart-placeholder" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 12, bottom: 16, left: 16 }}
          >
            <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => value.slice(0, 7)}
              minTickGap={40}
              tick={{ fontSize: 11, fill: chartPalette.tick }}
              tickMargin={8}
              axisLine={{ stroke: chartPalette.axis }}
              tickLine={{ stroke: chartPalette.axis }}
            />
            <YAxis
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11, fill: chartPalette.tick }}
              tickMargin={8}
              axisLine={{ stroke: chartPalette.axis }}
              tickLine={{ stroke: chartPalette.axis }}
              width={40}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value, "USD"), "Price (USD)"]}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                background: chartPalette.tooltipBg,
                border: `1px solid ${chartPalette.tooltipBorder}`,
                borderRadius: 10,
                color: chartPalette.tooltipText,
              }}
              labelStyle={{ color: chartPalette.tooltipText }}
              itemStyle={{ color: chartPalette.tooltipText }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={chartPalette.line}
              strokeWidth={3}
              activeDot={{
                r: 4,
                fill: chartPalette.line,
                stroke: chartPalette.pointStroke,
                strokeWidth: 2,
              }}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="stats-grid">
        <div className="stat">Name: {selected.name || selected.symbol}</div>
        <div className="stat">Exchange: {selected.exchange || "N/A"}</div>
        <div className="stat">Region: {selected.region || "N/A"}</div>
        <div className="stat">Sector: {selected.sector || "N/A"}</div>
        <div className="stat">Industry: {selected.industry || "N/A"}</div>
        <div className="stat">Market Cap: {formatCompactNumber(selected.marketCap)}</div>
        <div className="stat">P/E Ratio: {formatPeRatio(selected.peRatio)}</div>
        <div className="stat">Return: {selected.returnPct}</div>
        <div className="stat">Investment Horizon: {selected.horizon}</div>
        <div className="stat">Sharpe Ratio: {selected.sharpe}</div>
        <div className="stat">Max Drawdown: {selected.drawdown}</div>
      </div>
      <div className="action-row">
        <button type="button" onClick={() => onTrade("buy")} disabled={interactionDisabled}>
          Buy
        </button>
        <button type="button" onClick={() => onTrade("sell")} disabled={interactionDisabled}>
          Sell
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={Boolean(isRemoving) || interactionDisabled}
        >
          {isRemoving ? "Removing..." : "Remove"}
        </button>
        <button
          type="button"
          className={`icon-btn${selected.isFavourite ? " is-favourite" : ""}`}
          aria-label="Favourite"
          disabled={interactionDisabled}
          onClick={() => onToggleFavourite(selected.symbol)}
        >
          {selected.isFavourite ? "★" : "☆"}
        </button>
      </div>
    </section>
  );
}
