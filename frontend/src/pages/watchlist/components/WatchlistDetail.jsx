import React, { useCallback, useEffect, useMemo, useRef } from "react";
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

const toSortableTimestamp = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return Number.NaN;
  }
  const normalized = value.replace(" ", "T");
  const direct = Date.parse(normalized);
  if (Number.isFinite(direct)) {
    return direct;
  }
  const fallback = Date.parse(normalized.slice(0, 19));
  return Number.isFinite(fallback) ? fallback : Number.NaN;
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
  const candleChartInstanceRef = useRef(null);
  const zoomRangeRef = useRef({ start: 0, end: 100 });
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
      )
      .sort((left, right) => {
        const leftTs = toSortableTimestamp(left.date);
        const rightTs = toSortableTimestamp(right.date);
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs)) {
          return leftTs - rightTs;
        }
        if (Number.isFinite(leftTs)) {
          return -1;
        }
        if (Number.isFinite(rightTs)) {
          return 1;
        }
        return String(left.date).localeCompare(String(right.date));
      });
  }, [selected, toUsdAmount]);

  const chartData = useMemo(() => {
    const source = selected?.priceHistory ?? [];
    const sourceCurrency = selected?.currency;
    return source
      .map((point) => {
        const usdPrice = toUsdAmount ? toUsdAmount(point?.price, sourceCurrency) : null;
        return { ...point, price: usdPrice };
      })
      .filter((point) => Number.isFinite(Number(point.price)))
      .sort((left, right) => {
        const leftTs = toSortableTimestamp(left?.date);
        const rightTs = toSortableTimestamp(right?.date);
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs)) {
          return leftTs - rightTs;
        }
        if (Number.isFinite(leftTs)) {
          return -1;
        }
        if (Number.isFinite(rightTs)) {
          return 1;
        }
        return String(left?.date || "").localeCompare(String(right?.date || ""));
      });
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
  const clampZoomPercent = useCallback((value) => Math.max(0, Math.min(100, value)), []);

  const handleZoomChange = useCallback(
    (scaleFactor) => {
      const chart = candleChartInstanceRef.current;
      if (!chart) {
        return;
      }

      const currentStart = Number(zoomRangeRef.current?.start);
      const currentEnd = Number(zoomRangeRef.current?.end);
      const safeStart = Number.isFinite(currentStart) ? currentStart : 0;
      const safeEnd = Number.isFinite(currentEnd) ? currentEnd : 100;
      const currentSpan = Math.max(2, safeEnd - safeStart);
      const nextSpan = Math.max(2, Math.min(100, currentSpan * scaleFactor));
      const center = (safeStart + safeEnd) / 2;
      const maxStart = 100 - nextSpan;
      const nextStart = Math.max(0, Math.min(maxStart, center - nextSpan / 2));
      const nextEnd = nextStart + nextSpan;

      zoomRangeRef.current = {
        start: clampZoomPercent(nextStart),
        end: clampZoomPercent(nextEnd),
      };
      chart.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        start: zoomRangeRef.current.start,
        end: zoomRangeRef.current.end,
      });
    },
    [clampZoomPercent],
  );

  const handleZoomIn = useCallback(() => {
    handleZoomChange(0.8);
  }, [handleZoomChange]);

  const handleZoomOut = useCallback(() => {
    handleZoomChange(1.25);
  }, [handleZoomChange]);

  useEffect(() => {
    if (!hasCandleData || !candleChartRef.current) {
      return undefined;
    }

    const chart = echarts.init(candleChartRef.current);
    candleChartInstanceRef.current = chart;
    zoomRangeRef.current = { start: 0, end: 100 };
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
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
          filterMode: "none",
        },
      ],
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
        {
          type: "line",
          data: candleData.map((point) => point.close),
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: chartPalette.line,
            width: 2.2,
          },
          z: 3,
          emphasis: {
            disabled: true,
          },
        },
      ],
    }, true);
    const syncZoomRange = () => {
      const option = chart.getOption();
      const zoomOption = option?.dataZoom?.[0];
      if (!zoomOption) {
        return;
      }
      const nextStart = Number(zoomOption.start);
      const nextEnd = Number(zoomOption.end);
      if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) {
        return;
      }
      zoomRangeRef.current = {
        start: clampZoomPercent(nextStart),
        end: clampZoomPercent(nextEnd),
      };
    };
    chart.on("datazoom", syncZoomRange);

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
      chart.off("datazoom", syncZoomRange);
      if (candleChartInstanceRef.current === chart) {
        candleChartInstanceRef.current = null;
      }
      chart.dispose();
    };
  }, [hasCandleData, candleData, chartPalette, candleInterval, clampZoomPercent]);

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
      <div className="chart-placeholder">
        {hasCandleData ? (
          <div className="watchlist-candle-chart-wrap">
            <div ref={candleChartRef} className="watchlist-candle-chart" />
            <div className="chart-zoom-controls" role="group" aria-label="Chart zoom controls">
              <button type="button" className="chart-zoom-btn" onClick={handleZoomIn} aria-label="Zoom in">
                +
              </button>
              <button type="button" className="chart-zoom-btn" onClick={handleZoomOut} aria-label="Zoom out">
                -
              </button>
            </div>
          </div>
        ) : (
          <div className="chart-placeholder-empty">No candle data for selected interval.</div>
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
