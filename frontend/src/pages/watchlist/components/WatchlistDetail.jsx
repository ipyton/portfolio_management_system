import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import LoadingInline from "../../../components/LoadingInline";
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

const formatChartMonth = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, 7);
};

const formatChartHourMinute = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace("T", " ");
  if (normalized.length >= 16) {
    return normalized.slice(11, 16);
  }
  if (normalized.length >= 10) {
    return normalized.slice(5, 10);
  }
  return normalized;
};

const CANDLE_INTERVAL_OPTIONS = [
  { value: "1day", label: "1D" },
  { value: "1month", label: "1M" },
  { value: "1year", label: "1Y" },
];

const formatChartTick = (value, interval) => {
  if (typeof value !== "string") {
    return "";
  }
  if (interval === "1year") {
    return formatChartMonth(value);
  }
  if (interval === "1day") {
    return formatChartHourMinute(value);
  }
  if (interval === "1month") {
    return value.slice(5, 10);
  }
  return value;
};

export default function WatchlistDetail({
  selected,
  candleInterval,
  onCandleIntervalChange,
  onToggleFavourite,
  onTrade,
  onRemove,
  isRemoving,
  interactionDisabled,
  toUsdAmount,
}) {
  const candleChartRef = useRef(null);
  const isDarkMode =
    typeof document !== "undefined"
    && document.documentElement.getAttribute("data-theme") !== "light";

  const candleData = useMemo(() => {
    const source = selected?.candleHistory ?? [];
    const sourceCurrency = selected?.currency;
    return source
      .map((point) => {
        const open = toUsdAmount ? toUsdAmount(point?.open, sourceCurrency) : null;
        const high = toUsdAmount ? toUsdAmount(point?.high, sourceCurrency) : null;
        const low = toUsdAmount ? toUsdAmount(point?.low, sourceCurrency) : null;
        const close = toUsdAmount ? toUsdAmount(point?.close, sourceCurrency) : null;
        return {
          date: point?.date,
          open,
          high,
          low,
          close,
        };
      })
      .filter(
        (point) =>
          point?.date
          && Number.isFinite(Number(point.open))
          && Number.isFinite(Number(point.high))
          && Number.isFinite(Number(point.low))
          && Number.isFinite(Number(point.close)),
      );
  }, [selected, toUsdAmount]);

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
            bullish: "#3ba272",
            bearish: "#f6465d",
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
            bullish: "#00a874",
            bearish: "#ef4444",
          }
    ),
    [isDarkMode],
  );
  const hasCandleData = candleData.length > 0;

  useEffect(() => {
    if (!hasCandleData || !candleChartRef.current) {
      return undefined;
    }

    const chart = echarts.init(candleChartRef.current);
    chart.setOption({
      animation: false,
      grid: { top: 14, right: 14, bottom: 30, left: 48 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: chartPalette.tooltipBg,
        borderColor: chartPalette.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: chartPalette.tooltipText },
        formatter: (params) => {
          const entry = Array.isArray(params) ? params[0] : null;
          const values = Array.isArray(entry?.data) ? entry.data : [];
          const [open, close, low, high] = values;
          if (!entry || !values.length) {
            return "";
          }
          return [
            `Date: ${entry.axisValue}`,
            `Open: ${formatCurrency(open, "USD")}`,
            `High: ${formatCurrency(high, "USD")}`,
            `Low: ${formatCurrency(low, "USD")}`,
            `Close: ${formatCurrency(close, "USD")}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: candleData.map((point) => point.date),
        boundaryGap: true,
        axisLine: { lineStyle: { color: chartPalette.axis } },
        axisLabel: {
          color: chartPalette.tick,
          formatter: (value) => formatChartTick(value, candleInterval),
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { lineStyle: { color: chartPalette.axis } },
        axisLabel: { color: chartPalette.tick },
        splitLine: { lineStyle: { color: chartPalette.grid } },
      },
      series: [
        {
          type: "candlestick",
          data: candleData.map((point) => [point.open, point.close, point.low, point.high]),
          itemStyle: {
            color: chartPalette.bullish,
            color0: chartPalette.bearish,
            borderColor: chartPalette.bullish,
            borderColor0: chartPalette.bearish,
          },
        },
      ],
    }, true);

    const handleResize = () => {
      chart.resize();
    };
    const rafId = window.requestAnimationFrame(handleResize);
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(handleResize);
      observer.observe(candleChartRef.current);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [hasCandleData, candleData, chartPalette, candleInterval]);

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
      <div className="chart-toolbar">
        <span className="chart-toolbar-title">Interval</span>
        <div className="chart-interval-switch">
          {CANDLE_INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chart-interval-btn${candleInterval === option.value ? " active" : ""}`}
              onClick={() => onCandleIntervalChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-placeholder" aria-hidden="true">
        {hasCandleData ? (
          <div ref={candleChartRef} className="watchlist-candle-chart" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 12, bottom: 16, left: 16 }}
            >
              <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatChartTick(value, candleInterval)}
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
                isAnimationActive={false}
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
                isAnimationActive={false}
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
        )}
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
          {isRemoving ? <LoadingInline label="Removing..." size="xs" tone="inverted" /> : "Remove"}
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
