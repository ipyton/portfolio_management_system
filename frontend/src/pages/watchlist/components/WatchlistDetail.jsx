import React, { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function WatchlistDetail({
  selected,
  onToggleFavourite,
  onTrade,
}) {
  const chartData = useMemo(() => selected?.priceHistory ?? [], [selected]);

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
            <XAxis
              dataKey="date"
              tickFormatter={(value) => value.slice(0, 7)}
              minTickGap={40}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              axisLine
              tickLine
            />
            <YAxis
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              axisLine
              tickLine
              width={40}
            />
            <Tooltip
              formatter={(value) => [`$${value}`, "Price"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#111111"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="stats-grid">
        <div className="stat">Return: {selected.returnPct}</div>
        <div className="stat">Investment Horizon: {selected.horizon}</div>
        <div className="stat">Sharp Ratio: {selected.sharpe}</div>
        <div className="stat">Max Drawdown: {selected.drawdown}</div>
      </div>
      <div className="action-row">
        <button type="button" onClick={() => onTrade("buy")}>
          Buy
        </button>
        <button type="button" onClick={() => onTrade("sell")}>
          Sell
        </button>
        <button
          type="button"
          className={`icon-btn${selected.isFavourite ? " is-favourite" : ""}`}
          aria-label="Favourite"
          onClick={() => onToggleFavourite(selected.symbol)}
        >
          {selected.isFavourite ? "★" : "☆"}
        </button>
      </div>
    </section>
  );
}
