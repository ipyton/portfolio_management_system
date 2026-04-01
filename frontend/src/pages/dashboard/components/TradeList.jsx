import React from "react";

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
          visibleTrades.map((trade) => (
            <div key={trade.id} className="activity-item" style={{ justifyContent: "space-between" }}>
              <p>
                <strong>{trade.symbol}</strong> · {trade.side} · {trade.shares} @ ${trade.price.toFixed(2)}
              </p>
              <p>{trade.date}</p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
