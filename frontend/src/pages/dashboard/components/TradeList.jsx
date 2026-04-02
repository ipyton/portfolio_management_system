import React from "react";
import { formatCurrency } from "../../../lib/api";

function splitTradeDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { date: "N/A", time: "" };
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsed),
      time: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(parsed),
    };
  }

  if (raw.includes("T")) {
    const [datePart, timePart] = raw.split("T");
    return { date: datePart || "N/A", time: timePart || "" };
  }

  return { date: raw, time: "" };
}

export default function TradeList({
  trades,
  selectedSymbol,
  onClear,
  isLoading,
  dataUnavailable,
  minRows = 5,
}) {
  const visibleTrades = selectedSymbol ? trades.filter((trade) => trade.symbol === selectedSymbol) : trades;
  const placeholderRows = Array.from({ length: minRows }, (_, index) => `trade-placeholder-${index}`);
  return (
    <article className="feature-card" style={{ padding: 16 }}>
      <div className="card-head" style={{ marginBottom: 12 }}>
        <span>{selectedSymbol ? `${selectedSymbol} Trades` : "Recent Trades"}</span>
        {selectedSymbol && <button type="button" className="theme-pill" onClick={onClear}>Clear</button>}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {visibleTrades.length === 0 ? (
          <>
            {placeholderRows.map((rowKey) => (
              <div key={rowKey} className="activity-item" style={{ justifyContent: "space-between" }}>
                <p>&nbsp;</p>
                <p>&nbsp;</p>
              </div>
            ))}
            <p style={{ marginTop: 2 }}>
              {isLoading
                ? "Loading live trade data..."
                : dataUnavailable
                  ? "Live trade data is unavailable right now."
                  : selectedSymbol
                    ? `No trade records found for ${selectedSymbol}.`
                    : "No trade records found."}
            </p>
          </>
        ) : (
          visibleTrades.map((trade) => {
            const { date, time } = splitTradeDateTime(trade.date);
            return (
              <div
                key={trade.id}
                className="activity-item"
                style={{ justifyContent: "space-between", alignItems: "flex-start" }}
              >
                <div>
                  <p>
                    <strong>{trade.symbol}</strong> · {trade.side} · {trade.shares}
                  </p>
                  <p>{formatCurrency(trade.price, "USD")}</p>
                </div>
                <div>
                  <p>{date}</p>
                  {time ? <p>{time} CST</p> : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
